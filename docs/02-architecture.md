# SalaamStreet — Architecture

SalaamStreet is a **static, client-side web application**. There is no build
step, no server and no database: GitHub Pages serves the files as-is, and all
personal data stays in the visitor's browser.

## 1. Stack

| Layer | Choice | Why |
|---|---|---|
| Markup | One `index.html` app shell with every view as a `<section>` | Instant view switches, works from `file://` |
| Styling | Hand-written CSS with design tokens (`css/styles.css`) | Mobile-first, light/dark themes, full RTL via logical properties |
| Logic | Vanilla JS as classic `<script defer>` files (no modules) | No tooling, runs anywhere, including directly from disk |
| Routing | Hash router (`#/quran`, `#/surah/2/255`, …) | Deep links work on static hosting with no rewrites |
| Storage | `localStorage` (settings, bookmarks, favourites, streaks, API cache) | Privacy-first; export/delete in Settings |
| Offline | Service worker (`sw.js`) for the app shell + localStorage API cache | Previously viewed content keeps working offline |
| Hosting | GitHub Pages from `main` (`CNAME` → salaamstreet.com) | Free, static |

## 2. Script load order

```
surahs.js   114-surah metadata, global ayah numbering
duas.js     dua library + dhikr presets (all with sources)
extras.js   Islamic calendar events, hadith collection list
i18n.js     English/Arabic strings, RTL switching
core.js     config, storage, cached fetch, API clients, location flow, Qibla math
views.js    one controller per view (+ optional "leave" hooks)
app.js      router, theme, locale, dialogs, audio player, offline banner, boot
```

Each file attaches to a single `window.SS` namespace.

## 3. Data sources (all free, no keys)

| Service | Used for | Cache |
|---|---|---|
| AlAdhan API | prayer times, monthly timetable, Hijri date, city lookup | 1–30 days |
| AlQuran Cloud | Qur'an text (Tanzil Uthmani), Saheeh International, transliteration | 30 days |
| Islamic Network CDN | per-ayah recitation audio | browser cache |
| tafsir_api (jsDelivr) | Tafsir Ibn Kathir (English) | 30 days |
| hadith-api (jsDelivr) | Nawawi 40, Qudsi 40, Bukhari, Muslim | 30 days |

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
- The Qibla bearing and distance are computed on the device.
- No analytics, no cookies, no accounts.
