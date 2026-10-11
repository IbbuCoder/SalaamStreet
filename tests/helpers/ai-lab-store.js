/* The AI Testing Lab's store (see backend/functions/ai-lab/index.ts) over a
   real Postgres (PGlite) running backend/supabase-schema.sql — the same
   queries the Edge Function makes with the service role. getUser is given by
   the test: it stands in for Supabase Auth checking the session token. */
"use strict";
const fs = require("fs");
const path = require("path");

const SQL = fs.readFileSync(path.join(__dirname, "..", "..", "backend", "supabase-schema.sql"), "utf8");

async function aiDb() {
  const { PGlite } = await import("@electric-sql/pglite");
  const pg = new PGlite();
  await pg.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create schema auth;
    create table auth.users (id uuid primary key, email text, phone text, raw_user_meta_data jsonb default '{}'::jsonb);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create publication supabase_realtime;
    grant usage on schema public, auth to authenticated, anon, service_role;
    grant execute on function auth.uid() to authenticated, anon;
  `);
  await pg.exec(SQL);
  // Supabase grants table privileges to these roles by default; the schema must take them away.
  await pg.exec("grant select, insert, update, delete on all tables in schema public to authenticated, anon;");
  await pg.exec(SQL); // re-running the file is how projects upgrade
  return pg;
}

function pgStore(pg, getUser) {
  // One statement at a time, as the service role (like the Edge Function).
  let queue = Promise.resolve();
  function q(sql, params) {
    const run = queue.then(async () => {
      await pg.exec("set role service_role;");
      try { return await pg.query(sql, params); } finally { await pg.exec("reset role;"); }
    });
    queue = run.catch(() => {});
    return run;
  }
  return {
    getUser: async (token) => getUser(token),
    settings: async () => (await q("select * from public.ai_settings where id")).rows[0],
    updateSettings: async (patch, uid) => {
      const keys = Object.keys(patch);
      const sets = keys.map((k, i) => `${k} = $${i + 1}`).concat([`updated_at = now()`, `updated_by = $${keys.length + 1}`]);
      return (await q(`update public.ai_settings set ${sets.join(", ")} where id returning *`, keys.map((k) => patch[k]).concat([uid]))).rows[0];
    },
    reserve: async (uid, kind) => (await q("select public.ai_reserve($1, $2) as r", [uid, kind])).rows[0].r,
    finish: async (id, patch) => {
      const keys = Object.keys(patch);
      await q(`update public.ai_usage set ${keys.map((k, i) => `${k} = $${i + 1}`).join(", ")} where id = $${keys.length + 1}`, keys.map((k) => patch[k]).concat([id]));
    },
    summary: async () => (await q("select public.ai_usage_summary() as r")).rows[0].r,
    logRefusal: async (uid, event, detail) => { await q("insert into public.ai_security_log (user_id, event, detail) values ($1, $2, $3)", [uid, event, detail]); },
  };
}

/** A stand-in for Gemini's REST API. Set `next` to shape the reply. */
function fakeGemini() {
  const calls = [];
  const g = {
    calls,
    next: null, // { status, json } | "network" | "hang"
    fetch: async (url, init) => {
      calls.push({ url: String(url), method: init.method, headers: init.headers, body: init.body ? JSON.parse(init.body) : null });
      const n = g.next;
      g.next = null;
      if (n === "network") throw new TypeError("fetch failed");
      if (n === "hang") {
        return new Promise((_, reject) => init.signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))));
      }
      if (n) return new Response(JSON.stringify(n.json || {}), { status: n.status || 200 });
      if (/:generateContent$/.test(url)) {
        const asked = init.body ? JSON.parse(init.body).contents.slice(-1)[0].parts[0].text : "";
        return new Response(JSON.stringify({
          candidates: [{ content: { role: "model", parts: [{ text: "Test reply to: " + asked }] }, finishReason: "STOP" }],
          usageMetadata: { promptTokenCount: 1000, candidatesTokenCount: 200, thoughtsTokenCount: 100, totalTokenCount: 1300 },
          modelVersion: "fake-model-001",
        }), { status: 200 });
      }
      return new Response(JSON.stringify({ name: "models/x", displayName: "Fake Gemini", inputTokenLimit: 1048576, outputTokenLimit: 65536 }), { status: 200 });
    },
  };
  return g;
}

module.exports = { aiDb, pgStore, fakeGemini };
