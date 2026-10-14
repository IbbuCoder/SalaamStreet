# SalaamStreet for iPhone and iPad — 3.0.0 Beta (build 1)

A native SwiftUI app with the same content, prayer calculations and offline
model as [salaamstreet.com](https://salaamstreet.com). It is not a web view:
every screen is native, prayer times are calculated on the device, and the
Lock Screen countdown and Qur'an player use Apple's own frameworks.

## What's in it

| Area | What it does |
|---|---|
| **Today** | Next prayer with a live countdown, today's times with tracker ticks, Jumu'ah card (and a one-tap way to Surah Al-Kahf) on Fridays, offline/location status, quick links |
| **Prayer** | Any day's times, monthly timetable, 7 calculation methods, Standard or Hanafi Asr (explained, neither presented as the only view), location (device, city search or Makkah), prayer tracker with streaks and 30-day history, reminders |
| **Lock Screen & Dynamic Island** | A prayer countdown Live Activity (ActivityKit + WidgetKit): compact, minimal and expanded Dynamic Island, and a full Lock Screen layout. Opens the Prayer screen when tapped. Choices: on/off, start when the app opens, show the Arabic name, show the following prayer |
| **Reminders** | Local notifications at or before each prayer (per prayer), an **I prayed** action that ticks the tracker, a Friday Al-Kahf reminder — all scheduled on the device |
| **Qur'an** | 114 surahs, Uthmani Arabic in Scheherazade New, 9 translations, transliteration, Arabic text size, continue reading, copy/share, Tafsir Ibn Kathir |
| **Recitation** | 4 reciters, ayah-by-ayah with gapless queueing, background audio, Lock Screen / Control Centre Now Playing with artwork and progress, play/pause/next/previous/scrub, repeat (memorisation) and speed, interruption and headphone-unplug handling, downloaded audio played from the device |
| **Qibla** | Compass (true north when location is allowed), turn-left/right guidance, haptic when aligned, distance to the Kaaba |
| **Duas, dhikr, 99 Names** | The website's library (every dua with its source), favourites, a dhikr counter with sourced presets and haptics |
| **Hadith** | The website's 10 collections; downloaded collections read offline |
| **Mosques** | Nearby mosques from Apple Maps with directions |
| **Offline** | See below |

Everything personal (settings, tracker, favourites) stays on the device. There
are no accounts, ads or analytics in the iOS app.

## Open, build and run

Requirements: **Xcode 16 or later** (the project uses Xcode 16's folder-synced
groups), iOS 17.0+ deployment target.

1. Open `ios/SalaamStreet.xcodeproj`.
2. Select the **SalaamStreet** target → *Signing & Capabilities* → choose your
   team (and the same for **SalaamStreetWidgetsExtension**). Change the bundle
   identifiers (`com.salaamstreet.app`, `com.salaamstreet.app.widgets`) if you
   don't own them.
3. Run on a device or simulator. Live Activities need an iPhone with a Dynamic
   Island to see the island views; the Lock Screen view works on any iPhone
   (and in the simulator).

No secrets, keys or provisioning files are in the repository.

Files added to `SalaamStreet/`, `SalaamStreetWidgets/` or `SalaamStreetUITests/`
join their target automatically.

### Project layout

```
ios/
├── SalaamStreet.xcodeproj           App, widget extension and UI-test targets; shared scheme
├── Config/                          Info.plists (app: background audio + fetch, Live Activities, URL scheme)
├── SalaamStreet/                    The app (SwiftUI)
│   ├── App/                         Entry point, app model, router (deep links), tab layout
│   ├── Design/                      Shared components (panels, banners, Arabic text, pills)
│   ├── Services/                    Settings, location, notifications, Live Activity, network status
│   ├── Features/                    Today, Prayer, Qur'an, Audio, Qibla, Duas, Hadith, Mosques, Offline, Settings, More
│   ├── Resources/Fonts/             Scheherazade New (SIL Open Font License, licence file alongside)
│   ├── Assets.xcassets              App icon, logo, Now Playing artwork, colours
│   └── PrivacyInfo.xcprivacy        Privacy manifest (no tracking, no data collected)
├── SalaamStreetWidgets/             Live Activity (Lock Screen + Dynamic Island)
├── SalaamStreetUITests/             Simulator walkthrough with screenshots
└── SalaamStreetCore/                Swift package shared by the app and the extension
    ├── Sources/SalaamStreetCore/    Prayer astronomy, Qibla, content library, offline model,
    │                                tracker, reminder planner, Live Activity state, brand colours
    └── Tests/                       Unit tests (run on macOS, Linux and iOS)
```

### Versions

`MARKETING_VERSION = 3.0.0`, `CURRENT_PROJECT_VERSION = 1` (shown in the app
as **3.0.0 Beta (1)**). App Store versions must be numeric, so "Beta" is not
part of the version string. `tests/ios-content.test.js` checks these.

## Shared with the website

- **Content.** `SalaamStreetCore/Sources/SalaamStreetCore/Resources/content.json`
  is generated from the website's `js/surahs.js`, `js/duas.js`, `js/content.js`,
  `js/extras.js` and `js/core.js` by `node tools/build-ios-content.js`. Edit the
  website files, run the tool, commit both. `npm test` fails if they drift.
- **Prayer times.** `PrayerCalculator.swift` is a line-for-line port of
  `js/praytimes.js`. The Swift tests compare every method × both Asr schools ×
  7 cities × 4 seasons against fixtures produced by the JavaScript (392 cases),
  minute for minute.
- **Offline model.** Pack ids (`text:<edition>`, `tafsir`, `audio:<reciter>`,
  `hadith:<collection>`), size estimates and the cancel rules are the same as
  `js/offline.js`.
- **Brand.** Colours come from `css/styles.css` and the logo; the app icon,
  logo and artwork are drawn from one vector by `node tools/build-ios-assets.js`.

## Offline on iOS

The **Offline** screen (More → Offline, or the download button on Today and the
Qur'an list) lets people choose what to keep:

| Category | Stored | Notes |
|---|---|---|
| Qur'an text | Arabic (Uthmani), transliteration, chosen translation; other translations optional | about 3 MB |
| Recitation | Per reciter, all 114 surahs or chosen surahs | about 1 GB per reciter for the whole Qur'an; plays offline and in the background |
| Tafsir Ibn Kathir | English, every ayah | about 16 MB |
| Hadith | Any of the 10 collections, English + Arabic | sizes are estimates until downloaded |

How it works (`Features/Offline/OfflineLibrary.swift`):

- Files live in *Application Support/Offline*, **excluded from iCloud backup**
  (they can be downloaded again). A small `manifest.json` records what is stored
  and which downloads are pending.
- Downloads run a few requests at a time with retries and back-off; anything
  already stored is skipped, so a download interrupted by a lost connection or
  the app closing **resumes where it stopped** on the next launch. iOS gives a
  download a little time to finish if the app is sent to the background.
- Before starting, free space is checked; a full disk stops with a clear
  message. Losing the connection pauses the download and it carries on when
  the connection returns.
- Files are written atomically and checked when read. A damaged file is
  deleted, forgotten and the person is told to download it again. At launch,
  anything the manifest lists but the disk no longer has is forgotten.
- Pause, resume, cancel, remove one item (or one surah's recitation), remove
  all. Storage used (measured on disk) and free space are shown.
- Large downloads (100 MB+, or 20 MB+ on mobile data) ask first.

Always available offline (nothing to download): prayer times and timetables,
the Qibla, duas, dhikr, the 99 Names, the tracker, reminders and the Lock
Screen countdown. Needs a connection: anything not downloaded (it streams),
city search, and the mosque finder.

## Live Activity: what iOS allows

- An app can **start** a Live Activity only while it is open. SalaamStreet
  starts it when you turn it on, press *Start now*, or (if you chose) whenever
  you open the app.
- The **countdown ticks by itself** on the Lock Screen and in the Dynamic
  Island (`Text(timerInterval:)`); the app doesn't need to run.
- **Moving on to the next prayer** needs the app: it updates whenever it is
  open, and during background refreshes iOS chooses to grant (scheduled for
  just after each prayer). There is no push server, so if iOS doesn't grant a
  refresh, at the prayer time the activity says the prayer **has begun** (with
  its start time — accurate however long it stays) and asks you to open
  SalaamStreet for the next one.
- iOS ends any Live Activity after about 8 hours; opening the app starts a new
  one if *Start when I open SalaamStreet* is on.
- Deep links: `salaamstreet://prayer`, `salaamstreet://quran/18`,
  `salaamstreet://quran/2/255`, `salaamstreet://offline`, `salaamstreet://qibla`.

## Tests

```bash
cd ios/SalaamStreetCore && swift test          # unit tests (macOS or Linux)
xcodebuild test -project ios/SalaamStreet.xcodeproj -scheme SalaamStreet \
  -destination 'platform=iOS Simulator,name=iPhone 16'   # UI walkthrough + unit tests on iOS
```

`.github/workflows/ios.yml` runs all of this on a macOS runner (Xcode 16) for
every change under `ios/`, in light and dark appearance, and uploads the
screenshots as an artifact.

Not covered by automated tests (needs a real device): the Dynamic Island
itself, Lock Screen media controls, background audio while locked, compass
readings, notification delivery and background refresh timing.

## Sources and licences

Content is fetched by the device directly from the same sources as the website;
none of it is redistributed in this repository except the website's own data.

- Qur'an text: Tanzil (Uthmani) via AlQuran Cloud; translations via AlQuran Cloud
- Recitation: Islamic Network CDN
- Tafsir Ibn Kathir (English): spa5k/tafsir_api
- Hadith: fawazahmed0/hadith-api
- Font: Scheherazade New © SIL Global, SIL Open Font License 1.1 (`Resources/Fonts/ScheherazadeNew-OFL.txt`)
