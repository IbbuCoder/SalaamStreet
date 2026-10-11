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

## Setup

Already done for salaamstreet.com (October 2026). For a new project:

### 1. Database
Run `backend/supabase-schema.sql` in **SQL Editor** (safe to re-run). It adds
`push_subscriptions`, `push_register`, `push_unregister` and `push_keys`.

### 2. The function
Deploy `backend/functions/send-reminders` with JWT verification **off** (the
schedule authenticates with its own secret):
```bash
supabase functions deploy send-reminders --no-verify-jwt
```
No secrets to set: on its first run the function makes its own VAPID key
pair and stores it in `public.push_keys`, which only the server can read.
The schedule's secret is made randomly by the database. (If you prefer, the
`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and `CRON_SECRET` secrets still take
precedence.)

### 3. Run it every 5 minutes
Turn on `pg_cron` and `pg_net` (**Database → Extensions**), then in **SQL Editor**
(put your project's URL in):
```sql
select cron.schedule('salaamstreet-reminders', '*/5 * * * *', $job$
  select net.http_post(
    url := 'https://<your-project-ref>.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (select cron_secret from public.push_keys where id)),
    timeout_milliseconds := 30000
  );
$job$);
```
The secret is read from the table each time, so it never appears in the job.

### 4. Switch it on in the app
After the first run, copy the **public** key into `js/config.js`:
```sql
select vapid_public from public.push_keys;
```
```js
pushPublicKey: "<that public key>",
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
