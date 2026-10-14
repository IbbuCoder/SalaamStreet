# Offline — salaamstreet.com and the iOS app (3.0)

People can prepare SalaamStreet in advance and use it with no connection. Both
platforms have a dedicated **Offline** page in their main navigation, the same
categories, the same download ids and size estimates, and the same rule: say
plainly what works offline and what doesn't, and never leave a screen loading
forever.

## What can be downloaded

| Category | Id | Website storage | iOS storage |
|---|---|---|---|
| Qur'an text (Arabic, transliteration, your translation) | `text:<edition>` | IndexedDB `text` | `Offline/quran/text/<edition>/<surah>.json` |
| Other translations | `text:<edition>` | IndexedDB `text` | same |
| Recitation, per reciter, whole Qur'an or chosen surahs | `audio:<reciter>` | Cache API `ss-offline-audio` | `Offline/audio/<reciter>/<surah>/<ayah>.mp3` |
| Tafsir Ibn Kathir (English) | `tafsir` | IndexedDB `tafsir` | `Offline/quran/tafsir/ibn-kathir/<surah>.json` |
| Hadith collections (English + Arabic), new in 3.0 | `hadith:<collection>` | IndexedDB `hadith` (DB version 2) | `Offline/hadith/<collection>/{eng,ara}.json` |
| The Qur'an PDF (website only, when `SS.QURAN_PDF` is set) | — | Cache API `ss-offline-pdf` | — |

Nothing is downloaded automatically. Large downloads (100 MB or more) ask
first, and mention mobile-data cost when the device reports it.

Everything is fetched by the person's own device from the original sources
(AlQuran Cloud / Tanzil, the Islamic Network CDN, spa5k/tafsir_api,
fawazahmed0/hadith-api) — the same sources the website already reads online.
SalaamStreet does not host or redistribute that material.

## Built in (always offline, nothing to download)

Prayer times and monthly timetables (calculated on the device for any date),
the Qibla direction, duas with sources, dhikr presets, the 99 Names, Learn
Arabic (website), the prayer tracker and reminders. On the website these work
once the app shell has been saved by the service worker (one visit online).
The website's adhkar contain Qur'an passages loaded from the Qur'an API: they
work offline once the Qur'an text is downloaded or after being opened online.

## Needs a connection

Anything not downloaded (it streams, and recently read surahs are kept for a
while), SalaamStreet AI, the mosque finder, Qur'an translation search, the
website's calendar page (its Hijri date comes from AlAdhan; the prayer page
shows it offline from the device calendar), signing in and sync, and the NVHS
MSA announcements. The Offline page lists these.

## Website details

- **App shell:** `sw.js` caches the HTML, CSS, scripts and icons on install and
  serves same-origin files network-first so a new deploy is picked up at once.
  With no connection — or a connection that hangs for 4 seconds — it serves the
  cached copy, so a refresh while offline still opens the app. Bumping
  `VERSION` replaces the shell safely; caches starting `ss-offline` (downloads)
  are never deleted by an update.
- **Downloads:** `js/offline.js` runs resumable jobs (4 requests at a time,
  retries with back-off, skips what's stored, carries on after a closed tab or
  a dropped connection, stops with a clear message on a full disk) and asks the
  browser for persistent storage once. Nothing downloaded is synced to an
  account, and no database is opened until someone downloads something.
- **Read paths:** the reader, Ayah of the Day, tafsir and hadith use the
  download first, then the network (with the existing localStorage cache).
- **UI:** `js/offline-ui.js` renders `#/offline` (status, Qur'an, hadith, built
  in, needs a connection, storage). `#/settings/offline` (before 3.0) redirects
  there; Settings and the Qur'an page keep one summary card that links to it.
- **Limits:** browsers can clear site data under storage pressure unless
  persistent storage is granted (the page says so when it was refused); private
  windows may not allow storage at all (reported as a storage error).

## iOS details

See [`ios/README.md`](../ios/README.md#offline-on-ios): Application Support
(excluded from iCloud backup), a JSON manifest, resumable downloads, free-space
checks, atomic writes, corrupted-file detection, and downloaded recitation
played through the native audio player in the background.

## Tests

- `tests/offline.test.js` — website downloads in Chromium with real IndexedDB
  and Cache API, the Offline page, hadith downloads and cancel, and the service
  worker reloading the site offline and on a hanging connection.
- `ios/SalaamStreetCore/Tests` — the manifest (resume, no duplicate work,
  completion, removal), paths and estimates.
- `ios/SalaamStreetUITests` — opens the Offline screen in the simulator.
