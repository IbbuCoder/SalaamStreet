// SalaamStreet — admin (Supabase Edge Function, Deno)
// The Admin Panel (3.0.1, #/admin). All the checks live in core.js (shared
// with the tests); this file connects them to Supabase. Every action is a
// public.admin_* database function (backend/supabase-schema.sql), called
// with the service role after core.js has checked the person's session.
//
// Optional secret: ADMIN_ALLOWED_ORIGINS (comma-separated; default
// salaamstreet.com, www, ibbucoder.github.io and the iPhone app).
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
import { createClient } from "npm:@supabase/supabase-js@2";
import { createHandler } from "./core.js";

const url = Deno.env.get("SUPABASE_URL") ?? "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

const store = {
  // Supabase Auth checks the token's signature and expiry and returns the user.
  async getUser(token: string) {
    const { data, error } = await db.auth.getUser(token);
    return error ? null : data.user;
  },
  async rpc(name: string, args: Record<string, unknown>) {
    const { data, error } = await db.rpc(name, args);
    if (error) throw Object.assign(new Error(error.message), { code: error.code });
    return data;
  },
};

const handle = createHandler({ env: (k: string) => Deno.env.get(k), store, log: console });

Deno.serve((req) => {
  if (!url || !serviceKey) {
    return Response.json({ ok: false, error: "not_configured", message: "Supabase isn't configured for this function." }, { status: 503 });
  }
  return handle(req);
});
