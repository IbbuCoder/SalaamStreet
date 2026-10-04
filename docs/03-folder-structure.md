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
│   ├── i18n.js           English / Arabic strings
│   ├── core.js           Storage, API clients, location, Qibla math
│   ├── views.js          View controllers
│   └── app.js            Router, shell, audio player, boot
├── icons/                App icons (SVG source + PNG sizes)
├── backend/              Optional future account-sync schema (not connected)
└── docs/                 Product and design documents
```
