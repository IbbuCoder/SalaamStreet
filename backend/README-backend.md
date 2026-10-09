# SalaamStreet — Accounts backend (Supabase)

**Update 2.5 — Accounts + Guest Mode.** Accounts are optional and free. The
website is fully client-side and works completely without them (guest mode):
everything lives in the browser's `localStorage`. People who sign in get their
bookmarks, streaks, Qur'an progress and settings synced across their devices.

Accounts use [Supabase](https://supabase.com) — Postgres + Auth + an
auto-generated REST API, with no server to run — so the site stays a static
site on GitHub Pages.

> Until `js/config.js` has your project URL and key, the site runs in guest
> mode only and the Account page says sign-in isn't available yet. Nothing
> breaks.

---

## What you need to set up (checklist)

| # | Where | What |
|---|---|---|
| 1 | Supabase | Create a project; run `supabase-schema.sql` |
| 2 | `js/config.js` | Paste the Project URL and anon/publishable key |
| 3 | Supabase → Auth → URL Configuration | Site URL + redirect URLs |
| 4 | Supabase → Auth → Providers → **Email** | On; change the email template to include the code |
| 5 | Supabase → Auth → Providers → **Phone** | On; connect an SMS provider (Twilio, MessageBird, Vonage or Textlocal) |
| 6 | Google Cloud Console + Supabase | OAuth client for **Continue with Google** |
| 7 | Apple Developer + Supabase | Services ID + key for **Continue with Apple** |
| 8 | Supabase → Auth → Providers (top) | Turn on **Manual linking** (lets people add Google/Apple/phone/email to an existing account) |
| 9 | Supabase → Auth → Rate limits / Attack protection | Review OTP limits; consider CAPTCHA |

Any method you haven't set up yet can be hidden by removing it from
`signInMethods` in `js/config.js`. If someone does tap a method that isn't
enabled, they see "This sign-in method isn't switched on yet" — never a crash.

---

## 1. Create the project and tables

1. Sign up at <https://supabase.com> and create a project (the free tier is plenty to start).
2. **SQL Editor** → paste all of `supabase-schema.sql` → **Run**. It is safe to re-run.

This creates:

- `profiles` — one row per account (display name), created automatically on sign-up.
- `sync_records` — everything that syncs, as small records (one per bookmark, per
  setting, per day of the prayer log, …). Newest write wins per record; deletions
  are kept as tombstones so they reach other devices.
- `sync_push(items)` — uploads a batch and returns any rows where the server
  already had a newer copy, so the device can merge them.
- `delete_account()` — lets a signed-in person delete their own account
  (profile and synced data cascade).
- Row-Level Security on both tables: each person can only read or write their
  own rows. Realtime is enabled on `sync_records` so devices update instantly.

**3.0 — Family & Kids Mode.** The same file also creates, with Row-Level
Security on each:

- `family_children` — a parent's child profiles (first name or nickname, age
  range, avatar, which sections are on, two switches). Parents can read only
  their own; all writes go through functions.
- `child_progress`, `child_achievements` — each child's learning; achievements
  are awarded by the database from progress.
- `child_devices`, `child_pair_codes` — SHA-256 hashes of each device token and
  each one-time pairing code. Nobody can read these tables through the API.
- `family_*()` functions for the signed-in parent (list, save, delete, detail,
  reset, pairing code, "use on this device", remove a device) and `kid_*()`
  functions for a child's device (pair, session, progress, save, unpair). The
  kid functions are callable without an account but only act for the one child
  whose token is passed, and refuse progress in sections the parent switched
  off. `tests/family.test.js` checks all of this in a real Postgres.

**Upgrading an existing project to 3.0:** run the whole updated file again in the
SQL Editor. Existing tables and data are untouched; the new tables and
functions are added. Until this is done, the Family page shows an error with
"Try again"; everything else keeps working.

If you created the old pre-2.5 draft tables (`preferences`, `bookmarks`,
`progress`, `favorites`), they are unused — see the comment at the end of the
schema to drop them.

## 2. Connect the website

In **Project Settings → API** copy:

- **Project URL** → `supabaseUrl` in `js/config.js`
- **anon / publishable key** → `supabaseAnonKey` in `js/config.js`

Both are meant to be public — security comes from Row-Level Security.
**Never** put the `service_role` / secret key in the website or the repo.

## 3. URL configuration

**Authentication → URL Configuration**

- **Site URL:** `https://salaamstreet.com`
- **Redirect URLs:** add
  - `https://salaamstreet.com/`
  - `https://salaamstreet.com/index.html`
  - `http://localhost:8080/` (local testing, optional)

Sign-in uses the PKCE flow: after Apple/Google (or an email link) people come
back to the site with a one-time `?code=` that the page exchanges for a session
and then removes from the address bar.

## 4. Email (code + link)

**Authentication → Providers → Email:** enabled. "Confirm email" can stay on.

SalaamStreet asks for a **6-digit code** (works across devices — e.g. the email is
opened on a phone while signing in on a laptop). Supabase's default template
only contains a link, so edit **Authentication → Email Templates → Magic Link**
and include the code, for example:

```html
<h2>Your SalaamStreet sign-in code</h2>
<p>Enter this code in SalaamStreet: <strong>{{ .Token }}</strong></p>
<p>Or tap this link on the same device: <a href="{{ .ConfirmationURL }}">Sign in</a></p>
```

Do the same for **Confirm signup** and **Change Email Address** templates
(the latter is used when a phone-only account adds an email).

