# SalaamStreet — Folder Structure

```
├── index.html            App shell: every view, dialogs, inline SVG icon sprite
├── 404.html              Redirects unknown paths back to the app (GitHub Pages)
├── manifest.webmanifest  Install-to-home-screen metadata (PWA)
├── sw.js                 Service worker: offline app shell
├── CNAME                 Custom domain for GitHub Pages
├── .nojekyll             Serve files as-is on GitHub Pages
├── css/
│   └── styles.css        Tokens, themes, layout, components, views
├── js/
│   ├── surahs.js         Surah metadata
│   ├── duas.js           Duas + dhikr presets
│   ├── extras.js         Calendar events, hadith collections
│   ├── content.js        Names of Allah, juz, adhkar, Arabic letters, translations
│   ├── i18n.js           English / Arabic strings
│   ├── core.js           Storage (with sync hooks), API clients, location, Qibla bearing
│   ├── views.js          View controllers
│   ├── features.js       Tracker, reminders, adhkar, Names, mosques, Arabic, plans, sharing
│   ├── qibla.js          Qibla view: WMM2025 declination, orientation maths, compass + camera mode
│   ├── config.js         Site config: Supabase URL/key for optional accounts (empty = guest-only)
│   ├── sync.js           Cross-device sync engine (records, merge rules, offline queue)
│   ├── account.js        Accounts: sign-in flows, linking, sync wiring, Account dashboard
│   ├── app.js            Router, shell, theme, audio player, boot
│   ├── lang/             Draft interface languages (loaded on demand)
│   └── vendor/
│       └── supabase.js   supabase-js UMD build (MIT), loaded only when accounts are used
├── icons/                App icons, iOS launch screens (light + dark)
├── backend/              Supabase schema + setup guide for optional accounts
├── tools/                build-pages.js (SEO pages), build-splash.js (launch screens)
├── tests/                Unit, schema (PGlite) and end-to-end (Playwright) tests
├── package.json          Developer tooling only — the site itself has no build step
└── docs/                 Product and design documents
```
