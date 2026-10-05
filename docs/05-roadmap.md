# SalaamStreet — Roadmap

The web app is the product — one responsive site for phones, tablets,
laptops and large monitors. Core worship features are, and will stay, free.

## Shipped

- Prayer times (7 methods, Standard/Hanafi Asr, today + monthly timetable)
- Qibla compass with device orientation, bearing and distance
- Qur'an reader: 114 surahs, translation, transliteration, adjustable Arabic size,
  4 reciters with continuous play, speed and repeat, bookmarks, resume, tafsir
- Hadith library (Nawawi 40, Qudsi 40, Bukhari, Muslim)
- Dua library with favourites and copy
- Dhikr counter with presets, undo, daily totals and streaks
- Islamic calendar with approximate countdowns to key dates
- English/Arabic with full RTL, light/dark/system themes
- Installable (PWA) with offline app shell
- Prayer tracker with weekly view and streaks; in-app prayer reminders; Friday Al-Kahf reminder
- Guided morning & evening adhkar; Ramadan mode (suhoor/iftar countdown, fasting log)
- Qur'an reading plans, juz navigation, memorize mode with ayah looping, translation search,
  9 translation languages, share-as-image cards
- 99 Names of Allah, mosque finder (OpenStreetMap), Arabic alphabet lessons and quiz
- Prayer-times widget for mosque websites; generated SEO pages and sitemap
- Draft interface languages: Urdu, Bengali, Indonesian, Turkish, French
- 2.4.0: About page, Updates tab with version history, new logo and iOS home-screen support
- 2.4.1: 12/24-hour time, km/miles, optional Imsak/Midnight/Last-third times, custom dhikr targets,
  continuous Qur'an play across surahs, richer Updates tab, provided logo used everywhere
- **2.5.0 — Accounts + Guest Mode:** optional free accounts (Apple, Google, phone, email) with
  cross-device sync of bookmarks, streaks, Qur'an progress and settings; guest mode with no account
  required and guest-data migration on sign-in; personal Account dashboard (streaks, Continue Reading,
  progress, recently read, bookmark collections/notes/search, saved duas); Qibla direction fix
  (magnetic-declination correction, full 3-D orientation, no direction without a real location) and
  Qibla Camera Mode; Tafsir fix (correct files, no stale commentary, previous/next ayah); startup
  theme fix (no light/dark flash, dark iOS launch screens)
- **2.5.5 — Quality of Life + Bug Fixes:** redesigned Qibla compass; smoother Camera Mode with
  turn-left/right guidance, a heading strip and a lock-on animation with a short vibration; Ayah of the
  Day audio; an "Opening soon" MSA tab (starting with the Neuqua Valley High School (NVHS) MSA); Google sign-in
  switched on and email + password accounts; installed-app launch colour now matches the theme
- **2.5.6:** the five draft interface languages now cover the whole app; MSA tab names the NVHS MSA;
  Account page layout fix on small phones
- **2.5.7:** Camera Mode turns the camera back on when you return to the app (no black screen) and never
  leaves it running in the background; iPhone launch screens follow light/dark mode; search: Qibla
  direction page, Qibla bearings on city pages, structured data, breadcrumbs and a 1200×630 share card
- **2.5.8 — SalaamStreet at a glance:** facts + FAQ page (with FAQ structured data), `/llms.txt` for AI
  assistants, AI crawlers welcomed in robots.txt, founders (Ibrahim, with his father Aquil) in the story
  and structured data
- **2.6.0 — Qur'an+: Offline Qur'an:** download the whole Qur'an once (Arabic Uthmani, your translation,
  transliteration) into on-device storage and read it with no internet; extra translations with sizes;
  recitation per surah or all of it, played offline including continuous play; Tafsir Ibn Kathir;
  resumable downloads (small parallel batches, retries, pause/cancel, carry on after a lost connection or
  closed tab), storage used and per-item removal; a Qur'an PDF card with save-to-device and an in-app
  offline viewer (pdf.js), shown once the PDF file is added. Downloads stay on the device, never synced
- **2.7.0 — Hadith + Knowledge:** 10 hadith collections (added Abu Dawud, Tirmidhi, Nasa'i, Ibn Majah, Muwatta
  Malik and Shah Waliullah's forty); jump to any book; every scholar's grading shown with weak grades marked;
  compiler on each collection; Hadith of the day; a Knowledge tab (pillars of Islam and Iman, ihsan, hadith terms);
  a calmer layout — grouped hadith lists, Home shortcuts in one card, Offline Qur'an on its own Settings page

## Planned (no release dates; plans may change)

The same list appears in the app under About → Updates (`SS.ROADMAP` in `js/content.js`).

- **2.8.0 — The SalaamStreet App:** a better experience for people who use SalaamStreet installed on their
  phone, tablet or computer, not just on the website
- **2.9.0 — MSA + Community:** tools for Muslim Student Associations and local communities (the MSA tab is
  already open as a preview)
- **3.0.0 — SalaamStreet Kids:** a safe, simple SalaamStreet for young children, with family accounts so parents
  can set it up and follow along

Also open: push reminders that arrive while the site is closed, and native-speaker
review of the draft Urdu, Bengali, Indonesian, Turkish and French translations.

## Principles

Qur'an, hadith and tafsir always come from established sources with citations
shown; nothing is generated. Scholarly differences (calculation method, Asr)
are user choices. Personal data stays on the device unless the user opts in by
signing in; even then, location and reminders stay on each device.
