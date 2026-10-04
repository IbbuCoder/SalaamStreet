/* A small in-memory stand-in for the parts of Supabase SalaamStreet uses,
   served through Playwright request routing so the REAL supabase-js client
   in the page talks to it over HTTP:
     Auth (GoTrue):  /auth/v1/otp, /verify, /token (pkce, refresh_token),
                     /user (GET, PUT), /logout, /authorize (OAuth redirect),
                     /user/identities/authorize (link), /user/identities/:id
     REST (PostgREST): sync_records (select), profiles (select, upsert),
                     rpc/sync_push, rpc/delete_account
   State is shared by every browser context routed to it — i.e. devices.
   Mirrors backend/supabase-schema.sql semantics (newest write wins). */
"use strict";
const crypto = require("crypto");

const URL_BASE = "https://test.supabase.co";
const b64u = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");

function createMock() {
  const users = new Map(); // id → user
  const rows = []; // sync_records
  const profiles = new Map();
  const codes = new Map(); // `${kind}:${target}` → code (what the "SMS/email" contained)
  const pkce = new Map(); // auth code → { userId, challenge }
  const pendingChange = new Map(); // `${kind}:${target}` → user id (email/phone change in progress)
  const log = [];
  let clock = Date.now();
  const stamp = () => new Date(++clock).toISOString();
  const state = { users, rows, profiles, codes, log, offlineContexts: new Set(), failNext: null };

  function findUser(pred) { for (const u of users.values()) if (pred(u)) return u; return null; }
  function identity(u, provider, data) {
    return { identity_id: crypto.randomUUID(), id: data.sub || u.id, user_id: u.id, provider, identity_data: data,
      created_at: new Date().toISOString(), last_sign_in_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  }
  function newUser(attrs) {
    const u = { id: crypto.randomUUID(), aud: "authenticated", role: "authenticated", email: attrs.email || "", phone: attrs.phone || "",
      app_metadata: { provider: attrs.provider, providers: [attrs.provider] }, user_metadata: attrs.meta || {}, identities: [],
      created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    if (u.email) u.email_confirmed_at = u.created_at;
    if (u.phone) u.phone_confirmed_at = u.created_at;
    u.identities.push(identity(u, attrs.provider, Object.assign({ sub: u.id }, attrs.email ? { email: attrs.email } : {}, attrs.phone ? { phone: attrs.phone } : {})));
    users.set(u.id, u);
    profiles.set(u.id, { id: u.id, display_name: (attrs.meta && (attrs.meta.full_name || attrs.meta.name)) || (attrs.email ? attrs.email.split("@")[0] : null) });
    return u;
  }
  function session(u) {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    return { access_token: b64u({ alg: "HS256", typ: "JWT" }) + "." + b64u({ sub: u.id, exp, role: "authenticated", aud: "authenticated", email: u.email, session_id: crypto.randomUUID() }) + ".sig",
      token_type: "bearer", expires_in: 3600, expires_at: exp, refresh_token: "r-" + u.id + "-" + crypto.randomUUID(), user: u };
  }
  function userFromAuth(req) {
    const h = req.headers()["authorization"] || "";
    const tok = h.replace(/^Bearer\s+/i, "");
    const parts = tok.split(".");
    if (parts.length !== 3) return null;
    try { return users.get(JSON.parse(Buffer.from(parts[1], "base64url").toString()).sub) || null; } catch (e) { return null; }
  }
  const json = (route, status, body, headers) => route.fulfill({ status, contentType: "application/json", headers: Object.assign({ "access-control-allow-origin": "*" }, headers || {}), body: body === undefined ? "" : JSON.stringify(body) });

  async function handle(route, ctxId) {
    const req = route.request();
    const url = new URL(req.url());
    const method = req.method();
    if (method === "OPTIONS") {
      return route.fulfill({ status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS" } });
    }
    if (state.offlineContexts.has(ctxId)) return route.abort("internetdisconnected");
    let body = {};
    try { body = req.postDataJSON() || {}; } catch (e) { body = {}; }
    const p = url.pathname;
    log.push({ ctx: ctxId, method, path: p, search: url.search, body });
    if (state.failNext && p.indexOf(state.failNext.path) > -1) { const f = state.failNext; state.failNext = null; return json(route, f.status, f.body); }

    /* ── Auth ── */
    if (p === "/auth/v1/otp" && method === "POST") {
      const kind = body.email ? "email" : "phone", target = body.email || body.phone;
      if (kind === "phone" && !/^\+?\d{8,15}$/.test(target)) return json(route, 400, { code: 400, error_code: "validation_failed", msg: "Invalid phone number format" });
      codes.set(kind + ":" + String(target).replace(/^\+/, ""), "123456");
      return json(route, 200, {});
    }
    if (p === "/auth/v1/verify" && method === "POST") {
      const kind = body.email ? "email" : "phone", target = String(body.email || body.phone).replace(/^\+/, "");
      const expected = codes.get(kind + ":" + target);
      if (!expected || body.token !== expected) return json(route, 403, { code: 403, error_code: "otp_expired", msg: "Token has expired or is invalid" });
      codes.delete(kind + ":" + target);
      if (body.type === "phone_change" || body.type === "email_change") {
        // GoTrue finds the user from the pending change the code belongs to.
        const u = users.get(pendingChange.get(kind + ":" + target));
        if (!u) return json(route, 403, { code: 403, error_code: "otp_expired", msg: "Token has expired or is invalid" });
        pendingChange.delete(kind + ":" + target);
        if (kind === "phone") { u.phone = target; u.phone_confirmed_at = new Date().toISOString(); u.identities.push(identity(u, "phone", { sub: u.id, phone: target })); }
        else { u.email = target; u.identities.push(identity(u, "email", { sub: u.id, email: target })); }
        u.app_metadata.providers = [...new Set(u.identities.map((i) => i.provider))];
        return json(route, 200, session(u));
      }
      let u = findUser((x) => (kind === "email" ? x.email === target : x.phone === target));
      if (!u) u = newUser(kind === "email" ? { email: target, provider: "email" } : { phone: target, provider: "phone" });
      return json(route, 200, session(u));
    }
    if (p === "/auth/v1/token" && method === "POST") {
      const grant = url.searchParams.get("grant_type");
      if (grant === "pkce") {
        const c = pkce.get(body.auth_code);
        if (!c) return json(route, 400, { code: 400, error_code: "flow_state_not_found", msg: "invalid flow state" });
        pkce.delete(body.auth_code);
        return json(route, 200, session(users.get(c.userId)));
      }
      if (grant === "refresh_token") {
        const id = String(body.refresh_token || "").slice(2, 38);
        const u = users.get(id);
        return u ? json(route, 200, session(u)) : json(route, 400, { code: 400, error_code: "refresh_token_not_found", msg: "Invalid Refresh Token" });
      }
    }
    if (p === "/auth/v1/authorize" && method === "GET") {
      // OAuth: pretend the person approved at Google/Apple and send them back.
      const provider = url.searchParams.get("provider");
      const redirect = url.searchParams.get("redirect_to");
      const email = provider + "-user@example.com";
      let u = findUser((x) => x.email === email);
      const linkFor = url.searchParams.get("link_user");
      if (linkFor) {
        u = users.get(linkFor);
        u.identities.push(identity(u, provider, { sub: provider + "-sub", email }));
        u.app_metadata.providers = [...new Set(u.identities.map((i) => i.provider))];
      } else if (!u) u = newUser({ email, provider, meta: { full_name: provider === "google" ? "Google Person" : "Apple Person" } });
      const code = crypto.randomUUID();
      pkce.set(code, { userId: u.id });
      const back = new URL(redirect);
      back.searchParams.set("code", code);
      return route.fulfill({ status: 302, headers: { location: back.toString() } });
    }
    if (p === "/auth/v1/user/identities/authorize" && method === "GET") {
      const u = userFromAuth(req);
      if (!u) return json(route, 401, { msg: "unauthorized" });
      const target = new URL(URL_BASE + "/auth/v1/authorize");
      target.searchParams.set("provider", url.searchParams.get("provider"));
      target.searchParams.set("redirect_to", url.searchParams.get("redirect_to"));
      target.searchParams.set("link_user", u.id);
      return json(route, 200, { url: target.toString() });
    }
    if (p.indexOf("/auth/v1/user/identities/") === 0 && method === "DELETE") {
      const u = userFromAuth(req);
      const id = p.split("/").pop();
      if (!u) return json(route, 401, {});
      if (u.identities.length < 2) return json(route, 422, { code: 422, error_code: "single_identity_not_deletable", msg: "User must have at least 1 identity after unlinking" });
      u.identities = u.identities.filter((i) => i.identity_id !== id);
      return json(route, 200, {});
    }
    if (p === "/auth/v1/user" && method === "GET") {
      const u = userFromAuth(req);
      return u ? json(route, 200, u) : json(route, 401, { code: 401, error_code: "bad_jwt", msg: "invalid JWT" });
    }
    if (p === "/auth/v1/user" && method === "PUT") {
      const u = userFromAuth(req);
      if (!u) return json(route, 401, {});
      if (body.phone) { const k = "phone:" + String(body.phone).replace(/^\+/, ""); codes.set(k, "123456"); pendingChange.set(k, u.id); }
      if (body.email) { codes.set("email:" + body.email, "123456"); pendingChange.set("email:" + body.email, u.id); }
      return json(route, 200, u);
    }
    if (p === "/auth/v1/logout") return route.fulfill({ status: 204, headers: { "access-control-allow-origin": "*" } });

    /* ── REST ── */
    const u = userFromAuth(req);
    if (p.indexOf("/rest/v1/") === 0 && !u) return json(route, 401, { code: "PGRST301", message: "JWT required" });
    if (p === "/rest/v1/rpc/sync_push") {
      const rejected = [];
      for (const it of body.items || []) {
        const cur = rows.find((r) => r.user_id === u.id && r.col === it.col && r.key === it.key);
        if (!cur || it.t >= cur.t) {
          const row = { user_id: u.id, col: it.col, key: it.key, value: it.deleted ? null : it.value, t: it.t, deleted: !!it.deleted, server_at: stamp() };
          if (cur) Object.assign(cur, row); else rows.push(row);
        } else rejected.push(Object.assign({}, cur));
      }
      return json(route, 200, rejected);
    }
    if (p === "/rest/v1/rpc/delete_account") {
      users.delete(u.id); profiles.delete(u.id);
      for (let i = rows.length - 1; i >= 0; i--) if (rows[i].user_id === u.id) rows.splice(i, 1);
      return route.fulfill({ status: 204, headers: { "access-control-allow-origin": "*" } });
    }
    if (p === "/rest/v1/sync_records" && method === "GET") {
      let out = rows.filter((r) => r.user_id === u.id);
      const gt = url.searchParams.get("server_at");
      if (gt && gt.indexOf("gt.") === 0) out = out.filter((r) => r.server_at > gt.slice(3));
      out.sort((a, b) => (a.server_at < b.server_at ? -1 : 1));
      const off = +(url.searchParams.get("offset") || 0), lim = +(url.searchParams.get("limit") || 1000);
      return json(route, 200, out.slice(off, off + lim).map((r) => ({ col: r.col, key: r.key, value: r.value, t: r.t, deleted: r.deleted, server_at: r.server_at })));
    }
    if (p === "/rest/v1/profiles") {
      if (method === "GET") { const pr = profiles.get(u.id); return json(route, 200, pr ? [{ display_name: pr.display_name }] : []); }
      if (method === "POST") { profiles.set(u.id, Object.assign({}, profiles.get(u.id), body, { id: u.id })); return json(route, 201, []); }
    }
    return json(route, 404, { message: "mock: no route for " + method + " " + p });
  }

  let nextCtx = 1;
  return {
    state,
    URL_BASE,
    /** Route a browser context (a "device") to this mock. Returns its id. */
    async attach(context) {
      const id = nextCtx++;
      await context.route(URL_BASE + "/**", (route) => handle(route, id));
      // Realtime: there's no websocket server here; polling/"Sync now" covers it.
      await context.routeWebSocket(/test\.supabase\.co/, (ws) => ws.close());
      return id;
    },
    rowsFor(email) {
      const u = findUser((x) => x.email === email);
      return u ? rows.filter((r) => r.user_id === u.id) : [];
    },
    userByEmail(email) { return findUser((x) => x.email === email); },
  };
}

module.exports = { createMock, URL_BASE };
