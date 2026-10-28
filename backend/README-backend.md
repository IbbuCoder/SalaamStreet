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

**2.10 — Family & Kids Mode.** The same file also creates, with Row-Level
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

**Upgrading an existing project to 2.10:** run the whole updated file again in the
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
opened on a phone while signing in on a laptop), so every email shows the code.
Branded templates for all 13 emails Supabase sends (6 sign-in emails and 7
security alerts) live in `backend/email-templates/`, built from one layout by
`node tools/build-email-templates.js`. Subjects and which Supabase row each
file goes in are in that script (`EMAILS`).

Install them either way:
- **GitHub:** Actions → **Deploy Supabase** → Run workflow (sends `templates.json`,
  which also switches the security alerts on).
- **By hand:** Authentication → **Emails** → each row → paste the subject and
  body → Save; switch on the security alerts you want.

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

## 2.11 — NVHS MSA announcements

**Upgrading to 2.11:** run the whole updated `supabase-schema.sql` again in the
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

## 2.11.6 — NVHS MSA membership

**Upgrading to 2.11.6:** run the whole updated `supabase-schema.sql` again in the
SQL Editor (safe to re-run). Until then, joining and the Manage page show
errors; announcements keep working.

- `msa_approvers` — who approves members and sees the meeting code (hashes of
  emails, like `msa_admins`). The file comes with the MSA's approver on it.
- `msa_roster` — the MSA's member list. The approver pastes it on the MSA
  page → **Manage**; it is stored only here, never in the code.
- `msa_members` — one row per account: the name they typed, `pending`,
  `approved`, `flagged` or `denied`, how they joined, and (when approved)
  until when — the next 1 July. Only one approved account per name.
- The meeting code is derived from a random secret in `msa_secret` and the
  current 10-minute window, so it changes every 10 minutes and only the
  approver's page shows it. Five wrong codes in 15 minutes lock that account
  out of code joining for a while.
- `msa_posts.members_only` — the feed and images leave these out for anyone
  who isn't an approved member, a poster or the approver.

**Add an approver:**

```sql
insert into public.msa_approvers (email_hash)
values (sha256(convert_to(lower('name@example.org'), 'UTF8')));
```

## 2.11.7 — School accounts join automatically

**Upgrading to 2.11.7:** run the whole updated `supabase-schema.sql` again (safe to re-run).

NVHS school emails are `<first name><first 3 letters of last name><4 digits>@k12.ipsd.org`.
When someone signs in with a **confirmed** school email (the emailed code
confirms it; the school blocks Google sign-in for these accounts) and it fits
exactly one roster name, `msa_status()` makes them a member at once
(`via = 'school'`), under the roster's spelling of the name. Names with more
than two parts or hyphens are matched on any part of the last name
(`msa_email_keys`). An address that fits two roster names waits for the
approver. If another account had claimed the name, it is flagged.

The roster is loaded the same way as before (MSA → Manage → Edit the list),
or with a one-time SQL insert that is **not** kept in this repository.

## 3.0.4 — MSA announcements for members only

Run the updated `supabase-schema.sql` again. `msa_feed` / `msa_image` now answer
only `msa_can_see_all()` (approved members, MSA admins, the approver; never a
banned account). Details: [`docs/release-notes/3.0.4.md`](../docs/release-notes/3.0.4.md).

## 3.0.3 — Banned people can sign in

**Upgrading to 3.0.3:** run the whole updated `supabase-schema.sql` again and
deploy `ai-lab` (GitHub → Actions → "Deploy Supabase").

- A ban lives only in `account_bans`; Supabase Auth's `banned_until` isn't
  set (and is cleared for earlier bans), so banned people can sign in.
- `am_blocked()` reads `account_bans`: sync policies, `msa_my_email()` and new
  triggers on `msa_members` / `msa_posts` refuse a banned account;
  `account_is_banned(user)` lets `ai-lab` refuse it.
- `account_appeal(text)` is for the signed-in account; `account_notice` and
  the token lookup are removed. `account_status()` includes `strict` (a ban
  for an offensive name or email: the app shows only the ban).
