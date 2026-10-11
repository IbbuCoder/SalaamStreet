# SalaamStreet AI Testing Lab — setup and operation

A private page where the admin (`ibrahim.asim.contact@gmail.com`, signed in
with Google) has real conversations with Google Gemini. Nobody else can use
it, and it isn't linked from any menu.

- Page: `https://salaamstreet.com/#/lab` (code: `js/ai-lab.js`, loaded only there)
- Server: Supabase Edge Function `ai-lab` (`backend/functions/ai-lab/`)
- Database: the "AI Testing Lab (private)" section at the end of `backend/supabase-schema.sql`
- Tests: `tests/ai-lab.test.js` (server + database), the "ai lab" test in `tests/e2e.test.js` (page)

Stripe is **not** used, needed or contacted. Paid plans are described in
`backend/functions/ai-lab/plans.js` with billing switched off (see "Plans" below).

## How it fits together

```
Browser (GitHub Pages)                 Supabase                               Google
#/lab  ── session token ──▶  Edge Function ai-lab  ── x-goog-api-key ──▶  Gemini API
        ◀── reply / error ──  1. Supabase Auth confirms the token          (generateContent)
                              2. email hash on the admin list + Google
                              3. emergency switches, limits (Postgres)
                              4. calls Gemini with GEMINI_API_KEY (secret)
                              5. records counts, tokens, cost — not text
```

- The Gemini key lives only in Supabase's Edge Function secrets. It is never in
  this repository, the website, the browser, or any reply.
- Every request is checked on the server: no valid session → 401; any account
  other than the admin's Google account → 403 (and logged). Hiding the page is
  not the protection; calling the function directly gets the same answers.
- Plans never unlock the Lab, and the Lab never needs a plan.

## What you need to do (once)

Steps marked **you** need your accounts; nothing here can be done from the
repository. Keep every secret out of chat, GitHub and the website.

### 1. Google AI project and Gemini API key (you)

1. Go to <https://aistudio.google.com> and sign in with the Google account that
   should own the AI project.
2. Open **Get API key** (or **Dashboard → Projects**). If a project named
   **Salaamstreet AI** already exists, select it; otherwise choose
   **Create project** / **Import project** and name it `Salaamstreet AI`.
   Don't create extra projects or keys to get around quotas.
3. In that project, **Create API key**. Copy it straight into step 4 — don't
   paste it anywhere else.
4. Billing: the free tier works for testing but has low limits, and Google may
   use free-tier prompts to improve its products. For private or sensitive
   testing, set up billing on the project (paid tier) and read Google's current
   terms. In Google Cloud Console → **Billing → Budgets & alerts**, add a small
   monthly budget with email alerts (for example $5). A budget alert warns you;
   it does not stop spending by itself.

### 2. Supabase project (already set up)

The site already uses the Supabase project in `js/config.js` (URL and
publishable key — both meant to be public). Use that same project; don't create
another one. Google sign-in and the redirect URLs are already configured
(`backend/README-backend.md` §3 and §6). Check that **Authentication → URL
Configuration → Redirect URLs** includes `https://salaamstreet.com/**` (and
`http://localhost:8080/**` if you test locally).

The service-role key stays in Supabase: Edge Functions get it automatically as
`SUPABASE_SERVICE_ROLE_KEY`. Never put it in `js/config.js` or anywhere in this
repository.

### 3. Database (you)

Supabase → **SQL Editor** → paste the whole `backend/supabase-schema.sql` →
**Run**. It's safe to re-run. It creates `ai_settings`, `ai_usage`,
`ai_security_log`, `ai_reserve()` and `ai_usage_summary()`, none of which can
be reached with the public key.

(Heads-up from earlier: this run also resets the MSA admin list to the two
owners once — re-add other MSA admins on MSA → Manage → Admins.)

### 3–4 the easy way: the GitHub button (no copying, works from a phone)

1. Supabase → your avatar → **Account → Access Tokens** → **Generate new
   token** (name it `github-deploy`). Copy it.
2. GitHub → this repository → **Settings → Secrets and variables → Actions →
   New repository secret**. Name: `SUPABASE_ACCESS_TOKEN`. Value: the token.
