# SalaamStreet — Software Architecture

**Version:** 1.0 · **Status:** Awaiting approval

## 1. Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 15 (App Router) + React 19 + TypeScript (strict) | RSC-first; client components only where interactive |
| Styling | Tailwind CSS v4 | Design tokens for emerald/white/black/gold; logical properties for RTL |
| ORM / DB | Prisma + PostgreSQL | Vercel-compatible (Neon/Vercel Postgres); pooled connections |
| Auth | NextAuth (Auth.js v5) | Email magic link + Google OAuth; Prisma adapter; JWT sessions |
| Hosting | Vercel | Edge for read-heavy routes, Node for auth/DB |
| Repo | GitHub | PR-based flow, CI via GitHub Actions |

## 2. High-Level Design

```
Browser (RSC + islands of client interactivity)
   │
Next.js App Router
   ├─ Server Components ── read Quran/Dua content (self-hosted, static)
   ├─ Route Handlers /api/* ─┬─ Prisma ──► PostgreSQL (users, bookmarks, streaks)
   │                         ├─ AlAdhan API (prayer times, Hijri) [server-side, cached]
   │                         └─ (v2) Sunnah.com / tafsir sources
   └─ NextAuth handlers
```

## 3. Data Sourcing Strategy (hybrid — reliability first)

| Content | Source | Why |
|---|---|---|
| Quran text (Uthmani, Saheeh Intl translation, transliteration) | **Self-hosted**: seeded into Postgres from the Tanzil/Quran.com public datasets at build time | Scripture must never depend on third-party uptime; enables static generation and zero-latency reads |
| Prayer times & Hijri dates | **AlAdhan API** (free, no key) via our own `/api/prayer-times` proxy with server-side caching (per location+date, 24h TTL) | Battle-tested calculation engine, all methods supported; caching removes downtime/rate-limit risk |
| Audio recitations | **EveryAyah / Quran.com CDN URLs** (per-ayah mp3), streamed directly by the client | Audio files are huge; stream from established CDNs, keep qari + URL template in our DB |
| Duas | **Self-hosted**: Hisnul Muslim dataset seeded into Postgres with source citations | Small, stable dataset; full control over citation accuracy |
| Hadith (v2) | Sunnah.com API, cached in our DB with grading + citation | Canonical grading data |
| Qibla | **Client-side computation** (great-circle formula) | No network needed; privacy-preserving |

Every content row stores `source` + `sourceRef` (e.g., "Hisnul Muslim #27", "Tanzil Uthmani v1.1") — authenticity is auditable.

## 4. Key Architectural Decisions

1. **Server-side API proxying** — the browser never calls AlAdhan directly. Our route handlers proxy + cache, so we can swap providers, add fallbacks, and avoid leaking user coordinates to third parties beyond what's needed.
2. **Coordinates privacy** — geolocation is read client-side; coordinates are sent only to our prayer-times endpoint (rounded to 2 decimals ≈ 1km, sufficient for prayer times) and are **not persisted** unless the user explicitly saves a location.
3. **Static-first Quran** — surah pages are SSG'd (114 pages + juz routes); user data (bookmarks, last-read) hydrates client-side after load.
4. **Guest-first UX** — prayer times, Quran, Qibla, duas work without an account (localStorage state); an account adds sync, streaks, notifications.
5. **i18n** — `next-intl`, locale segment `/(en|ar)/…`, `dir` set at the html level, Tailwind logical props (`ms-*`, `pe-*`) so RTL needs no overrides.
6. **State** — server state via RSC + fetch cache; client state kept minimal (Zustand for audio player + dhikr counter; localStorage persistence for guests).

## 5. Security (OWASP-aligned)

- All secrets in env vars (`.env.local` locally, Vercel env in prod); `.env.example` committed, never real values.
- NextAuth CSRF protection; `httpOnly` `secure` `sameSite=lax` cookies.
- Zod validation on every route-handler input; Prisma (parameterized) prevents SQLi.
- Rate limiting on auth + API routes (Upstash Ratelimit or in-memory fallback).
- Security headers via `middleware.ts` / `next.config`: CSP, HSTS, X-Frame-Options DENY, Referrer-Policy, Permissions-Policy (geolocation self only).
- Dependency scanning (Dependabot) + `npm audit` in CI.

## 6. Performance

- RSC + SSG for content; `next/font` self-hosted fonts (incl. Uthmanic Hafs, Amiri) with `font-display: swap`.
- Route-level code splitting; audio player lazy-loaded; images via `next/image`.
- DB indexes on all lookup paths (see schema doc); connection pooling for serverless.
- Edge caching: prayer times cached per (lat2dp, lng2dp, date, method).

## 7. Environments & CI/CD

- `main` → production (Vercel), PR branches → preview deployments.
- GitHub Actions: typecheck, lint, test (Vitest + Playwright smoke), `prisma validate` on every PR.
- Migrations: `prisma migrate` — applied via CI step against production DB on deploy.

## 8. Environment Variables (v1)

```
DATABASE_URL=            # Postgres (pooled)
DIRECT_URL=              # Postgres (direct, for migrations)
AUTH_SECRET=             # NextAuth
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
EMAIL_SERVER=            # magic-link SMTP
EMAIL_FROM=
NEXT_PUBLIC_APP_URL=
```