- Details: [`docs/release-notes/3.0.3.md`](../docs/release-notes/3.0.3.md).

## 3.0.2 — Community Rules, bans people can see, appeals

**Upgrading to 3.0.2:** run the whole updated `supabase-schema.sql` again
(safe to re-run), then deploy `admin` and `ai-lab` again (GitHub → Actions →
"Deploy Supabase"). No new secrets.

- New tables: `account_bans` (reason, message shown to the person, private
  note, until), `account_warnings`, `account_appeals`, `blocked_emails`,
  `app_notice`; `profiles.rules_version` / `rules_accepted_at`.
- `am_blocked()` (banned, or a session an admin ended) is part of the
  `sync_records` / `profiles` policies and of `msa_my_email()`, so a ban or
  "sign out everywhere" works at once. `ai-lab` refuses banned accounts too.
- For the person: `account_status()` (signed in), `account_notice(token)` and
  `account_appeal(token, text)` (signed out; the token is the device's saved
  sign-in token, looked up in `auth.refresh_tokens`), `account_warning_seen`,
  `account_accept_rules`, `app_notice_get()`.
- Bans keep the account's sign-in tokens (so its device can prove who it was
  to read the ban); Supabase Auth refuses to refresh them while banned.
- A blocked email can't make an account (trigger on `auth.users`).
- Details: [`docs/release-notes/3.0.2.md`](../docs/release-notes/3.0.2.md).

## 3.0.1 — Admin Panel

**Upgrading to 3.0.1:** run the whole updated `supabase-schema.sql` again
(safe to re-run), then deploy the new `admin` Edge Function (and `ai-lab`
again, which now also accepts the iPhone app). GitHub → Actions → "Deploy
Supabase" → Run workflow does all of it (`deploy_admin` is on by default).
No new secrets.

**Opening it:** sign in with the owner's **Google** account, then More (or the
sidebar) → **Admin Panel** (shown only to admins — on the website and in the iPhone app),
or go to `salaamstreet.com/#/admin`. `#/admin/user/<account id>` opens one
account directly.

**What's in it**

