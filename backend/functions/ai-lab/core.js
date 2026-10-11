// SalaamStreet — ai-lab core (plain JavaScript, shared by the Edge Function
// and the tests). The private AI Testing Lab: one admin, real Gemini replies.
//
// Every request is checked here, on the server, before anything else:
//   1. a Supabase session token that Supabase Auth itself confirms (signature
//      and expiry are checked by Supabase, not by us decoding the token);
//   2. a confirmed email whose SHA-256 is on the admin list, signed in with
//      Google. Plans are never consulted, so no plan can unlock the Lab.
// Then: the emergency switches (AI_DISABLED secret and the database switch),
// the daily and per-minute limits (counted atomically in Postgres), size
// limits, a timeout, and careful error handling. The Gemini key is only ever
// read from the environment and sent in a request header to Google; it never
// appears in a response or a log line. Conversations are not stored.

/** SHA-256 of "ibrahim.asim.contact@gmail.com" — this repository is public, so
    the address itself isn't written here. Override with the AI_ADMIN_EMAIL_SHA256
    secret (comma-separated hashes of lower-cased addresses). */
export const DEFAULT_ADMIN_SHA256 = ["0359ef19e11b6941875be3039743b7d627855fa162b587982a5142cf558e6276"];
export const DEFAULT_ORIGINS = ["https://salaamstreet.com", "https://www.salaamstreet.com", "https://ibbucoder.github.io"];
const GEMINI_BASE = "https://generativelanguage.googleapis.com";
const MAX_BODY = 200000; // bytes
const MAX_TURNS = 40;

export const SYSTEM_PROMPT = [
  "You are the SalaamStreet AI assistant, being tested privately by the app's administrator.",
  "You help with Islamic questions, Qur'an and tafsir study, schoolwork, research, planning and general conversation.",
  "Rules for anything about Islam:",
  "- Never invent Qur'an verses, hadith, quotations, scholars' words, book titles, page numbers, citations or links.",
  "- You have no live access to sources here. When you quote or cite, say it is from memory and should be checked;",
  "  for the Qur'an give the surah and ayah number so it can be looked up, and for hadith the collection and number only if you are confident.",
  "- If you are not sure a text or reference is exact, say so plainly instead of guessing.",
  "- Clearly separate (a) what the Qur'an or authentic hadith say, (b) scholarly opinion, and (c) your own general explanation.",
  "- Where the schools of thought or scholars differ, say so and summarise the main positions fairly, without picking one as the only answer.",
  "- You are not a mufti or a qualified scholar. Do not issue fatwas or personal rulings; for rulings on someone's own situation,",
  "  recommend asking a qualified, trusted scholar or local imam.",
  "- Be respectful, kind and concise. Use plain language suitable for a teenager unless asked otherwise.",
  "For schoolwork: help the person learn and understand; don't present work as theirs.",
].join("\n");

export const LIMITS = Object.freeze({
  daily_limit: [0, 2000], minute_limit: [1, 60], max_input_chars: [200, 30000], max_output_tokens: [64, 8192],
  input_usd_per_mtok: [0, 1000], output_usd_per_mtok: [0, 1000],
});
const MODEL_RE = /^[a-z0-9][a-z0-9.-]{1,63}$/;

class LabError extends Error {
  constructor(status, code, message, extra) { super(message); this.status = status; this.code = code; this.extra = extra || {}; }
}

async function sha256Hex(s) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, "0")).join("");
}
const truthy = (v) => /^(1|true|yes|on)$/i.test(String(v || "").trim());
const num = (v) => (v === null || v === undefined || v === "" ? null : Number(v));

/** Estimated cost in US dollars. Thinking tokens are billed as output. */
export function estimateCost(usage, s) {
  if (!usage || usage.prompt == null) return null;
  const out = (usage.output || 0) + (usage.thoughts || 0);
  return Math.round(((usage.prompt * Number(s.input_usd_per_mtok)) + (out * Number(s.output_usd_per_mtok))) / 1e6 * 1e6) / 1e6;
}

