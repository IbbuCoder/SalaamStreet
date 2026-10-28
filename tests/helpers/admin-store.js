/* The Admin Panel's store (see backend/functions/admin/index.ts) over a real
   Postgres (PGlite) running backend/supabase-schema.sql, with the parts of
   Supabase Auth it touches (auth.users with its sign-in columns,
   auth.sessions) stubbed. rpc() works like supabase-js .rpc(): named
   arguments, and it rejects with Postgres' code and message. */
"use strict";
const fs = require("fs");
const path = require("path");

const SQL = fs.readFileSync(path.join(__dirname, "..", "..", "backend", "supabase-schema.sql"), "utf8");

async function adminDb(before) {
  const { PGlite } = await import("@electric-sql/pglite");
  const pg = new PGlite();
  await pg.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create schema auth;
    create table auth.users (id uuid primary key, email text, phone text, raw_user_meta_data jsonb default '{}'::jsonb,
      raw_app_meta_data jsonb default '{}'::jsonb, created_at timestamptz default now(), last_sign_in_at timestamptz,
      email_confirmed_at timestamptz, phone_confirmed_at timestamptz, banned_until timestamptz);
    create table auth.sessions (id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete cascade);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create publication supabase_realtime;
    grant usage on schema public, auth to authenticated, anon, service_role;
    grant select, update, delete on auth.users, auth.sessions to service_role;
    grant execute on function auth.uid() to authenticated, anon;
  `);
  await pg.exec(SQL);
  if (before) await before(pg); // e.g. accounts that existed before the file ran again
  await pg.exec(SQL); // re-running the file is how projects upgrade
  return pg;
}

function adminStore(pg, getUser) {
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
    getUser: async (t) => getUser(t),
    rpc: async (name, args) => {
      const keys = Object.keys(args);
      try {
        const r = await q(`select public.${name}(${keys.map((k, i) => `${k} => $${i + 1}`).join(", ")}) as r`, keys.map((k) => {
          const v = args[k];
          return v !== null && typeof v === "object" ? JSON.stringify(v) : v;
        }));
        return r.rows[0].r;
      } catch (e) { throw Object.assign(new Error(e.message), { code: e.code }); }
    },
  };
}

module.exports = { adminDb, adminStore };
