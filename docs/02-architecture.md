# SalaamStreet — Architecture

SalaamStreet is a **static, client-side web application**. There is no build
step and no server of our own: GitHub Pages serves the files as-is, and
personal data lives in the visitor's browser. Since 2.5, people can optionally
sign in (Supabase Auth + Postgres) to sync that data across devices; without an
account (guest mode) everything works exactly the same.

## 1. Stack

| Layer | Choice | Why |
|---|---|---|
| Markup | One `index.html` app shell with every view as a `<section>` | Instant view switches, works from `file://` |
| Styling | Hand-written CSS with design tokens (`css/styles.css`) | Mobile-first, light/dark themes, full RTL via logical properties |
| Logic | Vanilla JS as classic `<script defer>` files (no modules) | No tooling, runs anywhere, including directly from disk |
| Routing | Hash router (`#/quran`, `#/surah/2/255`, …) | Deep links work on static hosting with no rewrites |
| Storage | `localStorage` (settings, bookmarks, favourites, streaks, API cache) | Privacy-first; export/delete in Settings |
| Accounts (optional) | Supabase Auth (Apple, Google, phone, email; PKCE) + `sync_records` table with RLS | Free tier, no server to run; see `backend/README-backend.md` |
| Sync | `js/sync.js` record-level engine: per-record timestamps, newest-wins + safe merges, tombstones, offline queue, realtime | Works offline-first; nothing is wiped on sign-in |
| Offline | Service worker (`sw.js`) for the app shell + localStorage API cache | Previously viewed content keeps working offline |
| Hosting | GitHub Pages from `main` (`CNAME` → salaamstreet.com) | Free, static |

## 2. Script load order

```
surahs.js   114-surah metadata, global ayah numbering
duas.js     dua library + dhikr presets (all with sources)
extras.js   Islamic calendar events, hadith collection list, Knowledge content
hadith-books.js  Book index for the large hadith collections (generated; loaded on demand)
i18n.js     English/Arabic strings, RTL switching
core.js     constants, storage (+ sync write hooks), cached fetch, API clients, location flow, Qibla bearing
views.js    one controller per view (+ optional "leave" hooks)
features.js daily-habit and learning features
qibla.js    Qibla view: WMM2025 declination, orientation maths, compass + camera mode
config.js   Supabase URL/key (empty → guest-only site)
sync.js     cross-device sync engine
account.js  sign-in flows, account linking, sync wiring, Account dashboard
app.js      router, theme, locale, dialogs, audio player, offline banner, boot
```

Each file attaches to a single `window.SS` namespace.

## 3. Data sources (all free, no keys)

| Service | Used for | Cache |
|---|---|---|
| AlAdhan API | prayer times, monthly timetable, Hijri date, city lookup | 1–30 days |
| AlQuran Cloud | Qur'an text (Tanzil Uthmani), Saheeh International, transliteration | 30 days |
| Islamic Network CDN | per-ayah recitation audio | browser cache |
| tafsir_api (jsDelivr, GitHub raw fallback) | Tafsir Ibn Kathir (English), `/{surah}/{ayah}.json` | 30 days |
| Supabase (only if signed in) | auth + synced records | — |
| hadith-api (jsDelivr) | 40 Nawawi, Qudsi, Shah Waliullah; Bukhari, Muslim, Abu Dawud, Tirmidhi, Nasa'i, Ibn Majah, Muwatta Malik | 30 days |

Requests time out after 15 seconds; if the network fails, the last cached copy
is shown and every view offers a "Try again" action.

## 4. Responsive layout

| Width | Navigation | Content |
|---|---|---|
| < 768px (phones) | bottom tab bar + "More" bottom sheet | single column, bottom-sheet dialogs |
| 768–1099px (tablets) | icon rail | single/two columns |
| ≥ 1100px (laptops, desktops) | full sidebar | multi-column dashboards, max width 1120px (1240px ≥ 1440px) |

Reading views (Qur'an, duas, hadith, settings) cap at 800px for comfortable line length.

## 5. Privacy

- Location is only requested after the user picks an option in the in-app dialog.
- Coordinates are rounded to 2 decimals (~1 km) and sent only to AlAdhan.
- The Qibla bearing, magnetic declination (WMM2025) and distance are computed on the device.
- No analytics and no tracking cookies. Accounts are optional; signed-in people
  sync bookmarks, streaks, progress and settings to their own rows (Row-Level
  Security) — never their location.

## 6. Startup and theme

The saved theme is applied by a tiny inline script at the top of `<head>`,
before any stylesheet or font request, together with critical background
styles, `color-scheme`, the browser `theme-color` and the iOS launch images
(light and dark sets). A boot screen in the same theme covers the moment until
the app has rendered, then fades out. `SS.paintTheme` repeats exactly the same
steps whenever the theme changes later (toggle, system change or account sync),
so a theme never flashes.

## 7. Qibla

`SS.qiblaBearing` (great-circle, true north) + `js/qibla.js`: device
orientation is converted with the full alpha/beta/gamma rotation (top edge when
flat, back camera when upright, screen rotation aware), magnetic headings are
corrected to true north with WMM2025, and no direction is shown without a real
location. Camera mode shows the camera feed only as a background.
