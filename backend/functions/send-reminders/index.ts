// SalaamStreet — send-reminders (Supabase Edge Function, Deno)
// Called every 5 minutes by pg_cron (see backend/README-push.md). For every
// device that turned on "reminders when SalaamStreet is closed", it works out
// that device's prayer times (same calculator as the app), sends any reminder
// that is due as a Web Push notification, and remembers what it sent so
// nothing arrives twice. Devices whose push address has expired are removed.
//
// Keys: kept in the public.push_keys table, which only this server can read.
// The VAPID key pair is made here on the first run (keys.js), so nobody has
// to copy a private key anywhere; the schedule's secret is random. Secrets
// VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / CRON_SECRET, if set, take precedence.
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";
import "./praytimes.js"; // sets globalThis.SS.praytimes
import messages from "./messages.json" with { type: "json" };
import { dueReminders } from "./due.js";
import { generateVapidKeys } from "./keys.js";

// deno-lint-ignore no-explicit-any
const pt = (globalThis as any).SS.praytimes;
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

type Keys = { vapid_public: string | null; vapid_private: string | null; cron_secret: string };
async function loadKeys(): Promise<Keys> {
  const { data, error } = await db.from("push_keys").select("vapid_public, vapid_private, cron_secret").eq("id", true).single();
  if (error || !data) throw new Error("push_keys missing: run backend/supabase-schema.sql");
  return data as Keys;
}
/** Make the VAPID pair once. If two runs race, the first one's keys win. */
async function ensureVapid(k: Keys): Promise<Keys> {
  if (k.vapid_public && k.vapid_private) return k;
  const made = await generateVapidKeys();
  await db.from("push_keys").update({ vapid_public: made.publicKey, vapid_private: made.privateKey })
    .eq("id", true).is("vapid_public", null);
  return loadKeys();
}

Deno.serve(async (req) => {
  let keys: Keys;
  try { keys = await loadKeys(); } catch (e) { return new Response((e as Error).message, { status: 500 }); }
  const secret = Deno.env.get("CRON_SECRET") || keys.cron_secret;
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("forbidden", { status: 403 });
  }
  keys = await ensureVapid(keys);
  webpush.setVapidDetails(
    Deno.env.get("VAPID_SUBJECT") ?? "mailto:hello@salaamstreet.com",
    Deno.env.get("VAPID_PUBLIC_KEY") || keys.vapid_public!,
    Deno.env.get("VAPID_PRIVATE_KEY") || keys.vapid_private!,
  );
  const now = Date.now();
  let sent = 0, removed = 0, failed = 0, from = 0;
  const PAGE = 500;
  for (;;) {
    const { data: subs, error } = await db.from("push_subscriptions").select("*").range(from, from + PAGE - 1);
    if (error) return new Response(error.message, { status: 500 });
    if (!subs || !subs.length) break;
    await Promise.all(subs.map(async (sub) => {
      let due;
      try { due = dueReminders(sub, now, pt, messages); } catch (_) { failed++; return; }
      if (!due.send.length) return;
      const target = { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } };
      for (const msg of due.send) {
        try {
          await webpush.sendNotification(target, JSON.stringify(msg), { TTL: 30 * 60, urgency: "high", topic: msg.tag.slice(-32).replace(/[^A-Za-z0-9_-]/g, "") });
          sent++;
        } catch (e) {
          // deno-lint-ignore no-explicit-any
          const code = (e as any)?.statusCode;
          if (code === 404 || code === 410) {
            await db.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
            removed++;
            return;
          }
          failed++;
        }
      }
      await db.from("push_subscriptions").update({ sent: due.sent }).eq("endpoint", sub.endpoint);
    }));
    if (subs.length < PAGE) break;
    from += PAGE;
  }
  return Response.json({ sent, removed, failed });
});
