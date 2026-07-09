# SalaamStreet — Web + Desktop Roadmap

This is a multi-session build. Below is the plan and what is done vs pending.
Architecture principle: **one account system, two clients.** A hosted
[Supabase](https://supabase.com) project (Postgres + Auth) is the single source
of truth. The static website (GitHub Pages) and the native Windows app (C#/WPF,
.NET 8) both talk to it, so a login and progress sync across both.

```
        ┌─────────────────────────┐
        │  Supabase (hosted)      │
        │  Auth + Postgres + RLS  │
        └───────────┬─────────────┘
        REST/JS SDK │ REST + .NET
     ┌──────────────┴───────────────┐
┌────▼─────┐                   ┌─────▼──────────┐
│ Website  │  static, GH Pages │ Windows app    │ native WPF .exe
│ (SPA JS) │                   │ (.NET 8, C#)   │ + local SQLite cache
└──────────┘                   └────────────────┘
```

## Session 1 — Desktop foundation + backend schema (THIS session)

Done:
- Real native **WPF / .NET 8** desktop app you build with `dotnet build` — no
  Edge, no WebView, no Electron. `desktop/`
  - Native window shell with sidebar navigation, app icon, taskbar presence.
  - Views: Dashboard, Prayer Times, Qibla, Qur'an reader (larger desktop reading
    mode + full-screen study), Learn (flashcards foundation), Settings.
  - Services: local **SQLite** cache, settings store, AlAdhan prayer times,
    AlQuran Cloud Qur'an text, on-device Qibla math, **Windows toast
    notifications**, system-tray icon with background reminder service,
    optional auto-start.
  - Keyboard shortcuts, full-screen study mode.
- **Inno Setup** installer script (wizard, Start Menu + optional Desktop
  shortcut, uninstaller, metadata). `desktop/installer/`
- **Build + code-signing + SmartScreen** guide. `desktop/README-desktop.md`
- **Supabase schema** (profiles, preferences, quran progress, arabic progress,
  bookmarks, favorite mosques/halal, premium) with Row-Level Security, plus a
  setup guide. `backend/`

## Session 2 — Accounts on the website

- Add Supabase JS client to the site (no build step; ES-module CDN import guarded
  so the static/classic scripts keep working).
- Sign up / login / logout / password reset UI.
- User profile + account settings pages.
- Move preferences (method, madhhab, reciter, theme, locale) to sync with the
  account when logged in; fall back to localStorage when logged out (guest).
- Migrate existing localStorage bookmarks/streaks into the account on first login.

## Session 3 — Website dashboard + synced data

- User dashboard: saved Qur'an progress, Arabic learning progress, favorite
  mosques, favorite halal locations, premium status.
- Bookmarks and progress read/write through Supabase.
- Premium status sourced from the account (not just local), still provisional
  until server-side PayPal verification (Session 5).

## Session 4 — Desktop ↔ account sync + offline

- Wire the WPF app to Supabase auth (same login as web).
- Two-way sync of bookmarks/progress/preferences between local SQLite and Supabase.
- Offline mode: download Qur'an content + Arabic lessons for offline reading;
  offline bookmarks/progress that sync when back online.

## Session 5 — Premium hardening + learning depth

- Server-side PayPal verification (Supabase Edge Function / small API) so premium
  status is trustworthy, replacing the provisional client flag.
- Premium gating enforced in both clients from the account's `is_premium`.
- Deeper Arabic learning: lessons, grammar, quizzes, memorization planner,
  study planner, analytics (free vs premium tiers).

## Session 6 — Finders + community + polish

- Mosque finder + halal finder (maps/places provider TBD) with favorites synced.
- Community features (scope TBD).
- Accessibility audit, responsive QA (desktop/tablet/mobile), performance pass.

## Notes on honesty & Islamic authenticity

Qur'an/hadith/tafsir always come from established sources with citations shown;
nothing is generated. Premium never paywalls core worship (prayer, Qibla, full
Qur'an, duas, dhikr). Payments use PayPal (@aqmoha); real verification lands in
Session 5 — until then activation is provisional and clearly labeled.