For production volume, set up **custom SMTP** (Auth → SMTP Settings); the
built-in mailer is heavily rate-limited.

## 5. Phone (SMS code)

**Authentication → Providers → Phone:** enable it and choose an SMS provider
(Twilio / Twilio Verify, MessageBird, Vonage or Textlocal) with its credentials.
SMS costs money per message — set sensible rate limits (step 9).

Numbers are entered with their country code (`+44 7700 900123`); the site
normalises them to E.164.

## 6. Continue with Google

1. Google Cloud Console → **APIs & Services → Credentials → Create OAuth client ID** → *Web application*.
2. **Authorized JavaScript origins:** `https://salaamstreet.com`
3. **Authorized redirect URIs:** `https://<your-project-ref>.supabase.co/auth/v1/callback`
4. Configure the OAuth consent screen (app name SalaamStreet, logo, privacy policy URL).
5. Supabase → **Authentication → Providers → Google**: paste the Client ID and Client Secret, enable.

## 7. Continue with Apple

1. Apple Developer → **Certificates, Identifiers & Profiles**:
   - an **App ID** with *Sign in with Apple* enabled;
   - a **Services ID** (this is the client ID), with *Sign in with Apple*
     configured: domain `salaamstreet.com`, return URL
     `https://<your-project-ref>.supabase.co/auth/v1/callback`;
   - a **Key** with *Sign in with Apple* enabled (download the `.p8`).
2. Supabase → **Authentication → Providers → Apple**: enter the Services ID,
   Team ID, Key ID and the `.p8` key (Supabase generates the client secret).
   Apple's client secret expires every 6 months — set a reminder to rotate it.

People can choose "Hide My Email" with Apple; that account then has an
@privaterelay.appleid.com address, so it won't auto-link to an existing
email account — they can link Apple from **Account → Sign-in methods** instead.

## 8. Account linking (no duplicate accounts)

- **Automatic:** Supabase links sign-ins that share the same *verified* email
  (e.g. email code, then later Google with the same Gmail) to one account.
- **Manual:** turn on **Authentication → Providers → "Allow manual linking"**.
  Signed-in people can then add Google, Apple, a phone number or an email under
  **Account → Sign-in methods**, and remove extra ones. A method that already
  belongs to a different account is refused with a clear message.

## 9. Abuse protection

- **Authentication → Rate Limits:** keep OTP/SMS limits low (e.g. 30 emails/hour,
  a few SMS per number per hour).
- Consider **Attack Protection → CAPTCHA** (hCaptcha/Turnstile) before going big.

---

## 3.1 — NVHS MSA announcements

**Upgrading to 3.1:** run the whole updated `supabase-schema.sql` again in the
SQL Editor (safe to re-run). Until then the MSA page shows an error with
"Try again" and Home shows no MSA card; everything else keeps working.

The schema adds:

- `msa_posts` — the announcements (title, text, an optional image stored as a
  small data URL, "show on Home", "pinned", an optional end date). Nothing is
  reachable through the table API.
- `msa_admins` — who may post: SHA-256 hashes of lower-cased email addresses,
  never the addresses themselves (this repository is public). The file comes
  with the MSA's four posting accounts already on the list.
- `msa_feed()` and `msa_image(id)` — read by anyone, signed in or not; expired
  posts disappear from both.
- `msa_is_poster()`, `msa_post_save(p)`, `msa_post_delete(id)` — for posters.
  Each checks that the signed-in account's email is on the list; anyone else
  gets "not an MSA poster". At most 30 new posts an hour.

Posters sign in with the account whose email is on the list (Google works for
school Google accounts if the school allows signing in to outside apps; the
emailed code works for any address). Then a **New** button appears on the
MSA page, and **Edit** / **Delete** on each post.

**Add a poster** (SQL Editor):

```sql
insert into public.msa_admins (email_hash)
values (sha256(convert_to(lower('name@example.org'), 'UTF8')));
```

**Remove a poster:** run the same `sha256(...)` expression in a
`delete from public.msa_admins where email_hash = …` statement.

`tests/msa.test.js` checks all of this in a real Postgres.

## How sync works (for maintainers)

- `js/sync.js` is a storage- and backend-agnostic engine. Every write the app
  makes through `SS.store` is diffed into records and stamped with the time it
  changed. Guests are stamped too, so their data can be merged later.
- On sign-in, everything on the device is queued; records never stamped
  (pre-2.5 data) lose ties to the account's existing values, collections
  (bookmarks, logs, favourites) are unioned, streaks keep the best run and
  reading progress keeps the furthest point. Nothing is wiped.
- If the device holds data from a *different* account, the person is asked
  before it's merged.
- Pull is incremental via `server_at`; push goes through `sync_push`. Offline
  changes stay queued (in `localStorage`) and sync when the connection returns.
  Realtime + a 5-minute poll + on-focus sync keep devices in step.
- Location and reminder on/off stay per device by design. So do 3.0 travel
  places, chosen/saved mosques and Kids Mode device tokens; the active mode,
  travel checklist and Hajj/Umrah progress sync.
- The auth session is stored under the `ss-auth` key (outside the app's data
  prefix, so "Export my data" never includes tokens).

Tests: `npm test` runs the sync engine against an in-memory server, this
schema in a real Postgres (PGlite), and end-to-end browser tests that drive the
real supabase-js client against a mock Supabase API.

## Secrets & safety

- The anon key is public by design; security comes from RLS.
- The service_role key lives only in Supabase / server environment variables.
- `.env` files and keys are never committed.
