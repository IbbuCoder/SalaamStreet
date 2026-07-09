# SalaamStreet — Backend (Supabase)

One hosted account system for **both** clients: the static website (JavaScript)
and the Windows app (C#). Supabase gives us Postgres + Auth + an auto-generated
REST API + client SDKs, on a free tier, with no server to run.

## 1. Create the project

1. Sign up at <https://supabase.com> and create a new project (pick a region
   near your users). Save the database password.
2. In **Project Settings → API**, copy:
   - **Project URL** (e.g. `https://xxxx.supabase.co`)
   - **anon public key** (safe to ship in the website and app — it only works
     together with Row-Level Security, which we enable below)
   - Keep the **service_role key** secret — server-side only, never in a client.

## 2. Create the tables

Open **SQL Editor**, paste the contents of `supabase-schema.sql`, and run it.
This creates `profiles`, `preferences`, `bookmarks`, `progress`, `favorites`,
a trigger that auto-creates a profile on sign-up, and Row-Level Security so each
user can only touch their own rows.

## 3. Configure Auth

- **Authentication → Providers**: enable **Email** (password). Optionally enable
  Google later.
- **Authentication → URL Configuration**: add your site URLs (e.g.
  `https://salaamstreet.com` and `http://localhost:8000` for local testing) as
  redirect URLs.
- Decide whether to require email confirmation (recommended for production).

## 4. How each client connects (implemented in later sessions)

**Website (Session 2):** load the Supabase JS client from a CDN and initialise
with the Project URL + anon key. Because the site uses classic scripts, we import
the ESM build in a single `<script type="module">` that exposes a tiny
`window.SSAuth` wrapper, so the existing non-module code keeps working:

```html
<script type="module">
  import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
  window.SSAuth = createClient("https://xxxx.supabase.co", "PUBLIC_ANON_KEY");
</script>
```

Sign-up / login / logout, profile, settings sync, and the dashboard read/write
these tables. Guests keep using localStorage; on first login we migrate local
bookmarks/streaks into the account.

**Windows app (Session 4):** call the same project over HTTPS. Either use the
community **supabase-csharp** SDK or plain `HttpClient` against the REST endpoint
(`/rest/v1/…`) and the GoTrue auth endpoint (`/auth/v1/token`), sending the anon
key + the user's access token. The app stores the session token in the local
SQLite DB and two-way syncs bookmarks/progress/preferences.

## 5. Premium (Session 5)

`profiles.is_premium` must only be set by a **trusted server** — a Supabase
**Edge Function** that verifies the PayPal payment (via the PayPal REST API using
secrets kept in Supabase, never in a client). Until then the website's premium
flag is provisional/local and clearly labeled. When the Edge Function lands, both
clients simply read `is_premium` from the profile.

## Secrets & safety

- The **anon key** is public by design; security comes from **RLS** (enabled here).
- The **service_role key**, PayPal client secret, and webhook secret live only in
  server env vars / Supabase secrets — never in the website or the C# app.
- `.env` files and keys are never committed to the repo.
