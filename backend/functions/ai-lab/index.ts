// SalaamStreet — ai-lab (Supabase Edge Function, Deno)
// The private AI Testing Lab's backend: the admin's real Gemini conversations.
// All the checks live in core.js (shared with the tests); this file connects
// them to Supabase. See backend/README-ai.md for setup.
//
// Secrets (supabase secrets set …): GEMINI_API_KEY (required).
// Optional: AI_DISABLED=true (emergency off), AI_ADMIN_EMAIL_SHA256,
// AI_ALLOWED_ORIGINS, AI_TIMEOUT_MS.
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
import { createClient } from "npm:@supabase/supabase-js@2";
import { createHandler } from "./core.js";

const url = Deno.env.get("SUPABASE_URL") ?? "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

function must<T>(r: { data: T; error: { message: string } | null }): T {
  if (r.error) throw new Error("database");
  return r.data;
}

const store = {
  // Supabase Auth checks the token's signature and expiry and returns the user.
  async getUser(token: string) {
    const { data, error } = await db.auth.getUser(token);
    return error ? null : data.user;
  },
  async settings() { return must(await db.from("ai_settings").select("*").eq("id", true).single()); },
  async updateSettings(patch: Record<string, unknown>, userId: string) {
    return must(await db.from("ai_settings").update({ ...patch, updated_at: new Date().toISOString(), updated_by: userId })
      .eq("id", true).select("*").single());
  },
  async reserve(userId: string, kind: string) { return must(await db.rpc("ai_reserve", { p_user: userId, p_kind: kind })); },
  async finish(id: number, patch: Record<string, unknown>) { must(await db.from("ai_usage").update(patch).eq("id", id)); },
  async summary() { return must(await db.rpc("ai_usage_summary")); },
  async logRefusal(userId: string | null, event: string, detail: string | null) {
    must(await db.from("ai_security_log").insert({ user_id: userId, event, detail }));
  },
};

const handle = createHandler({ env: (k: string) => Deno.env.get(k), fetch, store, log: console });

Deno.serve((req) => {
  if (!url || !serviceKey) {
    return Response.json({ ok: false, error: "not_configured", message: "Supabase isn't configured for this function." }, { status: 503 });
  }
  return handle(req);
});
