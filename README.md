# SalaamStreet 🕌

A modern, peaceful Islamic web app — prayer times, Qibla, the Qur'an with audio and tafsir, authentic hadith and duas, a dhikr counter and the Islamic calendar. Free, private, and built to feel at home on every screen: iPhone, Android, iPad and Android tablets, Chromebooks, Windows and Mac laptops, and large desktop monitors.

Live at **[salaamstreet.com](https://salaamstreet.com)**.

## The story

SalaamStreet began as an Islamic-themed Shopify shop that Ibrahim built when he was 12. It didn't take off, and neither did his next attempt — so he kept the name and changed the idea: instead of selling to Muslims, give them something useful every day, for free. Ibrahim is now a student at Neuqua Valley High School and part of its Muslim Student Association; his father helps build it. The full story, our promise and the version history are on the in-app **About** page and at [salaamstreet.com/about](https://salaamstreet.com/about/).

**Our promise:** everything you need — prayer times, Qibla, Qur'an, duas, dhikr, the prayer tracker, Arabic learning and (when it arrives) sync — stays free forever. Any future paid extras (subscription or one-time) will only be for things that genuinely cost money to provide.

Current version: **2.4.1** (see `SS.VERSION` / `SS.CHANGELOG` in `js/content.js`).

## Features

- **Prayer times** — device location or a city you type in, 7 calculation methods, Standard/Hanafi Asr, today's times and a monthly timetable (AlAdhan API, cached for offline)
- **Qibla finder** — live compass on phones and tablets that have one; bearing and distance to Makkah everywhere (computed on your device)
- **Qur'an reader** — all 114 surahs in Uthmani script with Saheeh International translation, optional transliteration, adjustable Arabic text size, bookmarks, resume where you left off, copy an ayah
- **Recitation** — 4 reciters, per-ayah or continuous playback, speed and repeat controls, lock-screen/media-key controls
- **Tafsir** — Ibn Kathir (English) for any ayah, in a bottom sheet on phones
- **Hadith library** — 40 Hadith Nawawi & Qudsi in full, plus browse-by-number for Sahih al-Bukhari and Muslim, with Arabic, English, grading and reference
- **Dua library** — authentic supplications with Arabic, transliteration, translation and a source on every dua; favourites and copy
- **Dhikr counter** — big tap target (or Space bar on desktop), presets with sourced targets, undo, today's totals, daily streaks, haptic feedback
- **Islamic calendar** — today's Hijri date and approximate countdowns to key dates
- **Prayer tracker** — tick off each prayer, see the last 7 days and your streak (stays on your device)
- **Prayer reminders** — opt-in notifications at (or before) each prayer, a soft chime, and a Friday Al-Kahf reminder
- **Morning & evening adhkar** — a guided routine with a counter for each remembrance and automatic progress
- **Ramadan mode** — appears automatically in Ramadan: suhoor/iftar times and countdown, plus a fasting log
- **Qur'an reading plans** — finish the Qur'an in 30 (one juz a day), 60, 120 or 365 days
- **Memorize mode** — hide the Arabic, recite, tap to check; loop an ayah 3×, 5×, 10× or endlessly
- **Juz navigation, translation search, 9 translation languages** (English, Urdu, Indonesian, Turkish, Bengali, French, Malay, Spanish, German)
- **Share as image** — turn any ayah, dua or hadith into a ready-to-post card
- **99 Names of Allah** — with a Name of the day on the home screen
- **Mosque finder** — nearby mosques from OpenStreetMap with one-tap directions
- **Learn to read Arabic** — the 28 letters and their shapes, the vowel marks, and a quick quiz
- **Prayer-times widget for mosques** — a free embed builder at [`/widget/`](https://salaamstreet.com/widget/): pick a location, method and style, copy one line of code
- **Search-friendly pages** — every surah, the dua library, the 99 Names and prayer times for 60 major cities have their own indexable page, plus `sitemap.xml`
- **7 interface languages** — English and Arabic, plus draft Urdu, Bengali, Indonesian, Turkish and French (loaded only when chosen; pending native-speaker review) — with full right-to-left layout for Arabic and Urdu · **Light / dark / system theme** · **Installable** (add to home screen) · **Works offline** for anything you've already opened

## Principles

- **Authenticity:** Qur'an text comes from Tanzil (Uthmani) via AlQuran Cloud; every dua and dhikr preset carries its source. Nothing is invented or generated.
- **Privacy-first:** everything personal stays in your browser's localStorage. Location is used only after you choose an option, is rounded to ~1 km, and is sent only to the prayer-times API. Export or delete everything in Settings.
- **Respect for scholarly difference:** calculation method and Asr madhhab are your choice, never presented as the single correct view.
- **Free:** no ads, and the essentials are never behind a paywall.

## Built for every screen

| Screen | Navigation | Layout |
|---|---|---|
| Phones (< 768px) | Bottom tab bar within thumb reach + "More" sheet | Single column, 44px+ touch targets, bottom-sheet dialogs, no horizontal scrolling |
| Tablets (768–1099px) | Compact icon rail | Wider cards, two-column lists |
| Laptops & desktops (≥ 1100px) | Full sidebar | Multi-column dashboards, sticky reading toolbar, keyboard support |
| Large monitors (≥ 1440px) | Full sidebar | Wider content area while reading text keeps a comfortable line length |

Safe-area insets (iPhone notch / home indicator), 16px form inputs (no iOS zoom), reduced-motion support, visible keyboard focus, screen-reader labels and `lang`/`dir` on all Arabic text are built in.

## Project structure

```
├── index.html            App shell (all views; hash routing: #/home, #/quran, #/surah/2 …)
├── css/styles.css        Design system: tokens, light/dark themes, RTL, responsive layout
├── js/
│   ├── surahs.js         114-surah metadata + ayah numbering
│   ├── duas.js           Dua library + dhikr presets, all with sources
│   ├── extras.js         Calendar events + hadith collections
│   ├── content.js        99 Names, juz boundaries, adhkar sequence, Arabic letters, translations
│   ├── i18n.js           English/Arabic strings, language loading, RTL switching
│   ├── lang/             Draft interface languages (ur, bn, id, tr, fr), loaded on demand
│   ├── core.js           Config, storage, API clients with caching, location flow, Qibla math
│   ├── views.js          One controller per view
│   ├── features.js       Tracker, reminders, adhkar, Names, mosques, Arabic, plans, share cards
│   └── app.js            Router, theme, dialogs, audio player, boot
├── sw.js                 Service worker (offline app shell)
├── manifest.webmanifest  PWA manifest · icons/ app icons
├── 404.html · CNAME · .nojekyll   GitHub Pages
├── widget/               Prayer-times widget: builder (index.html) + iframe (embed.html)
├── surah/ duas/ names-of-allah/ prayer-times/   Generated SEO pages (see below)
├── tools/build-pages.js  Generator for the SEO pages + sitemap.xml
├── backend/              Optional future account-sync schema (not connected)
└── docs/                 Product, architecture and design notes
```

Plain `<script defer>` tags — no ES modules and no build step — so the site works on any static host and even when `index.html` is opened directly from disk.

## Generated pages

The pages under `surah/`, `duas/`, `names-of-allah/` and `prayer-times/`, plus `sitemap.xml` and `robots.txt`, are generated from the app's data files. After changing `js/surahs.js`, `js/duas.js` or `js/content.js`, regenerate and commit them:

```bash
node tools/build-pages.js
```

## Run locally

```bash
python -m http.server 8000   # then open http://localhost:8000
```

(Opening `index.html` directly also works; the offline service worker and device location need `http://localhost` or HTTPS.)

## Deploy (GitHub Pages)

The repo is deployed from the `main` branch root:

1. **Settings → Pages → Source:** *Deploy from a branch* → `main` / `/ (root)`.
2. `CNAME` points the site at `salaamstreet.com`; `.nojekyll` makes Pages serve files as-is.
3. All asset paths are relative, so the site also works from a `username.github.io/repo/` subpath.

## External services (all free, no keys)

| Service | Used for |
|---|---|
| [AlAdhan API](https://aladhan.com/prayer-times-api) | Prayer times, Hijri date, city lookup |
| [AlQuran Cloud API](https://alquran.cloud/api) | Qur'an text, translation, transliteration |
| [Islamic Network CDN](https://cdn.islamic.network) | Per-ayah recitation audio |
| [tafsir_api (spa5k)](https://github.com/spa5k/tafsir_api) via jsDelivr | Tafsir Ibn Kathir |
| [hadith-api (fawazahmed0)](https://github.com/fawazahmed0/hadith-api) via jsDelivr | Hadith collections |
| [OpenStreetMap Overpass API](https://overpass-api.de) | Mosque finder |
| Google Fonts | Figtree, IBM Plex Sans Arabic, Scheherazade New, Amiri |

Responses are cached in localStorage, so surahs you've read and today's prayer times keep working offline.

## Roadmap

See [`docs/05-roadmap.md`](docs/05-roadmap.md).