3. Supabase → **Edge Functions → Secrets**: `GEMINI_API_KEY` = your Gemini key
   (if you haven't already).
4. GitHub → **Actions → Deploy Supabase → Run workflow**. It runs the whole
   database file and deploys `ai-lab` with JWT verification off
   (`.github/workflows/deploy-supabase.yml`). Green tick = done.

Or do steps 3 and 4 by hand:

### 4. Secret and deploy (you, with the Supabase CLI)

Install the CLI (<https://supabase.com/docs/guides/cli>), then from the
repository folder:

```sh
supabase login
supabase link --project-ref <your-project-ref>          # the id in your Supabase URL
supabase secrets set GEMINI_API_KEY=<paste-your-gemini-key-here>
supabase functions deploy ai-lab --no-verify-jwt
```

Or without the CLI for the secret: Supabase → **Edge Functions → Secrets** →
add `GEMINI_API_KEY`.

`--no-verify-jwt` is intentional: the function checks every session itself
with Supabase Auth (and must answer the browser's CORS preflight, which carries
no token). It is not left open — without the admin's valid session every
request is refused.

### 5. Website (GitHub Pages)

Merge to `main`; GitHub Pages publishes it as usual. Nothing secret is added
to the site.

### 6. First real conversation (you)

1. Open `https://salaamstreet.com/#/lab`.
2. **Sign in with Google** as `ibrahim.asim.contact@gmail.com`.
3. Status should show **AI requests on**, **Gemini key set** and the model.
4. Press **Test connection** — it asks Google about the model with your key
   (no chat allowance used). "Connected" means the key and model are good.
5. Type a question and press Enter.

If something's wrong the page says what: key not set, key rejected, model not
found, Google's quota reached, timeout, function not deployed, or this account
isn't allowed.

## Changing the model, limits and the emergency switch

On the Lab page → **Settings and emergency switch** (saved on the server):

| Setting | Default | Notes |
|---|---|---|
| AI requests (emergency switch) | on | Off stops every AI request at once. |
| Model ID | `gemini-3.5-flash-lite` | Cheapest current stable model. For better answers try `gemini-3.8-flash`. "Test connection" confirms the ID. |
| Daily request limit | 50 | For the whole project (a cost cap), resets at midnight UTC. Connection tests don't count. |
| Requests per minute | 5 | Includes connection tests. |
| Max output tokens | 2048 | Per reply, including thinking. |
| Max message length | 6000 characters | The conversation sent to Gemini is capped at 4× this; older turns are dropped first. |
| Input / output price per 1M tokens | $0.30 / $2.50 | For estimates only. **Change both when you change the model.** |

Prices researched October 2026 from Google's pricing page (not re-checkable
from here — please confirm at <https://ai.google.dev/gemini-api/docs/pricing>):
`gemini-3.5-flash-lite` $0.30 in / $2.50 out; `gemini-3.8-flash` $0.75 in /
$3.75 out until 31 Dec 2026, then $1.50 / $7.50. Output prices include
thinking tokens.

Other switches (Supabase → Edge Functions → Secrets):

- `AI_DISABLED=true` — turns everything off whatever the page says (useful if
  you can't sign in). Remove it to turn back on.
- `AI_TIMEOUT_MS` — how long to wait for Gemini (default 45000).
- `AI_ALLOWED_ORIGINS` — sites allowed to call the function from a browser
  (default salaamstreet.com, www, and ibbucoder.github.io).
- `AI_ADMIN_EMAIL_SHA256` — replaces the admin list: comma-separated SHA-256
  of lower-cased emails. Get one with
  `printf '%s' 'name@example.com' | shasum -a 256`.

Or directly in SQL: `update public.ai_settings set enabled = false;`

## Costs and what isn't guaranteed

- Each chat sends the whole visible conversation again, so long conversations
  cost more per message. "New conversation" resets that.
- Worst case at the defaults (50 chats/day, ~24k characters ≈ 6k tokens in and
  2k out each) is roughly $0.35/day with Flash-Lite or about $0.60/day with
  3.8 Flash at the introductory price. Typical testing is far less.
- The app's limits stop the app. They are not a hard cap on your Google bill:
  anyone holding the key could use it elsewhere, and estimates can differ from
  Google's billing. Keep the key secret, use a budget alert, and you can also
  set per-model rate limits for the project in Google AI Studio.
- Token counts and costs come from what Gemini reports for each reply; when
  Gemini doesn't report usage the page says so instead of guessing.

## Privacy

- Conversations live only in the open page's memory: reloading, "New
  conversation" or "Clear" removes them. Nothing is saved on the device.
- The database stores, per request: time, account id, model, status, token
  counts, estimated cost and an error code — never the messages or replies.
  Usage is kept for a year, refusal logs for 90 days.
- Messages are sent to Google to be answered. What Google keeps depends on your
  API plan and Google's terms; this app doesn't claim Google stores nothing.
- No API keys or session tokens are logged. Server logs only record error codes.

## Accuracy rules the model is given

Every request carries a fixed instruction (`SYSTEM_PROMPT` in `core.js`): never
invent Qur'an verses, hadith, quotations, citations or links; say when it is
quoting from memory and that it should be checked; separate Qur'an/hadith,
scholarly opinion and its own explanation; present differences of opinion
fairly; never act as a mufti or issue rulings, and refer personal rulings to a
qualified scholar. There's no live source lookup yet (stage 2), and the model
is told to say so.

## Tests

`npm test` runs everything locally without any real keys. What's covered:

- Server + database (`tests/ai-lab.test.js`, real Postgres via PGlite, Gemini
  replaced by a local stand-in): admin reply; key only in a header; refusals for
  no session, bad/expired session, other accounts, non-Google sign-in,
  unconfirmed email, and a "paid" account; missing key; Google's errors (bad
  key, 403, unknown model, quota, 5xx, network, timeout, safety block, max
  tokens); daily and per-minute limits including simultaneous requests; both
  emergency switches; settings validation; size limits; CORS; the tables and
  functions unreachable with the public key; no secrets in anything the
  website serves.
- Page (`tests/e2e.test.js`, real browser): Google sign-in → status → chat with
  history → copy → connection test → quota error → server unreachable →
  emergency switch → settings → phone and desktop widths → another account
  refused, including calling the function directly.
- `index.ts` type-checks with Deno 2, and `core.js` runs under Deno.

**Not yet tested** (needs your accounts): a real request to Google's Gemini
API, the deployed Edge Function, and real Google sign-in on salaamstreet.com.
Step 6 above is that test.

## Plans (prepared, not live)

`plans.js` describes Free ($0), Plus ($4.99), Pro ($7.99) and Max ($9.99) a
month with placeholder AI allowances. `BILLING_ENABLED = false`: every account
is on Free whatever a request claims, nothing can be bought, and no payment
provider is called. Essential Islamic tools stay free.

When you decide to start billing (stage 7), the plan is: Stripe in **test
mode** first; a `stripe-webhook` Edge Function that records subscriptions in a
`user_plans` table (written only by the server); `planFor()` reads that row;
Checkout and the customer portal opened from the Account page. None of this
exists yet, and nothing needs Stripe keys today.
