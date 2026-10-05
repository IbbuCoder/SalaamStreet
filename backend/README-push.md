# SalaamStreet — Reminders when the app is closed (2.8)

Prayer, Friday Al-Kahf and morning/evening adhkar reminders normally only
fire while SalaamStreet is open. With this set up, people can turn on
**Settings → Prayer reminders → Also remind me when SalaamStreet is closed**,
and reminders arrive as real notifications, on:

- **iPhone / iPad** (iOS 16.4+), only when SalaamStreet is **added to the Home Screen**
- **Android**, **Windows, Mac, ChromeOS, Linux** (Chrome, Edge, Firefox; Safari 16+ on Mac)

Until step 5 is done, the option is hidden and nothing changes for anyone.

## How it works

1. A device that opts in subscribes to Web Push and calls `push_register`
   with its push address, location **rounded to ~1 km**, time zone and
   reminder choices. No account is needed; guests can use it.
2. Every 5 minutes, Postgres (`pg_cron`) calls the `send-reminders` Edge
   Function. It works out each device's prayer times with the **same
   calculator the app uses offline** (`js/praytimes.js`, copied next to it)
   and sends whatever is due, once. "I prayed" on the notification ticks the
   prayer in the tracker.
3. Turning the option off (or the browser dropping the subscription) deletes
   the row.

Nobody can read the `push_subscriptions` table through the API — only the
function (service role) does.

## Setup (about 15 minutes)

You need the [Supabase CLI](https://supabase.com/docs/guides/cli) and Node.

### 1. Database
Re-run `backend/supabase-schema.sql` in **SQL Editor** (safe to re-run). It adds
`push_subscriptions`, `push_register` and `push_unregister`.

### 2. Keys (VAPID)
```bash
npx web-push generate-vapid-keys
```
Keep the **private key secret** — it goes only into Supabase (step 3).

### 3. Secrets and the function
```bash
supabase link --project-ref <your-project-ref>
supabase secrets set VAPID_PUBLIC_KEY=<public key> VAPID_PRIVATE_KEY=<private key> \
  VAPID_SUBJECT=mailto:<your email> CRON_SECRET=<any long random string>
supabase functions deploy send-reminders --no-verify-jwt
```
(Run from `backend/`, or copy `backend/functions/send-reminders` into your
Supabase project's `supabase/functions/`.)

### 4. Run it every 5 minutes
**Database → Extensions**: turn on `pg_cron` and `pg_net`. Then in **SQL Editor**:
```sql
select cron.schedule('salaamstreet-reminders', '*/5 * * * *', $$
  select net.http_post(
    url := 'https://<your-project-ref>.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object('Authorization', 'Bearer <CRON_SECRET>')
  );
$$);
```

### 5. Switch it on in the app
Put the **public** key in `js/config.js`:
```js
pushPublicKey: "<public key>",
```
Commit and publish. The option appears in Settings → Prayer reminders.

## Keeping it in step
After changing `js/praytimes.js` or reminder texts in `js/i18n.js` / `js/lang/`:
```bash
node tools/build-push-messages.js
supabase functions deploy send-reminders --no-verify-jwt
```
`tests/push.test.js` fails if the copies are out of date.

## Check it's working
- **Edge Functions → send-reminders → Logs**: each run returns `{ sent, removed, failed }`.
- **Table editor → push_subscriptions**: one row per device that opted in.
- To stop everything: `select cron.unschedule('salaamstreet-reminders');`
