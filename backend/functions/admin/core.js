// SalaamStreet — admin core (plain JavaScript, shared by the Edge Function
// and the tests). The Admin Panel (3.0.1, #/admin on the website and in the
// iPhone app): the app's numbers, accounts, flags, SalaamStreet AI's main
// switches, the NVHS MSA, the admin list and the activity log.
//
// Every request is checked here, on the server, before anything else:
//   1. a Supabase session token that Supabase Auth itself confirms;
//   2. a confirmed email address, signed in with Google (like the AI Testing
//      Lab: a password account can't be made in the admin's name);
//   3. that email on the admin list (public.app_admins, checked in Postgres).
// Then each action's input is validated, and the database functions check
// the admin list again themselves and write every change to the activity log.
// Admins can't act on their own account or on another admin's. Deleting an
// account needs its email typed back. Nothing anyone wrote (AI
// conversations, synced notes) is ever shown, only counts.

export const DEFAULT_ORIGINS = ["https://salaamstreet.com", "https://www.salaamstreet.com", "https://ibbucoder.github.io",
  "app://salaamstreet"]; // the iPhone app (ios/: the website served at app://salaamstreet/)
const MAX_BODY = 20000; // bytes
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FILTERS = ["all", "flagged", "banned", "new", "never", "unconfirmed", "admins"];
export const AI_LIMITS = Object.freeze({ user_daily_limit: [0, 1000], daily_limit: [0, 100000] });

class AdminError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}

/** What a database refusal means for the person using the panel. */
function dbError(e) {
  const code = e && e.code, msg = String((e && e.message) || "");
  if (code === "42501") {
    if (/not yourself/.test(msg)) return new AdminError(403, "self", "You can't do that to your own account.");
    if (/an admin/.test(msg)) return new AdminError(403, "is_admin", "That account is an admin. Remove it from the admin list first.");
    if (/last admin/.test(msg)) return new AdminError(403, "last_admin", "There must always be at least one admin.");
    return new AdminError(403, "forbidden", "This account can't use the Admin Panel.");
  }
  if (code === "P0002") return new AdminError(404, "not_found", "That account or post doesn't exist any more.");
  if (code === "22023") {
    if (/confirm/.test(msg)) return new AdminError(400, "confirm", "Type the account's email address exactly to confirm.");
    if (/bad word/.test(msg)) return new AdminError(400, "bad_request", "A word needs 3 to 40 letters.");
    if (/bad email/.test(msg)) return new AdminError(400, "bad_request", "That isn't a valid email address.");
    return new AdminError(400, "bad_request", "The server couldn't use that request.");
  }
  if (code === "54000") return new AdminError(409, "too_many", /admins/.test(msg) ? "The admin list is full (20)." : "The word list is full (500).");
  return null;
}

const str = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");
function uuid(v) {
  if (typeof v !== "string" || !UUID_RE.test(v)) throw new AdminError(400, "bad_request", "That isn't a valid account id.");
  return v.toLowerCase();
}
function int(v, lo, hi, name) {
  const n = Number(v);
  if (!Number.isInteger(n) || n < lo || n > hi) throw new AdminError(400, "bad_request", `${name} must be a whole number from ${lo} to ${hi}.`);
  return n;
}

export function validateAiPatch(patch) {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) throw new AdminError(400, "bad_request", "Settings must be an object.");
  const out = {};
  for (const k of Object.keys(patch)) {
    const v = patch[k];
    if (k === "enabled" || k === "beta_open") {
      if (typeof v !== "boolean") throw new AdminError(400, "bad_request", `${k} must be true or false.`);
      out[k] = v;
    } else if (AI_LIMITS[k]) {
      out[k] = int(v, AI_LIMITS[k][0], AI_LIMITS[k][1], k);
    } else {
      throw new AdminError(400, "bad_request", `Unknown setting: ${k}`);
    }
  }
  if (!Object.keys(out).length) throw new AdminError(400, "bad_request", "Nothing to change.");
  return out;
}

