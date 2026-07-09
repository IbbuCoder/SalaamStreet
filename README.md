# SalaamStreet 🕌

A modern, peaceful Islamic web platform — prayer times, Qibla finder, Qur'an reader with audio, authentic duas, and a dhikr counter. Built as a fully static single-page app (HTML/CSS/vanilla JS, no build step, no modules) that runs anywhere: double-clicked locally, GitHub Pages, or any static host.

## Features

- **Prayer times** — device location or manual city, 7 calculation methods, Standard/Hanafi Asr, daily + monthly views (AlAdhan API, cached for offline)
- **Qibla finder** — live compass on supported phones; computed great-circle bearing everywhere (fully on-device)
- **Qur'an reader** — all 114 surahs, Uthmani script, Saheeh International translation, transliteration toggle, bookmarks, last-read resume, per-ayah and continuous audio with 4 reciters, speed and repeat controls
- **Tafsir** — Ibn Kathir (English) opens per ayah inside the Qur'an reader (open tafsir_api)
- **Hadith library** — 40 Hadith Nawawi & Qudsi (bounded, shown in full) plus browse-by-number for Sahih al-Bukhari and Muslim, with Arabic, English, grading, and reference on each (open hadith-api)
- **Dua library** — authentic supplications with Arabic, transliteration, translation, and a source citation on every dua
- **Dhikr counter** — presets with sourced targets, progress ring, daily streaks
- **Islamic calendar** — today's Hijri date (AlAdhan) and key Islamic dates, with a note that Gregorian dates depend on moon-sighting
- **Premium** — pricing / checkout / success / cancel / membership pages with PayPal (@aqmoha). Core worship features stay free forever; premium adds study tools (see the Premium page). Gating is client-side and provisional, designed to move to server-side PayPal verification later.
- **English + Arabic** UI with full RTL · **Dark mode** · Responsive · Accessible

## Principles

- **Authenticity:** Qur'an text comes from the Tanzil Uthmani text via AlQuran Cloud; every dua and dhikr preset carries its source (Qur'an reference or hadith collection + number). Nothing is invented.
- **Privacy-first:** all personal data stays in your browser's localStorage. Location is used only after you choose an option in the permission dialog, is rounded to ~1 km, and is sent only to the prayer-times API. "Allow once" lasts the session only. Export or delete everything in Settings.
- **Respect for scholarly difference:** calculation method and Asr madhhab are user choices, never presented as the single correct view.

## Project structure

```
├── index.html        The entire app shell (all views; hash routing: #/home, #/quran, #/surah/2 …)
├── css/styles.css    Design system: tokens, light/dark themes, RTL, all components
├── js/
│   ├── surahs.js     114-surah metadata + ayah numbering (self-hosted data)
│   ├── duas.js       Dua library + dhikr presets, all with sources (self-hosted data)
│   ├── i18n.js       English/Arabic strings + RTL switching
│   ├── core.js       Config, storage, API clients with caching, location flow, qibla math
│   ├── views.js      One controller per view
│   └── app.js        Router, theme, audio player, boot
├── .nojekyll         Tells GitHub Pages to serve files as-is
└── docs/             Planning documents (PRD, architecture, sitemap)
```

Plain `<script defer>` tags — no ES modules — so the site works even when `index.html` is opened directly from disk (file://), which module-based sites cannot do.

## Run locally

Just double-click `index.html`, or serve it:

```bash
python -m http.server 8000   # then open http://localhost:8000
```

## Deploy to GitHub Pages

1. Create a repository on GitHub.
2. Upload **all files and folders** (`index.html`, `css/`, `js/`, `.nojekyll`). If you drag-and-drop, make sure the `css` and `js` folders are included and fully uploaded — if your files live in OneDrive, right-click the folder and choose **"Always keep on this device"** first, so you're uploading real files rather than cloud placeholders.
3. Repo **Settings → Pages → Source**: *Deploy from a branch* → `main` / `/ (root)` → Save.
4. Wait ~1 minute; the site goes live at `https://<username>.github.io/<repo>/`.

All asset paths are relative, so the repo subpath works with no configuration.

> **Note:** GitHub Pages serves static files only — Python/Node/databases don't run there. This app is fully client-side for that reason.

## External services (all free, no keys)

| Service | Used for |
|---|---|
| [AlAdhan API](https://aladhan.com/prayer-times-api) | Prayer times, Hijri date, city geocoding |
| [AlQuran Cloud API](https://alquran.cloud/api) | Qur'an text, translation, transliteration |
| [Islamic Network CDN](https://cdn.islamic.network) | Per-ayah recitation audio |
| [tafsir_api (spa5k)](https://github.com/spa5k/tafsir_api) via jsDelivr | Tafsir Ibn Kathir |
| [hadith-api (fawazahmed0)](https://github.com/fawazahmed0/hadith-api) via jsDelivr | Hadith collections |
| Google Fonts | Figtree, IBM Plex Sans Arabic, Scheherazade New, Amiri |

## Payments (PayPal)

Premium uses a [PayPal.me](https://www.paypal.com/paypalme/aqmoha) link (handle **@aqmoha**) for the actual payment, configured in `js/core.js` (`SS.PAYPAL_ME` / `SS.PAYPAL_HANDLE`). Because this is a static site there is no server to verify payments, so activation is **provisional and stored on the device** after the user confirms payment. This is intentionally designed to migrate to server-side PayPal REST API verification later — those secrets (client ID/secret, webhook) belong in environment variables on a server, **never** in this client code. No secrets are stored in the repo.

Responses are cached in localStorage, so previously viewed surahs and today's prayer times keep working offline.

## Roadmap

v2: Hadith library, tafsir, Islamic calendar, learning academy · v3: AI assistant (retrieval-grounded, always cites sources), mosque & halal finders, community. See `docs/01-prd.md`.
