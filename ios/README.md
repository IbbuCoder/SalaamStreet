# SalaamStreet for iPhone — 3.0.0 Beta (build 2)

The iOS app **is the website**. It runs the real SalaamStreet website, bundled
inside the app, in a full-screen web view — same design, same pages, same
features, same 7 languages and light/dark themes — and connects it to things
only an iPhone can do: recitation that keeps playing with the phone locked,
reminders with an "I prayed" button, a prayer countdown on the Lock Screen and
in the Dynamic Island, widgets, Siri, Spotlight and more.

- Bundle ID `com.salaamstreet.app` · iOS 17 or later · Xcode 16 or later
- No secrets anywhere in the app. `js/config.js` holds only Supabase's public
  (publishable) key, exactly as on the website.

## Open, build and run

1. Open `ios/SalaamStreet.xcodeproj` in Xcode 16 or later.
2. Choose the **SalaamStreet** scheme and an iPhone simulator (e.g. iPhone 16).
3. Press **Run** (⌘R). No other steps: the website is already in
   `ios/SalaamStreet/WebApp/`.

Tests: **Product → Test** (⌘U) runs both test bundles:

| Tests | What they check |
|---|---|
| `SalaamStreetTests` (unit, run inside the app) | the website starts with no JavaScript errors and no missing files, the four fonts load from the app, localStorage / IndexedDB / Cache API work, prayer data reaches the widgets, times use the location's time zone, the site works with all network access blocked, the bridge rejects unknown or invalid messages |
| `SalaamStreetUITests` | screenshots of the app and of salaamstreet.com page by page, offline screenshots, and a tap-through of the main journey |

The same runs on every push in GitHub Actions (`.github/workflows/ios.yml`, macOS
runner, light and dark). **Run workflow** with *publish_screenshots* also pushes
side-by-side images of the app and salaamstreet.com to the git ref
`refs/ios-screenshots/latest` (`git fetch origin refs/ios-screenshots/latest`). And `node --test tests/ios-bridge.test.js` checks the
bridge against the real website in Chromium.

## Run it on your iPhone (signing)

1. Xcode → **Settings → Accounts**: add your Apple ID.
2. Select the project → target **SalaamStreet** → **Signing & Capabilities**:
   tick *Automatically manage signing* and choose your **Team**. Do the same for
   the **SalaamStreetWidgetsExtension** target.
3. If Xcode says the bundle ID is taken, change `com.salaamstreet.app` (and
   `com.salaamstreet.app.widgets`) to something of your own, and the App Group
   `group.com.salaamstreet.app` in both `Config/*.entitlements` and in
   `Shared/SharedStore.swift` (`AppGroup.id`).
4. Connect the iPhone, pick it as the run destination, press Run. The first
   time, on the iPhone: **Settings → General → VPN & Device Management** → trust
   your developer certificate. (Developer Mode must be on: Settings → Privacy &
   Security → Developer Mode.)

Capabilities the project uses (Xcode adds them with automatic signing):
**App Groups** (widgets and Siri read the website's prayer times), **Time
Sensitive Notifications** (prayer reminders can break through a Focus),
**Background Modes → Audio** (recitation while locked) and **Background fetch**.
A free Apple ID can run the app; App Groups and Time Sensitive notifications
need a paid Apple Developer Program membership — without them the app still
runs, but widgets and Siri won't see your prayer times.

To make a release zip of the committed `ios/` folder: `sh tools/build-ios-zip.sh`
(writes `SalaamStreet-iOS-3.0.0-Beta.zip` and checks it after extracting).

## Build 2 (October 2026)

The app's copy of the website is updated to **3.0.1** (build 1 carried
3.0.0-beta): SalaamStreet AI out of beta, Siri shortcut links and the Admin
Panel. No Swift code changed. Deploy the Supabase functions first (GitHub →
Actions → Deploy Supabase): `ai-lab` and `admin` now accept the app's origin.

## When the website changes

The app does **not** update itself from salaamstreet.com. It carries its own
copy of the website. After changing the website, copy it into the app and
rebuild:

```bash
node tools/build-ios-webapp.js          # copy index.html, css/, js/, icons/, manifests, files/ + download the fonts
node tools/build-ios-webapp.js --check  # is the app's copy current? (also run by npm test and CI)
```

Then build the app again in Xcode. `tools/build-ios-assets.js` redraws the app
icon, launch logo and Lock Screen artwork from the website's icons (only needed
when those change).

The only change made to the copied website: `index.html` loads the fonts from
the app (`fonts/fonts.css`) instead of Google Fonts, so it works offline.
The SEO pages (`surah/`, `duas/`, …), `widget/`, `terms/` etc. are not copied:
links to them open on salaamstreet.com.

## How it works

