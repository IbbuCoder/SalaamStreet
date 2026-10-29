# SalaamStreet 🕌

A modern, peaceful Islamic web app — prayer times, Qibla, the Qur'an with audio and tafsir, authentic hadith and duas, a dhikr counter and the Islamic calendar. Free, private, and built to feel at home on every screen: iPhone, Android, iPad and Android tablets, Chromebooks, Windows and Mac laptops, and large desktop monitors.

Live at **[salaamstreet.com](https://salaamstreet.com)**.

## The story

SalaamStreet began as an Islamic-themed Shopify shop that Ibrahim built when he was 12. It didn't take off, and neither did his next attempt — so he kept the name and changed the idea: instead of selling to Muslims, give them something useful every day, for free. Ibrahim is now a student at Neuqua Valley High School and part of its Muslim Student Association; his father helps build it. The full story, our promise and the version history are on the in-app **About** page and at [salaamstreet.com/about](https://salaamstreet.com/about/).

**Our promise:** everything you need — prayer times, Qibla, Qur'an, duas, dhikr, the prayer tracker, Arabic learning and (when it arrives) sync — stays free forever. Any future paid extras (subscription or one-time) will only be for things that genuinely cost money to provide.

Current version: **3.0.5 — Analytics for admins** (see `SS.VERSION` / `SS.CHANGELOG` in `js/content.js`).

## Features

- **iPhone app (3.0.0 Beta)** — the website itself, bundled in an iOS app ([`ios/`](ios/README.md)), plus what only an iPhone can do: recitation that keeps playing with the phone locked (Lock Screen controls), reminders with an "I prayed" button, a prayer countdown on the Lock Screen and in the Dynamic Island, Home Screen and Lock Screen widgets, Siri and Shortcuts, Control Centre, Spotlight and haptics
- **Community Rules (3.0.2)** — seven short rules everyone with an account agrees to (a required box before any sign-in; existing accounts are asked once). Warnings and bans give one of the rules as the reason plus an optional message; a ban works at once on every device, shows the person why and when it ends, and offers an **Appeal**. **3.0.3:** banned people can still sign in and appeal; only their account's online features (SalaamStreet AI, the NVHS MSA, sync) are off, and a ban for an offensive name or email shows only the ban. Rules: [`terms/#rules`](https://salaamstreet.com/terms/#rules). Details: [`docs/release-notes/3.0.2.md`](docs/release-notes/3.0.2.md)
- **Admin Panel (3.0.1, more in 3.0.2; Analytics in 3.0.5)** — a private page for the people who run SalaamStreet, at `#/admin` on the website and in the iPhone app (in the More menu and sidebar, shown only to admins). 3.0.2 adds ban/warn with a reason and message, Appeals, blocked emails, bulk actions, CSV downloads, the Home banner and auto-refresh. Overview of accounts, sign-ups by day, sign-in methods and SalaamStreet AI today; search and filter every account and open one to see what it uses (counts only, never anyone's AI conversations or notes) and ban, unban, sign out everywhere, flag, pause SalaamStreet AI or delete it; sign-up screening that flags (or refuses) emails and names containing slurs; SalaamStreet AI's main switches; the NVHS MSA's latest posts; the admin list; and a log of every admin action. The server decides everything: each request is checked against the admin list (signed in with Google) by an Edge Function and again by the database. Setup: [`backend/README-backend.md`](backend/README-backend.md#301--admin-panel)
- **Offline page (3.0)** — `#/offline` (on the website and in the iPhone app): download the Qur'an text and translations, recitation, Tafsir Ibn Kathir and hadith collections; see what's built in and what needs a connection; manage storage. Details: [`docs/07-offline.md`](docs/07-offline.md)
- **SalaamStreet AI (3.0)** — an Islamic assistant for everyone with a free account, at `#/ai` (SalaamStreet AI in the menus). It only answers Islamic questions, never invents verses or hadith, and refers rulings to scholars. It answers from the app's own verified text where it can: ayahs mentioned in a question ("2:255"), `/tafsir 2:255` (Tafsir Ibn Kathir) and `/hadith nawawi 1` (the 10 hadith collections) are sent with the question and shown under the answer, and ayah references in answers link to the Qur'an. Other commands (`/bookmarks`, `/ayah`, `/progress`, `/plan`, `/dua`, `/quiz`, `/reflect`) use your own app data when you allow it. Follow-up suggestions, read aloud, Save (a text file on your device) and 👍/👎 (only the number is stored); "Ask SalaamStreet AI" in the tafsir sheet. Each person has a daily allowance; when it's busy, people wait in a fair line and their question is sent automatically. Conversations aren't stored. Setup and limits: [`backend/README-ai.md`](backend/README-ai.md)
- **NVHS MSA (2.11)** — the Neuqua Valley High School Muslim Student Association's announcements, with pictures, for members only (3.0.4; members, MSA admins and the approver — checked by the database); important ones also show as one slim, hideable card on members' Home. Only the MSA's own accounts can post, edit, pin and delete, checked by the database on every write. **Members (2.11.6):** students join with their name and the 6-digit meeting code (changes every 10 minutes, shown only to the MSA's approver), or by asking; the approver checks requests against a roster kept only in the database; a name that already belongs to a member is flagged for an in-person check; (3.0.4: every announcement is members-only; to see them on a personal account instead of a school one, students ask Ibrahim Ahmed for the 10-minute meeting code — in person, by text or by email, shown on the MSA page). **2.11.7:** students on the roster who sign in with their school email (emailed code, not Google) are accepted automatically. **2.11.8:** one list of MSA admins — only they post, and they manage members; admins add students (with the email they sign in with) and other admins on the Manage page, which also has “approve all on the list”, who joined this week and a CSV download. Setup: [`backend/README-backend.md`](backend/README-backend.md#31--nvhs-msa-announcements)
- **Modes (2.10, redesigned in 2.11.5)** — each mode answers one question right inside Home's prayer card; switch with one tap from the mode badge in the top bar, or from Modes in the sidebar or More menu. Your mode syncs when you're signed in. Details: [`docs/06-modes.md`](docs/06-modes.md)
  - **Normal** — the full SalaamStreet, unchanged
  - **Travel** — *how do I pray here?* Dhuhr, Asr and Isha as 2 rak'ahs and when you may combine, with sources; local prayer times and Qibla (with or without location permission), a destination and saved places, a trip end date that brings you home in one tap, travel duas, a checklist, and guidance that sets out where the schools differ
  - **Hajj & Umrah** — *what do I do next?* Your next step on Home, a tap counter for the 7 rounds of tawaf and sa'i, 7-step Umrah and 11-step Hajj guides with sources, duas and scholarly differences, and a preparation checklist
  - **Mosque** — *is my phone ready for the mosque?* One "I'm at the mosque" tap turns on Quiet Mode for an hour; choose and save your mosque (OpenStreetMap), its calculated prayer times, next Friday, Qibla, mosque duas and a Jumu'ah time you note yourself
  - **Kids** — set up from the Family page: a parent-managed space for children: parents add each child (first name, age range, avatar), choose what they can use, and see their progress; a child's device connects with a one-time code and never gets the parent's password. Prayer and wudu lessons, short surahs, everyday duas, stories by age, Names of Allah, manners and history, quizzes and gentle achievements — restrictions enforced by the server
- **Free accounts (optional) + Guest Mode** — use everything without an account, or sign in with Apple, Google, phone or email to keep bookmarks, streaks, Qur'an progress and settings in sync on all your devices. Guest data is merged in when you sign in; nothing is lost. Setup: [`backend/README-backend.md`](backend/README-backend.md)
- **Your SalaamStreet (Account page)** — prayer and dhikr streaks (current and best), Continue Reading across devices, Qur'an progress, recently read, bookmark collections with notes and search, saved duas, sign-in methods and sync status
- **Prayer times** — device location or a city you type in, 7 calculation methods, Standard/Hanafi Asr, today's times and a monthly timetable (AlAdhan API, cached; calculated on the device when there's no connection)
- **Qibla finder** — one clear instruction at a time and a big “Start compass” button; live compass corrected from magnetic to true north (WMM2025), works flat or upright and in any screen rotation; **Camera Mode** overlays the direction on your camera view with turn-left/right guidance, and both lock on with a short vibration when you face the Qibla; bearing and distance to Makkah everywhere (computed on your device)
- **Qur'an reader** — all 114 surahs in Uthmani script with Saheeh International translation, optional transliteration, adjustable Arabic text size, bookmarks, resume where you left off, copy an ayah
- **Recitation** — 4 reciters, per-ayah or continuous playback, speed and repeat controls, lock-screen/media-key controls
- **Tafsir** — Ibn Kathir (English) for any ayah, with previous/next ayah, in a bottom sheet on phones
- **Offline Qur'an** — on the Offline page: download the whole Qur'an once (Arabic, your translation and transliteration; more translations optional), plus recitation per surah or all of it, and Tafsir Ibn Kathir; resumable downloads with pause/cancel, stored only on your device. An optional Qur'an PDF (when the site provides one) can be saved to the device and read offline in the built-in viewer
- **Hadith library** — 10 collections: the 40 Hadith of an-Nawawi, Qudsi and Shah Waliullah in full; the Six Books (Bukhari, Muslim, Abu Dawud, Tirmidhi, Nasa'i, Ibn Majah) and the Muwatta of Imam Malik to browse by number or jump to any book; Arabic, English, reference and every scholar's grading (weak grades marked); a Hadith of the day
- **Knowledge** — the five pillars, the six articles of faith and ihsan with their sources, and short explanations of hadith terms (sahih, hasan, da'if, isnad …)
- **SalaamStreet Stories** — 17 true stories in four groups (the Prophets, stories from the Qur'an, the Prophet ﷺ and his Companions, stories the Prophet ﷺ told), told only from the Qur'an and authentic hadith: every Qur'an quote is loaded from the app's Qur'an source, every part shows its source, each story ends with its lesson, and Play/Pause recites the story slide by slide; plus a daily "Today" story
- **Dua library** — authentic supplications with Arabic, transliteration, translation and a source on every dua; favourites and copy
- **Dhikr counter** — big tap target (or Space bar on desktop), presets with sourced targets, undo, today's totals, daily streaks, haptic feedback
- **Islamic calendar** — today's Hijri date and approximate countdowns to key dates
- **Prayer tracker** — tick off each prayer, see the last 7 days and your streak (on your device; synced only if you sign in)
- **Prayer reminders** — opt-in notifications at (or before) each prayer with an “I prayed” button, a soft chime, a Friday Al-Kahf reminder and morning/evening adhkar reminders; optionally they arrive even when SalaamStreet is closed (Web Push, see [`backend/README-push.md`](backend/README-push.md))
- **Made for the installed app** — “Did you pray?” check-in on Home, a daily Qur'an goal, an app-icon badge for prayers not yet ticked, a recitation sleep timer, the screen kept on while reading, a Friday summary of your week, and a prompt when a new version is ready
- **Morning & evening adhkar** — a guided routine with a counter for each remembrance and automatic progress
- **Ramadan card** — appears automatically in Ramadan: suhoor/iftar times and countdown, plus a fasting log
- **Qur'an reading plans** — finish the Qur'an in 30 (one juz a day), 60, 120 or 365 days
- **Memorize mode** — hide the Arabic, recite, tap to check; loop an ayah 3×, 5×, 10× or endlessly
- **Juz navigation, translation search, 9 translation languages** (English, Urdu, Indonesian, Turkish, Bengali, French, Malay, Spanish, German)
- **Share as image** — turn any ayah, dua or hadith into a ready-to-post card
- **99 Names of Allah** — with a Name of the day on the home screen
- **Ayah of the Day** — on the home screen, with audio in your chosen reciter
- **Mosque finder** — nearby mosques from OpenStreetMap with one-tap directions
- **Learn to read Arabic** — the 28 letters and their shapes, the vowel marks, and a quick quiz
- **Prayer-times widget for mosques** — a free embed builder at [`/widget/`](https://salaamstreet.com/widget/): pick a location, method and style, copy one line of code
- **Search-friendly pages** — every surah, the dua library, the 99 Names, a Qibla direction page and prayer times (with the Qibla direction) for 60 major cities have their own indexable page, with structured data, breadcrumbs and a share card, plus `sitemap.xml`
- **7 interface languages** — English and Arabic, plus draft Urdu, Bengali, Indonesian, Turkish and French (loaded only when chosen; pending native-speaker review) — with full right-to-left layout for Arabic and Urdu · **Light / dark / system theme** · **Installable** (add to home screen) · **Works offline** for anything you've already opened, and for the whole Qur'an, recitation, tafsir and hadith once downloaded (the Offline page)

## Principles

- **Authenticity:** Qur'an text comes from Tanzil (Uthmani) via AlQuran Cloud; every dua and dhikr preset carries its source. Nothing is invented or generated.
- **Privacy-first:** no account needed — as a guest everything personal stays in your browser's localStorage. If you choose to sign in, your bookmarks, streaks, progress and settings sync to your own account (protected by Row-Level Security); your location never does. Location is used only after you choose an option, is rounded to ~1 km, and is sent only to the prayer-times API. Export or delete everything in Settings; delete your account in Account.
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
│   ├── extras.js         Calendar events, hadith collections + Knowledge content
│   ├── hadith-books.js   Book (kitab) index for the large hadith collections, loaded on demand (generated)
│   ├── content.js        99 Names, juz boundaries, adhkar sequence, Arabic letters, translations
│   ├── i18n.js           English/Arabic strings, language loading, RTL switching
│   ├── lang/             Draft interface languages (ur, bn, id, tr, fr), loaded on demand
│   ├── praytimes.js      Prayer times calculated on the device (offline fallback; also used by the reminder server)
│   ├── core.js           Config, storage (+ sync hooks), API clients with caching, location flow, Qibla bearing
│   ├── offline.js        Offline downloads: IndexedDB text/tafsir/hadith, cached audio + PDF, resumable downloads
│   ├── views.js          One controller per view
│   ├── features.js       Tracker, reminders, adhkar, Names, mosques, Arabic, plans, share cards
│   ├── stories.js        The stories (narration + Qur'an/hadith references; Qur'an text loaded from its source)
│   ├── stories-ui.js     Stories library, tap-through viewer with Play/Pause
│   ├── daily.js          Did-you-pray, Qur'an goal, adhkar reminders, wake lock, icon badge, Friday summary, sleep timer
│   ├── push.js           Opt-in reminders when the app is closed (Web Push)
│   ├── offline-ui.js     The Offline page (#/offline), Qur'an page cards, PDF viewer
│   ├── qibla.js          Qibla compass + camera mode, WMM2025 declination, orientation maths
│   ├── config.js         Supabase URL + key for optional accounts (empty = guest-only)
│   ├── sync.js           Cross-device sync engine
│   ├── account.js        Sign-in, account linking, sync wiring, Account dashboard
│   ├── admin.js          3.0.1 Admin Panel (#/admin), loaded only when an admin opens it
│   ├── standing.js       3.0.2 Community Rules, ban screen + appeals, warnings, admin link, Home banner
│   ├── vendor/supabase.js  supabase-js (MIT), loaded only when someone uses accounts
│   ├── vendor/pdfjs/     Mozilla pdf.js (Apache-2.0), loaded only for the Qur'an PDF
│   ├── modes.js          2.10 Modes: registry, active mode, #/modes picker, Home mode panel, suggestions, Quiet Mode
│   ├── modes/            Mode modules, loaded only when opened: travel.js, hajj.js, mosque.js, kids.js (Family + Kids)
│   └── app.js            Router, theme, dialogs, audio player, boot
├── files/                The Qur'an PDF (see SS.QURAN_PDF in js/config.js)
├── sw.js                 Service worker (offline app shell; keeps the ss-offline-* caches)
├── manifest.webmanifest  PWA manifest · icons/ app icons
├── 404.html · CNAME · .nojekyll   GitHub Pages
├── widget/               Prayer-times widget: builder (index.html) + iframe (embed.html)
├── surah/ duas/ names-of-allah/ prayer-times/   Generated SEO pages (see below)
├── tools/build-pages.js  Generator for the SEO pages + sitemap.xml
├── tools/build-splash.js Generator for the light/dark iOS launch screens
├── tools/build-hadith-books.js Generator for js/hadith-books.js (from hadith-api)
├── tools/build-push-messages.js Copies reminder texts + praytimes.js to the reminder server
├── ios/                  iPhone app: the website in a WKWebView + native features — see ios/README.md
├── tools/build-ios-webapp.js  Copies the website (and its fonts) into the iPhone app — run after website changes
├── tools/build-ios-assets.js  Draws the iPhone app's icon, launch logo and Lock Screen artwork
├── backend/              Supabase schema, setup guides, functions/send-reminders (closed-app reminders), functions/ai-lab (SalaamStreet AI + the private AI Testing Lab) and functions/admin (the Admin Panel)
├── tests/                Unit, database (PGlite) and browser (Playwright) tests
└── docs/                 Product, architecture and design notes
```

Plain `<script defer>` tags — no ES modules and no build step — so the site works on any static host and even when `index.html` is opened directly from disk.

## Generated pages

The pages under `surah/`, `duas/`, `names-of-allah/` and `prayer-times/`, plus `sitemap.xml` and `robots.txt`, are generated from the app's data files. After changing `js/surahs.js`, `js/duas.js` or `js/content.js`, regenerate and commit them:

```bash
node tools/build-pages.js
```

## Accounts (optional)

Accounts need a free Supabase project. Until `js/config.js` is filled in, the
site runs in guest mode only (fully working). Step-by-step setup, including
Apple, Google, SMS and email templates: [`backend/README-backend.md`](backend/README-backend.md).

## Tests

The site has no build step; `package.json` only holds developer tooling.

```bash
npm install          # Playwright + PGlite (dev only)
npm test             # all tests
npm run lint         # ESLint
```

- `tests/sync.test.js` — sync engine across simulated devices (conflicts, offline, guest migration)
- `tests/schema.test.js` — `backend/supabase-schema.sql` in a real Postgres (RLS, newest-wins, delete account)
- `tests/qibla.test.js` — Qibla bearings vs published values, WMM2025 declination, orientation maths
- `tests/family.test.js` — 2.10 Family & Kids Mode in a real Postgres: parents only reach their own children, a child's device only its own child, single-use expiring pairing codes, server-enforced restrictions, achievements, deletion
- `tests/praytimes.test.js` — on-device prayer times vs the adhan library (8 cities, 4 seasons, every method)
- `tests/push.test.js` — the reminder server: what's due when, sent once, in the device's language
- `tests/ai-lab.test.js` — the private AI Testing Lab's server in a real Postgres: admin-only access checked on every request, limits, emergency switches, Gemini errors, no secrets in the website ([`backend/README-ai.md`](backend/README-ai.md))
- `tests/admin.test.js` — the Admin Panel's server in a real Postgres: only an admin's Google account gets in (and the database checks again), sign-up screening, ban / sign out / delete with the log, never on yourself or another admin, the admin list, the iPhone app's origin
- `tests/ios-bridge.test.js` — the iPhone app's bridge on the real website in Chromium (prayer times in the location's time zone, reminders, "I prayed", the recitation queue) and that the app's copy of the website is current
- `tests/offline.test.js` — the Offline page and downloads in Chromium with real IndexedDB/Cache API: storage, read-path fallback, resume after a dropped connection or closed tab, quota errors, PDF card hidden while the file is missing
- `tests/e2e.test.js` — the app in Chromium: startup theme, Tafsir, Qibla compass/camera, guest mode, every sign-in method driven through the real supabase-js client against a mock Supabase API, and the Offline Qur'an (text, audio across surahs, the PDF viewer offline), and every 2.10 mode: switching and persistence, Travel without location and offline, Hajj & Umrah progress, Mosque and Quiet Mode, suggestions, the full parent/child flow against the real database functions, and layout in light and dark

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

## External services (all free)

| Service | Used for |
|---|---|
| [AlAdhan API](https://aladhan.com/prayer-times-api) | Prayer times, Hijri date, city lookup |
| [AlQuran Cloud API](https://alquran.cloud/api) | Qur'an text, translation, transliteration |
| [Islamic Network CDN](https://cdn.islamic.network) | Per-ayah recitation audio |
| [tafsir_api (spa5k)](https://github.com/spa5k/tafsir_api) via jsDelivr (GitHub raw as fallback) | Tafsir Ibn Kathir |
| [hadith-api (fawazahmed0)](https://github.com/fawazahmed0/hadith-api) via jsDelivr | Hadith collections |
| [OpenStreetMap Overpass API](https://overpass-api.de) | Mosque finder |
| Google Fonts | Figtree, IBM Plex Sans Arabic, Scheherazade New, Amiri |
| [Supabase](https://supabase.com) (only when signed in) | Optional accounts and sync (needs your project URL + anon key) |

Responses are cached in localStorage, so surahs you've read and today's prayer times keep working offline. For the whole Qur'an, the Offline page (`#/offline`) downloads the text (and optionally recitation, tafsir and hadith collections) into IndexedDB and the Cache API on the device; nothing downloaded is ever synced to an account.

## Roadmap

What's planned after **3.0: the AI update** (optional Plus, Pro and Max plans are deferred; everything free today stays free) — Personalization, Qur'an, Learning, Community, Ramadan, Tools, Family, Notifications and Polish: [`ROADMAP.md`](ROADMAP.md). Release history: [`docs/05-roadmap.md`](docs/05-roadmap.md) and [`docs/release-notes/`](docs/release-notes/).