/**
 * deps.env(name) → string | undefined
 * deps.store     → { getUser(token), rpc(name, args) } — rpc rejects with { code, message } from Postgres
 * deps.log       → optional { warn(...) } (never given tokens or emails)
 */
export function createHandler(deps) {
  const env = (k) => { const v = deps.env(k); return v === undefined || v === null ? "" : String(v); };
  const log = deps.log || console;
  const store = deps.store;

  async function rpc(name, args) {
    try {
      return await store.rpc(name, args);
    } catch (e) {
      const mapped = dbError(e);
      if (mapped) throw mapped;
      log.warn("admin: database error in", name);
      throw new AdminError(500, "server_error", "The database had a problem. Try again.");
    }
  }

  function origins() {
    const list = env("ADMIN_ALLOWED_ORIGINS");
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

  /** The admin's own account, or an AdminError. */
  async function authorize(req, action) {
    const m = (req.headers.get("authorization") || "").match(/^Bearer\s+(\S+)$/i);
    if (!m) throw new AdminError(401, "signed_out", "Sign in to use the Admin Panel.");
    let user = null;
    try { user = await store.getUser(m[1]); } catch (_) { user = null; }
    if (!user || !user.id) throw new AdminError(401, "invalid_session", "Your sign-in has expired or isn't valid. Sign in again.");
    const email = String(user.email || "").trim().toLowerCase();
    const confirmed = !!(user.email_confirmed_at || user.confirmed_at);
    const am = user.app_metadata || {};
    const providers = [].concat(am.providers || [], am.provider || [], (user.identities || []).map((i) => i && i.provider));
    const google = providers.indexOf("google") > -1;
    const listed = !!email && confirmed && !user.is_anonymous && (await rpc("admin_check", { p_user: user.id })) === true;
    if (listed && google) return user;
    // "me" is how the app asks whether to show the Admin Panel link: not worth a log line.
    if (action !== "me") { try { await store.rpc("admin_denied", { p_user: user.id, p_action: String(action || "").slice(0, 40) }); } catch (_) { /* never break the reply */ } }
    throw new AdminError(403, "forbidden", listed ? "Sign in with Google (your admin Google account) to use the Admin Panel."
      : "This account can't use the Admin Panel.");
  }

  const ACTIONS = {
    me: (a) => rpc("admin_hello", { p_admin: a }),
    overview: (a) => rpc("admin_overview", { p_admin: a }),
    users: (a, b) => {
      const filter = b.filter === undefined ? "all" : b.filter;
      if (FILTERS.indexOf(filter) === -1) throw new AdminError(400, "bad_request", "Unknown filter.");
      return rpc("admin_users", { p_admin: a, p_search: str(b.search, 200), p_filter: filter, p_offset: b.offset === undefined ? 0 : int(b.offset, 0, 1e6, "offset") });
    },
    user: async (a, b) => {
      const u = await rpc("admin_user", { p_admin: a, p_id: uuid(b.id) });
      if (!u) throw new AdminError(404, "not_found", "That account doesn't exist any more.");
      return { user: u };
    },
    ban: (a, b) => rpc("admin_ban", { p_admin: a, p_id: uuid(b.id), p_days: b.days === null || b.days === undefined ? null : int(b.days, 1, 3650, "days"), p_reason: str(b.reason, 150) }),
    unban: (a, b) => rpc("admin_unban", { p_admin: a, p_id: uuid(b.id) }),
    sign_out: (a, b) => rpc("admin_sign_out", { p_admin: a, p_id: uuid(b.id) }),
    delete: (a, b) => {
      if (!str(b.confirm, 320)) throw new AdminError(400, "confirm", "Type the account's email address exactly to confirm.");
      return rpc("admin_delete_user", { p_admin: a, p_id: uuid(b.id), p_confirm: str(b.confirm, 320), p_reason: str(b.reason, 150) });
    },
    flag: (a, b) => {
      if (["dismiss", "reopen", "add"].indexOf(b.op) === -1) throw new AdminError(400, "bad_request", "op must be dismiss, reopen or add.");
      return rpc("admin_flag", { p_admin: a, p_id: uuid(b.id), p_action: b.op, p_note: str(b.note, 200) });
    },
    flags: (a) => rpc("admin_flags_list", { p_admin: a }),
    ai_member: (a, b) => {
      if (["pause", "restore"].indexOf(b.op) === -1) throw new AdminError(400, "bad_request", "op must be pause or restore.");
      return rpc("admin_ai_member", { p_admin: a, p_id: uuid(b.id), p_action: b.op, p_days: b.op === "pause" ? int(b.days, 1, 3650, "days") : null });
    },
    screening: (a) => rpc("admin_screening", { p_admin: a }),
    screening_set: (a, b) => {
      if (b.block !== undefined && typeof b.block !== "boolean") throw new AdminError(400, "bad_request", "block must be true or false.");
      const add = b.add === undefined ? null : str(b.add, 60), remove = b.remove === undefined ? null : str(b.remove, 60);
      if (b.block === undefined && !add && !remove) throw new AdminError(400, "bad_request", "Nothing to change.");
      return rpc("admin_screening_set", { p_admin: a, p_block: b.block === undefined ? null : b.block, p_add: add || null, p_remove: remove || null });
    },
    admins: async (a) => ({ admins: await rpc("admin_admins", { p_admin: a }) }),
    admins_set: async (a, b) => {
      const add = b.add === undefined ? null : str(b.add, 320), remove = b.remove === undefined ? null : str(b.remove, 64);
      if (!add && !remove) throw new AdminError(400, "bad_request", "Nothing to change.");
      return { admins: await rpc("admin_admins_set", { p_admin: a, p_add_email: add || null, p_remove_id: remove || null }) };
    },
    ai: (a) => rpc("admin_ai", { p_admin: a }),
    ai_set: (a, b) => rpc("admin_ai_set", { p_admin: a, p_patch: validateAiPatch(b.patch) }),
    msa: (a) => rpc("admin_msa", { p_admin: a }),
    msa_delete_post: (a, b) => rpc("admin_msa_delete_post", { p_admin: a, p_post: uuid(b.id) }),
    audit: (a, b) => rpc("admin_audit_list", { p_admin: a, p_offset: b.offset === undefined ? 0 : int(b.offset, 0, 1e6, "offset") }),
  };

  return async function handle(req) {
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
    try {
      if (req.method !== "POST") throw new AdminError(405, "method", "Use POST.");
      if (Number(req.headers.get("content-length") || 0) > MAX_BODY) throw new AdminError(413, "too_long", "The request is too large.");
      const raw = await req.text();
      if (raw.length > MAX_BODY) throw new AdminError(413, "too_long", "The request is too large.");
      let body;
      try { body = JSON.parse(raw || "{}"); } catch (_) { body = null; }
      if (!body || typeof body !== "object" || Array.isArray(body)) throw new AdminError(400, "bad_request", "The request isn't valid JSON.");
      const action = typeof body.action === "string" ? body.action : "";
      const user = await authorize(req, action); // before any action runs
      if (!Object.prototype.hasOwnProperty.call(ACTIONS, action)) throw new AdminError(400, "bad_request", "Unknown action.");
      const out = await ACTIONS[action](user.id, body);
      return reply(req, 200, Object.assign({ ok: true }, out && typeof out === "object" && !Array.isArray(out) ? out : { result: out }));
    } catch (e) {
      if (e instanceof AdminError) return reply(req, e.status, { ok: false, error: e.code, message: e.message });
      log.warn("admin: unexpected", e && e.name);
      return reply(req, 500, { ok: false, error: "server_error", message: "Something went wrong on the server." });
    }
  };
}