/** Remove anything that looks like a Google API key, and the configured key itself. */
function scrub(text, key) {
  let t = String(text || "").slice(0, 400);
  if (key) t = t.split(key).join("[key]");
  return t.replace(/AIza[0-9A-Za-z_-]{20,}/g, "[key]");
}

/** Keep the newest turns that fit the budget; the last (the question) always stays. */
export function fitHistory(messages, budget) {
  const out = [];
  let used = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    const len = messages[i].text.length;
    if (out.length && used + len > budget) break;
    out.unshift(messages[i]);
    used += len;
  }
  // Gemini expects the conversation to start with the user.
  while (out.length > 1 && out[0].role !== "user") out.shift();
  return { messages: out, dropped: messages.length - out.length };
}

export function validateSettingsPatch(patch) {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) throw new LabError(400, "bad_request", "Settings must be an object.");
  const out = {};
  for (const k of Object.keys(patch)) {
    const v = patch[k];
    if (k === "enabled") {
      if (typeof v !== "boolean") throw new LabError(400, "bad_request", "enabled must be true or false.");
      out.enabled = v;
    } else if (k === "model") {
      const m = String(v || "").trim().replace(/^models\//, "");
      if (!MODEL_RE.test(m)) throw new LabError(400, "bad_request", "That isn't a valid Gemini model ID (for example gemini-3.5-flash-lite).");
      out.model = m;
    } else if (LIMITS[k]) {
      const n = Number(v), [lo, hi] = LIMITS[k];
      const isInt = k.indexOf("usd") === -1;
      if (!Number.isFinite(n) || n < lo || n > hi || (isInt && !Number.isInteger(n))) {
        throw new LabError(400, "bad_request", `${k} must be ${isInt ? "a whole number" : "a number"} from ${lo} to ${hi}.`);
      }
      out[k] = n;
    } else {
      throw new LabError(400, "bad_request", `Unknown setting: ${k}`);
    }
  }
  if (!Object.keys(out).length) throw new LabError(400, "bad_request", "Nothing to change.");
  return out;
}

function publicSettings(s) {
  return {
    enabled: !!s.enabled, model: s.model, daily_limit: s.daily_limit, minute_limit: s.minute_limit,
    max_input_chars: s.max_input_chars, max_output_tokens: s.max_output_tokens,
    input_usd_per_mtok: Number(s.input_usd_per_mtok), output_usd_per_mtok: Number(s.output_usd_per_mtok),
    updated_at: s.updated_at || null,
  };
}

/**
 * deps.env(name)   → string | undefined
 * deps.fetch       → fetch (used only for Google)
 * deps.store       → { getUser(token), settings(), updateSettings(patch, userId), reserve(userId, kind),
 *                      finish(id, patch), summary(), logRefusal(userId, event, detail) }
 * deps.log         → optional { warn(...) } (never given secrets or message text)
 */
