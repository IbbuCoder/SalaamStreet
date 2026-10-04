# SalaamStreet — Optional backend (Supabase)

**Status: not connected.** The website is fully client-side and works without
any backend — settings, bookmarks, favourites and streaks live in the
browser's `localStorage`. This folder holds a ready-to-use schema for a future
opt-in feature: signing in to sync that data across a person's devices.

Supabase gives Postgres + Auth + an auto-generated REST API on a free tier,
with no server to run, which keeps the site deployable on GitHub Pages.

## 1. Create the project

1. Sign up at <https://supabase.com> and create a new project.
2. In **Project Settings → API**, copy the **Project URL** and the
   **anon public key** (safe to ship in the website — it only works together
   with Row-Level Security, enabled below). Keep the **service_role key**
   secret; it never goes in client code.

## 2. Create the tables

Open **SQL Editor**, paste `supabase-schema.sql`, and run it. This creates
`profiles`, `preferences`, `bookmarks`, `progress`, `favorites`, a trigger that
creates a profile on sign-up, and Row-Level Security so each user can only
read and write their own rows.

## 3. Configure Auth

- **Authentication → Providers**: enable **Email**.
- **Authentication → URL Configuration**: add `https://salaamstreet.com` and
  `http://localhost:8080` (local testing) as redirect URLs.

## 4. Connecting the website (future work)

The site uses classic scripts (no build step), so the Supabase client would be
loaded from a CDN in a single `<script type="module">` that exposes a small
`window.SSAuth` wrapper the existing code can call. Guests keep using
`localStorage`; on first sign-in, local bookmarks and streaks are migrated
into the account.

## Secrets & safety

- The anon key is public by design; security comes from RLS.
- The service_role key lives only in Supabase / server environment variables.
- `.env` files and keys are never committed.