| Tab | What it does |
|---|---|
| Overview | Accounts, new today / 7 days, signed in today / 7 / 30 days, never signed in, banned, admins; sign-ups for the last 14 days; sign-in methods; synced items, reminder devices, Family children, MSA members; SalaamStreet AI today; the 5 newest accounts; a banner when anything is flagged |
| Users | Search (email, phone, name or account id) and filter (flagged, banned, new, never signed in, unconfirmed, admins), 50 at a time. Opening an account shows its sign-in methods, dates, synced-item count, Family children, MSA membership, SalaamStreet AI use (questions, ratings, warnings, Terms) and its history in the log — counts only, never AI conversations, bookmarks or notes |
| — actions on an account | **Ban** (1, 7 or 30 days, or until unbanned; signs them out everywhere and stops them signing in), **Unban**, **Sign out everywhere**, **Flag / Dismiss flag**, **Pause / Restore SalaamStreet AI**, **Delete** (the account and everything that belongs to it; type its email to confirm). Never on your own account or another admin's |
| Flags | Accounts waiting for review (with Ban / It's fine), SalaamStreet AI warnings and pauses, recently reviewed flags, and **sign-up screening**: the word list (masked until you press Show words; add or remove words) and the switch to **refuse** matching sign-ups instead of only flagging them |
| AI | SalaamStreet AI's emergency switch, open/closed, questions per person per day and per day overall, and usage. Model, prices and the test chat stay in the AI Testing Lab (`#/lab`) |
| MSA | NVHS MSA members, waiting, admins, roster and the latest 30 announcements, with **Take down** for emergencies |
| Admins | Who can open the panel. Add by email (they must sign in with Google using it); remove. You can't remove yourself or the last admin |
| Log | Every admin action — who (masked), when, which account (masked email, kept after deletion), details — plus refused attempts by non-admins. Kept 2 years |

**How it's protected**

- The page (`js/admin.js`) is only a view. Every request goes to the `admin`
  Edge Function (`backend/functions/admin`) with the person's own session
  token. The function asks Supabase Auth who it is, requires a confirmed
  email signed in with **Google** (like the AI Testing Lab — so nobody can make
  a password account in an admin's name), and checks the email's SHA-256
  against `public.app_admins`.
- Every action is a `public.admin_*` database function that checks the admin
  list again itself and writes to `public.admin_audit`. None of them, and none
  of the new tables, can be reached with the website's public key.
- The owner (`ibrahim.asim.contact@gmail.com`, stored only as a hash) is the
  first admin. More are added on the Admins tab, or in SQL:
  `insert into public.app_admins (email_hash) values (sha256(convert_to(lower('name@gmail.com'), 'UTF8')));`
- **Sign-up screening** (`admin_screen_user`, a trigger on `auth.users`):
  the part of the email before the @ and the name from Google or Apple are
  lower-cased, stripped to letters, with look-alikes undone (1→i, 0→o, 3→e,
  4→a, 5→s, 7→t, @→a, $→s), then checked for any listed word. A match is
  flagged — or, with "Refuse matching sign-ups" on, the sign-up fails with
  "This email address or name can't be used on SalaamStreet." Accounts made
  before 3.0.1 are checked once when the schema runs. Words match anywhere
  inside, so avoid ones that hide in ordinary names (the starter list leaves
  out "paki" and "nazi" for that reason).
- `ADMIN_ALLOWED_ORIGINS` (optional secret) replaces the sites allowed to call
  the function; the default is salaamstreet.com, www, ibbucoder.github.io and
  the iPhone app (`app://salaamstreet`).

## 3.0.0 — The AI update

**Upgrading to 3.0:** run the whole updated `supabase-schema.sql` again (safe
to re-run), then deploy the `ai-lab` Edge Function — GitHub → Actions →
"Deploy Supabase" does both. It adds `ai_usage.rating` and `ai_rate()` (👍/👎
on answers, numbers only), and the function now accepts verified text from
the app (`sources`) and a `rate` action. Details: [`README-ai.md`](README-ai.md#30-verified-text-ratings-out-of-beta).

## 3.0.0-beta — SalaamStreet AI (Beta)

**Upgrading to 3.0 Beta:** run the whole updated `supabase-schema.sql` again
(safe to re-run), then deploy the `ai-lab` Edge Function. Both are done by
GitHub → Actions → "Deploy Supabase". It adds the AI waiting list
(`ai_queue`), the beta switch and each person's daily allowance, and raises the
AI's project-wide limits once. Details: [`README-ai.md`](README-ai.md).

## 2.11.8 — One list of MSA admins

**Upgrading to 2.11.8:** run the whole updated `supabase-schema.sql` again (safe to re-run).

- `msa_admins` is now the **only** list: an admin posts announcements and
  runs the Manage page (members, roster, meeting code, admins).
  `msa_approvers` is no longer read.
- The file makes the MSA's two **owners** admins (stored as hashes; this
  file is public). Owners can't be removed in the app.
- The first run of this version of the file removes every admin except the
  two owners **once** (recorded in `msa_meta` as `admins-2.11.8`), then
  re-adds the owners. Add the other admins again on MSA → Manage → Admins;
  admins added after that survive re-running the file.
- Admins add and remove admins by email on MSA → **Manage → Admins**
  (`msa_admin_add`, `msa_admin_remove`, `msa_admin_list`); nobody can remove an
  owner or themselves. Those emails live only in the database. An owner's
  email shows in the list once they've signed in.
- **Add a student** (`msa_student_add`): a name, and optionally the email
  they sign in with. With an email, that account is a member at once if it
  exists, otherwise as soon as it signs in with that (confirmed) address.
  "Edit the list" keeps these emails for names that stay on it.
  `msa_student_remove` takes a name off the list and ends that membership.
- `msa_approve_listed` approves every waiting request whose name is on the
  roster and not taken.

The SQL editor still works for admins:

```sql
insert into public.msa_admins (email_hash)
values (sha256(convert_to(lower('name@example.org'), 'UTF8')));
```

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
- Location and reminder on/off stay per device by design. So do 2.10 travel
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