```
ios/
├── SalaamStreet/
│   ├── Sources/
│   │   ├── App/AppDelegate.swift        scene, quick actions, deep links, Spotlight, router
│   │   ├── Web/WebViewController.swift  the full-screen WKWebView (no native bars)
│   │   ├── Web/AppSchemeHandler.swift   serves WebApp/ at app://salaamstreet/
│   │   ├── Web/NativeBridge.swift       website → iOS messages (validated, unknown ones rejected)
│   │   ├── Web/bridge.js                injected into the page: web APIs → native
│   │   └── Native/                      audio, notifications, location, sign-in, Siri, Spotlight…
│   └── WebApp/                          the website (generated by tools/build-ios-webapp.js)
├── Shared/                              App Group data, Live Activity, intents (app + widgets)
├── SalaamStreetWidgets/                 widgets, Live Activity UI, Control Centre toggle
├── SalaamStreetTests/ SalaamStreetUITests/
└── Config/                              Info.plists and entitlements
```

- **A real origin, not `file://`.** `WKURLSchemeHandler` serves the bundle at
  `app://salaamstreet/index.html`, so localStorage, IndexedDB, the Cache API,
  hash routing, ES modules (pdf.js) and `fetch()` work as on the website, and
  only files inside `WebApp/` can be read.
- **The bridge.** `bridge.js` runs before the website's scripts, and only in the
  app. It swaps the browser features that behave differently in an app for
  native ones behind the same web APIs, so the website's code is unchanged:

  | Website uses | In the app |
  |---|---|
  | `<audio>` + `mediaSession` | AVPlayer: plays with the phone locked, Lock Screen / Control Centre / Dynamic Island controls, artwork, next/previous ayah, headphone buttons; the sleep timer works locked |
  | `Notification`, Web Push, service worker reminders | local notifications planned 7 days ahead, with an **I prayed** button that ticks the tracker, the Friday Al-Kahf reminder, adhkar and Qur'an-goal reminders |
  | `navigator.vibrate` | Taptic Engine (dhikr counter, Qibla lock-on, Hajj rounds) |
  | `navigator.wakeLock` | keeps the screen on while reading, adhkar, dhikr |
  | `navigator.setAppBadge` | app icon badge |
  | `navigator.geolocation` | Core Location (one iOS prompt) |
  | `getUserMedia`, `DeviceOrientationEvent.requestPermission` | allowed for the bundled page only (Qibla camera and compass) |
  | `alert` / `confirm` / `prompt` | native alerts |

  Messages from the page go through `WKScriptMessageHandlerWithReply`. Only the
  bundled page, in the main frame, may call it; each action has a fixed name
  and typed, bounded fields; anything else is rejected. Without the handler
  (any browser) `bridge.js` does nothing.
- **Recitation while locked.** iOS pauses the page's JavaScript while the phone
  is locked, but the website picks the next ayah in JavaScript. So with each
  ayah the website also sends the ayahs that would follow (`SS.audio.plan()` in
  `js/app.js` — repeats, continuous play and story ranges included). The native
  player walks that list by itself, and when the page wakes up it catches up
  and adopts what is already playing instead of restarting. Downloaded
  recitation (Offline page) is copied to the app so it plays offline too.
- **Times are in the location's time zone everywhere** — the Lock Screen,
  widgets, Siri and reminders — like the website, even if the phone is in a
  different zone.

### Website changes made for the app

Only two, both inert in browsers:

- `js/app.js` — `SS.audio.plan()` lists the ayahs that will play next.
- `js/account.js` — sign-in results return to `SSNative.authRedirect`
  (`salaamstreet://auth-callback`) inside the app; in a browser it is the page's
  own address, as before.

## Sign-in inside the app

