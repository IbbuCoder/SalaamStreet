// SalaamStreet — send-reminders (Supabase Edge Function, Deno)
// Called every 5 minutes by pg_cron (see backend/README-push.md). For every
// device that turned on "reminders when SalaamStreet is closed", it works out
// that device's prayer times (same calculator as the app), sends any reminder
// that is due as a Web Push notification, and remembers what it sent so
// nothing arrives twice. Devices whose push address has expired are removed.
//
// Secrets (supabase secrets set …): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY,
// VAPID_SUBJECT (mailto:you@example.com), CRON_SECRET.
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";
import "./praytimes.js"; // sets globalThis.SS.praytimes
import messages from "./messages.json" with { type: "json" };
import { dueReminders } from "./due.js";

// deno-lint-ignore no-explicit-any
const pt = (globalThis as any).SS.praytimes;

webpush.setVapidDetails(
  Deno.env.get("VAPID_SUBJECT") ?? "mailto:hello@salaamstreet.com",
  Deno.env.get("VAPID_PUBLIC_KEY")!,
  Deno.env.get("VAPID_PRIVATE_KEY")!,
);

Deno.serve(async (req) => {
  if (req.headers.get("authorization") !== `Bearer ${Deno.env.get("CRON_SECRET")}`) {
    return new Response("forbidden", { status: 403 });
  }
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
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
