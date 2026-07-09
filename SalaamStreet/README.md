# SalaamStreet 🕌

A modern, peaceful Islamic web platform — prayer times, Qibla finder, Qur'an reader with audio, authentic duas, and a dhikr counter. Built as a fully static single-page app (HTML/CSS/vanilla JS, no build step, no modules) that runs anywhere: double-clicked locally, GitHub Pages, or any static host.

## Features

- **Prayer times** — device location or manual city, 7 calculation methods, Standard/Hanafi Asr, daily + monthly views (AlAdhan API, cached for offline)
- **Qibla finder** — live compass on supported phones; computed great-circle bearing everywhere (fully on-device)
- **Qur'an reader** — all 114 surahs, Uthmani script, Saheeh International translation, transliteration toggle, bookmarks, last-read resume, per-ayah and continuous audio with 4 reciters, speed and repeat controls
- **Dua library** — authentic supplications with Arabic, transliteration, translation, and a source citation on every dua
- **Dhikr counter** — presets with sourced targets, progress ring, daily streaks
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
| Google Fonts | Figtree, IBM Plex Sans Arabic, Scheherazade New, Amiri |

Responses are cached in localStorage, so previously viewed surahs and today's prayer times keep working offline.

## Roadmap

v2: Hadith library, tafsir, Islamic calendar, learning academy · v3: AI assistant (retrieval-grounded, always cites sources), mosque & halal finders, community. See `docs/01-prd.md`.