Google does not allow sign-in inside embedded web views, so the app opens
Google's page in the iPhone's secure sign-in sheet (`ASWebAuthenticationSession`,
which shares Safari's saved logins) and returns to the app at
`salaamstreet://auth-callback`. The website's own sign-in code then finishes
exactly as in a browser. **No keys or secrets are added to the app.**

You need to do this once (nothing to paste into the app):

1. **Supabase → Authentication → URL Configuration → Redirect URLs** → *Add URL*:
   `salaamstreet://auth-callback` → Save. Without this, Supabase refuses to send
   people back to the app.
2. **Google** — nothing new. The app uses the same Google *Web* OAuth client the
   website already uses (through Supabase). You do **not** need a Google "iOS"
   client: that is only for Google's native sign-in SDK, which this app doesn't use.
3. **Email** — sign-in codes work as on the website. Links in emails (confirm,
   reset password, magic link) open the app when tapped on the iPhone, because
   their redirect is `salaamstreet://auth-callback`. They won't open on a
   computer — use the code from the email there instead.
4. **Sign in with Apple** (recommended — see App Review below):
   follow [`backend/README-backend.md` § 7](../backend/README-backend.md) (Services ID,
   key, Supabase → Providers → Apple). The app's return address is already
   covered by step 1. Then add `"apple"` to `signInMethods` in
   `js/config.js` and run `node tools/build-ios-webapp.js`. This also turns on
   the Apple button on the website.

> **App Review:** apps that offer sign-in with Google must also offer an option
> like Sign in with Apple (App Store Review Guideline 4.8). Turn on Apple before
> submitting to the App Store; TestFlight and running from Xcode don't need it.

## Siri, Shortcuts and the Action button

Say "Hey Siri, …" with the app's name in the phrase (Siri requires it):

| Phrase | Does |
|---|---|
| "When is **Asr** in SalaamStreet?" | today's time and how long until it |
| "Next prayer in SalaamStreet" | the next prayer |
| "Start the prayer countdown in SalaamStreet" | Live Activity on the Lock Screen and in the Dynamic Island |
| "Stop the prayer countdown in SalaamStreet" | ends it |
| "Play Surah Al-Kahf in SalaamStreet" / "Play **Yasin** in SalaamStreet" | opens the surah and recites |
| "I prayed **Maghrib** in SalaamStreet" | ticks the tracker |
| "Find the Qibla with SalaamStreet" | opens the Qibla page |

All of them appear in the Shortcuts app, and any can be put on the **Action
button** (Settings → Action Button → Shortcut).

## Other iPhone features

- **Live Activity:** Settings → *Prayer countdown on the Lock Screen and in the
  Dynamic Island* (an app-only switch under Prayer reminders), Siri, or Control
  Centre. It moves on to the next prayer when the app runs or iOS refreshes it in
  the background; between those it shows the countdown to the prayer it was
  started for.
- **Widgets** (Home Screen, Lock Screen, StandBy): *Next prayer* (with an **I
  prayed** button), *Today's prayer times*, *Ayah of the Day* — the same ayah as
  the Home page.
- **Control Centre** (iOS 18): a prayer-countdown toggle.
- **Spotlight:** search any surah, dua or page.
- **Quick actions:** touch and hold the app icon → Prayer Times, Qibla, Qur'an, Dhikr.
- **Haptics, screen-on, app badge, edge swipe back** (the site's history).

## Offline on iOS

Everything the website keeps offline works the same, and the app itself (all
pages, fonts, the Qur'an PDF) is always available — nothing to download first.
The Offline page's downloads (Qur'an text, translations, recitation, tafsir,
hadith) use the website's own IndexedDB and Cache storage inside the app.
Downloaded recitation is also copied to the app's cache when played, so it keeps
playing locked and offline.

## Status of each feature (3.0.0 Beta, build 2)

"Tested in simulator" means an automated test in this repo checked it on an
iPhone 16 simulator (iOS 18.5, Xcode 16.4) in GitHub Actions. Nothing has been
tested on a physical iPhone yet.

| Feature | Status |
|---|---|
| The website in the app, every page, light and dark, 7 languages | tested in simulator (side-by-side screenshots with salaamstreet.com, no JavaScript errors, no missing files, fonts from the app) |
| Works with no connection (bundled site, on-device prayer times) | tested in simulator (all http(s) blocked) |
| Offline page downloads (IndexedDB + Cache API) | tested in simulator (recitation downloaded, then played from the device by the native player) |
| Recitation with the phone locked, Lock Screen controls, next ayah by itself | tested in simulator (native player, Lock Screen title, moves on and the page follows); playing while actually locked: needs a device |
| Reminders a week ahead, "I prayed" button, Friday Al-Kahf | tested in simulator (scheduled at the location's prayer times); tapping a delivered notification: needs a device |
| "I prayed" from a notification / widget / Siri reaches the tracker | tested in simulator |
| Live Activity / Dynamic Island countdown, location's clock | tested in simulator (screenshot of the Dynamic Island; "05:10" Auckland time on a GMT phone) |
| Haptics (dhikr, Qibla lock-on) | implemented and tested in Chromium (messages); feel: needs a device |
| Keep the screen on, theme follows the site | tested in simulator |
| App icon badge | implemented; needs a device to see |
| Location (Core Location) | tested in simulator |
| Qibla compass and camera mode | implemented (permissions wired); needs a device (the simulator has no compass or camera) |
| Google sign-in through the system sheet | tested in simulator (the iOS sign-in prompt appears); finishing sign-in needs user configuration (Supabase redirect URL) |
| Sign in with Apple | needs user configuration (see above) |
| Widgets (Home Screen, Lock Screen, StandBy), interactive "I prayed" | built; not placed on a Home Screen by the tests |
| Siri / Shortcuts / Action button | built (App Shortcuts in the app's metadata); needs a device to talk to |
| Control Centre toggle (iOS 18) | built |
| Spotlight | built; the simulator never confirms indexing, so its test is skipped |
| Quick actions | tested in simulator (in the website's language) |
| Admin Panel (website 3.0.1: Settings → Admin Panel, admins only) and SalaamStreet AI | the app's origin `app://salaamstreet` is allowed by the `admin` and `ai-lab` functions (tested in Node); signing in and using them in the app: needs a device and the functions deployed |

## Permissions (Info.plist)

| Prompt | Used for |
|---|---|
| Location (while using) | prayer times, Qibla, nearby mosques — only after you choose "use my location" on the website |
| Camera | Qibla camera mode only |
| Notifications | reminders, when you turn them on in Settings |

Motion (compass) uses WebKit's own prompt; the app grants it only to the bundled page.