export function createHandler(deps) {
  const env = (k) => { const v = deps.env(k); return v === undefined || v === null ? "" : String(v); };
  const log = deps.log || console;
  const store = deps.store;

  function origins() {
    const list = env("AI_ALLOWED_ORIGINS");
    return list ? list.split(",").map((s) => s.trim()).filter(Boolean) : DEFAULT_ORIGINS;
  }
  function cors(req) {
    const o = req.headers.get("origin") || "";
    const h = { "access-control-allow-headers": "authorization, apikey, content-type, x-client-info",
      "access-control-allow-methods": "POST, OPTIONS", "access-control-max-age": "600", vary: "Origin" };
    if (o && origins().indexOf(o) > -1) h["access-control-allow-origin"] = o;
    return h;
  }
  function reply(req, status, body) {
    return new Response(JSON.stringify(body), { status, headers: Object.assign({ "content-type": "application/json", "cache-control": "no-store" }, cors(req)) });
  }

  async function refuse(userId, event, detail) {
    try { await store.logRefusal(userId || null, event, detail ? String(detail).slice(0, 120) : null); } catch (_) { /* logging must not break the reply */ }
  }

  async function authorize(req) {
    const m = (req.headers.get("authorization") || "").match(/^Bearer\s+(\S+)$/i);
    if (!m) { await refuse(null, "no_session"); throw new LabError(401, "signed_out", "Sign in with the admin Google account to use the AI Testing Lab."); }
    let user = null;
    try { user = await store.getUser(m[1]); } catch (_) { user = null; }
    if (!user || !user.id) { await refuse(null, "invalid_session"); throw new LabError(401, "invalid_session", "Your sign-in has expired or isn't valid. Sign in again."); }
    const email = String(user.email || "").trim().toLowerCase();
    const confirmed = !!(user.email_confirmed_at || user.confirmed_at);
    const am = user.app_metadata || {};
    const providers = [].concat(am.providers || [], am.provider || [], (user.identities || []).map((i) => i && i.provider));
    const google = providers.indexOf("google") > -1;
    const allowed = (env("AI_ADMIN_EMAIL_SHA256") ? env("AI_ADMIN_EMAIL_SHA256").split(",") : DEFAULT_ADMIN_SHA256)
      .map((s) => s.trim().toLowerCase()).filter(Boolean);
    const listed = !!email && allowed.indexOf(await sha256Hex(email)) > -1;
    if (!listed || !confirmed || !google) {
      await refuse(user.id, "not_admin", !listed ? "not on the admin list" : !confirmed ? "email not confirmed" : "not signed in with Google");
      throw new LabError(403, "forbidden", !listed ? "This account can't use the AI Testing Lab."
        : !confirmed ? "Confirm this account's email address first." : "Sign in with Google (the admin's Google account) to use the AI Testing Lab.");
    }
    return user;
  }

  function killSwitchEnv() { return truthy(env("AI_DISABLED")); }

  async function status(user) {
    const [s, usage] = await Promise.all([store.settings(), store.summary()]);
    return {
      ok: true,
      user: { id: user.id },
      gemini_key_set: !!env("GEMINI_API_KEY"),
      disabled_by_secret: killSwitchEnv(),
      settings: publicSettings(s),
      usage: usage ? {
        today_requests: Number(usage.today_requests) || 0, today_errors: Number(usage.today_errors) || 0,
        today_tokens: Number(usage.today_tokens) || 0, today_cost_usd: Number(usage.today_cost_usd) || 0,
        week_requests: Number(usage.week_requests) || 0, week_cost_usd: Number(usage.week_cost_usd) || 0,
        refused_today: Number(usage.refused_today) || 0, resets_at: usage.resets_at || null,
        remaining_today: Math.max(0, s.daily_limit - (Number(usage.today_requests) || 0)),
      } : null,
      billing_enabled: false,
    };
  }

  function needKey() {
    const key = env("GEMINI_API_KEY");
    if (!key) throw new LabError(503, "not_configured", "GEMINI_API_KEY isn't set. Add it in Supabase → Edge Functions → Secrets, then try again.");
    return key;
  }

  async function reserve(user, kind) {
    if (killSwitchEnv()) throw new LabError(503, "disabled", "AI requests are switched off by the AI_DISABLED secret.");
    const r = await store.reserve(user.id, kind);
    if (!r || !r.ok) {
      const reason = (r && r.reason) || "error";
      if (reason === "disabled") throw new LabError(503, "disabled", "AI requests are switched off (emergency switch).");
      if (reason === "daily_limit") throw new LabError(429, "daily_limit", `Today's limit of ${r.limit} requests is used up. It resets at midnight UTC.`, { used: r.used, limit: r.limit });
      if (reason === "rate_limit") throw new LabError(429, "rate_limit", "Too many requests in the last minute. Wait a moment and try again.");
      throw new LabError(500, "server_error", "Couldn't check the usage limits.");
    }
    return r;
  }

  async function callGoogle(url, init, key) {
    const ms = Math.max(1000, Number(env("AI_TIMEOUT_MS")) || 45000);
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), ms);
    let res, data = null;
    const started = Date.now();
    try {
      res = await deps.fetch(url, Object.assign({}, init, {
        signal: ctl.signal,
        headers: Object.assign({ "x-goog-api-key": key, "content-type": "application/json" }, init.headers || {}),
      }));
      const text = await res.text();
      try { data = text ? JSON.parse(text) : null; } catch (_) { data = null; }
    } catch (e) {
      if (ctl.signal.aborted) throw new LabError(504, "timeout", `Gemini didn't answer within ${Math.round(ms / 1000)} seconds.`);
      throw new LabError(502, "network", "Couldn't reach Gemini (network error). Try again.");
    } finally { clearTimeout(timer); }
    const latency = Date.now() - started;
    if (!res.ok) {
      const pe = (data && data.error) || {};
      const msg = scrub(pe.message || "", key);
      const st = res.status;
      if (st === 429) throw new LabError(429, "provider_quota", "Gemini's quota or rate limit was reached (" + (pe.status || "RESOURCE_EXHAUSTED") + "). Check your plan and limits in Google AI Studio.", { provider: msg });
      if (st === 401 || st === 403 || /api key/i.test(msg)) throw new LabError(502, "provider_auth", "Gemini rejected the API key. Check GEMINI_API_KEY in Supabase secrets.", { provider: msg });
      if (st === 404) throw new LabError(502, "model_not_found", "Gemini doesn't know this model ID. Change the model in Settings.", { provider: msg });
      if (st === 400) throw new LabError(502, "provider_bad_request", "Gemini couldn't use this request.", { provider: msg });
      throw new LabError(502, "provider_error", `Gemini had a problem (HTTP ${st}). Try again later.`, { provider: msg });
    }
    return { data: data || {}, latency };
  }

  async function test(user) {
    const key = needKey();
    const r = await reserve(user, "test");
    const base = env("GEMINI_API_BASE") || GEMINI_BASE;
    try {
      const { data, latency } = await callGoogle(`${base}/v1beta/models/${encodeURIComponent(r.model)}`, { method: "GET" }, key);
      await store.finish(r.id, { status: "ok", latency_ms: latency });
      return { ok: true, model: r.model, display_name: data.displayName || null, input_token_limit: data.inputTokenLimit || null,
        output_token_limit: data.outputTokenLimit || null, latency_ms: latency };
    } catch (e) {
      await store.finish(r.id, { status: "error", error: e.code || "error" }).catch(() => {});
      throw e;
    }
  }

  async function chat(user, body) {
    const key = needKey();
    const s = await store.settings();
    const raw = body.messages;
    if (!Array.isArray(raw) || !raw.length) throw new LabError(400, "bad_request", "Send at least one message.");
    if (raw.length > MAX_TURNS * 2) throw new LabError(400, "bad_request", "This conversation is too long. Start a new one.");
    const msgs = raw.map((m) => ({ role: m && m.role === "model" ? "model" : m && m.role === "user" ? "user" : "", text: m && typeof m.text === "string" ? m.text.trim() : "" }));
    if (msgs.some((m) => !m.role || !m.text)) throw new LabError(400, "bad_request", "Every message needs a role (user or model) and text.");
    const last = msgs[msgs.length - 1];
    if (last.role !== "user") throw new LabError(400, "bad_request", "The last message must be your question.");
    if (last.text.length > s.max_input_chars) throw new LabError(413, "too_long", `Your message is ${last.text.length} characters; the limit is ${s.max_input_chars}.`);
    const fit = fitHistory(msgs.slice(-MAX_TURNS), s.max_input_chars * 4);
    const r = await reserve(user, "chat");
    const base = env("GEMINI_API_BASE") || GEMINI_BASE;
    const req = {
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: fit.messages.map((m) => ({ role: m.role, parts: [{ text: m.text }] })),
      generationConfig: { maxOutputTokens: r.max_output_tokens },
    };
    try {
      const { data, latency } = await callGoogle(`${base}/v1beta/models/${encodeURIComponent(r.model)}:generateContent`,
        { method: "POST", body: JSON.stringify(req) }, key);
      const um = data.usageMetadata || null;
      const usage = um ? { prompt: num(um.promptTokenCount), output: num(um.candidatesTokenCount) || 0,
        thoughts: num(um.thoughtsTokenCount) || 0, total: num(um.totalTokenCount) } : null;
      const cost = estimateCost(usage, r);
      const cand = (data.candidates || [])[0];
      const parts = (cand && cand.content && cand.content.parts) || [];
      const text = parts.filter((p) => !p.thought && typeof p.text === "string").map((p) => p.text).join("").trim();
      const finish = (cand && cand.finishReason) || null;
      const done = { latency_ms: latency, prompt_tokens: usage && usage.prompt, output_tokens: usage && usage.output,
        thought_tokens: usage && usage.thoughts, total_tokens: usage && usage.total, cost_usd: cost };
      if (!text) {
        const blocked = (data.promptFeedback && data.promptFeedback.blockReason) || (finish && /SAFETY|BLOCK|PROHIBITED|RECITATION/.test(finish) ? finish : "");
        const code = blocked ? "blocked" : finish === "MAX_TOKENS" ? "max_tokens" : "empty";
        await store.finish(r.id, Object.assign(done, { status: "error", error: code }));
        throw new LabError(502, code, blocked ? `Gemini declined to answer (${blocked}).`
          : finish === "MAX_TOKENS" ? "Gemini used its whole output allowance before answering. Raise “Max output tokens” in Settings."
          : "Gemini returned an empty answer.", { usage, cost_usd: cost });
      }
      await store.finish(r.id, Object.assign(done, { status: "ok" }));
      return { ok: true, text, model: r.model, model_version: data.modelVersion || null, finish_reason: finish,
        truncated: finish === "MAX_TOKENS", usage, cost_usd: cost, latency_ms: latency, dropped_turns: fit.dropped,
        used_today: r.used, daily_limit: r.limit, remaining_today: Math.max(0, r.limit - r.used) };
    } catch (e) {
      if (e instanceof LabError && ["blocked", "max_tokens", "empty"].indexOf(e.code) > -1) throw e;
      await store.finish(r.id, { status: "error", error: (e && e.code) || "error" }).catch(() => {});
      throw e;
    }
  }

  return async function handle(req) {
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
    try {
      if (req.method !== "POST") throw new LabError(405, "method", "Use POST.");
      const len = Number(req.headers.get("content-length") || 0);
      if (len > MAX_BODY) throw new LabError(413, "too_long", "The request is too large.");
      const user = await authorize(req); // before reading anything else
      const raw = await req.text();
      if (raw.length > MAX_BODY) throw new LabError(413, "too_long", "The request is too large.");
      let body;
      try { body = JSON.parse(raw || "{}"); } catch (_) { throw new LabError(400, "bad_request", "The request isn't valid JSON."); }
      const action = body && body.action;
      if (action === "status") return reply(req, 200, await status(user));
      if (action === "test") return reply(req, 200, await test(user));
      if (action === "chat") return reply(req, 200, await chat(user, body));
      if (action === "settings") {
        const patch = validateSettingsPatch(body.patch);
        const s = await store.updateSettings(patch, user.id);
        return reply(req, 200, { ok: true, settings: publicSettings(s) });
      }
      throw new LabError(400, "bad_request", "Unknown action.");
    } catch (e) {
      if (e instanceof LabError) {
        if (e.status >= 500) log.warn("ai-lab:", e.code);
        return reply(req, e.status, Object.assign({ ok: false, error: e.code, message: e.message }, e.extra));
      }
      log.warn("ai-lab: unexpected", e && e.name);
      return reply(req, 500, { ok: false, error: "server_error", message: "Something went wrong on the server." });
    }
  };
}
