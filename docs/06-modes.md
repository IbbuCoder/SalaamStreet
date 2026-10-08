# SalaamStreet 3.0 — Modes: design and implementation notes

This is the working plan and architecture record for the 3.0 Modes release.
It describes what is built and how; `README.md`, `docs/05-roadmap.md` and
`ROADMAP.md` say what shipped and what is planned.

## 1. What existed before 3.0 (reused, not rebuilt)

| Need | Existing piece |
|---|---|
| App shell, routing | `index.html` (one `<section>` per view), hash router in `js/app.js` |
| Storage, location, APIs | `js/core.js`: `SS.store` (localStorage, with sync write hooks), `SS.geo` (4-option location dialog, never prompts on its own), `SS.api.prayerTimes` (AlAdhan, cached, calculated on the device offline), `SS.api.geocodeCity`, `SS.api.mosques` (OpenStreetMap Overpass), `SS.qiblaBearing` |
| Accounts | Supabase Auth + RLS (`backend/supabase-schema.sql`), `js/account.js` |
| Cross-device sync | `js/sync.js`: listed localStorage keys become records in `sync_records`; guest data is merged on first sign-in |
| Duas, dhikr, names, stories, knowledge | `js/duas.js`, `js/content.js`, `js/stories.js` + `js/stories-ui.js`, `js/extras.js` |
| Qur'an text + audio | `SS.api.surahText` (AlQuran Cloud / Offline Qur'an), `SS.audio` |
| Theme, i18n | `SS.applyTheme` (light/dark/system), `js/i18n.js` + `js/lang/*` |
| Offline | `sw.js` app-shell cache |

There was no section called "Memento" in the code base. The personal
dashboard closest to that description is the Account page ("Your
SalaamStreet": streaks, progress, bookmarks, saved duas), so the Modes entry
card lives there, and Modes is also in the sidebar and the phone "More" sheet.

## 2. Architecture

```
js/modes.js            (loaded at startup, small)
  ├─ MODES registry: id, emoji, icon, home quick links, home blocks to hide,
  │                  module to lazy-load
  ├─ active mode: synced key "mode:active" ({id, at}); Kids Mode is per device
  ├─ #/modes selector, top-bar indicator, Home mode panel, suggestions,
  │  Quiet Mode, kid lock (router guard), lazy loader, shared dua/checklist UI
js/modes/travel.js     #/mode/travel   (+ travel guidance, duas, checklist)
js/modes/hajj.js       #/mode/hajj     (+ Hajj and Umrah guides, duas, checklist)
js/modes/mosque.js     #/mode/mosque   (+ mosque search/selection, Quiet Mode)
js/modes/kids.js       #/family (parent) and #/kids (child) (+ lessons, quizzes)
```

Mode modules are only downloaded when that mode is opened (the service worker
still pre-caches them so they work offline after the first visit).

Each mode module exports `SS.modeModules[id] = { home(el), page(el, params), leave() }`:
`home` draws the compact dashboard at the top of Home while the mode is
active; `page` draws the full mode page. `kids.js` instead exports
`family(el, params)` (#/family) and `kids(params)` (#/kids). Modules are added
to the page with a `<script>` tag the first time they're needed; `sw.js` also
pre-caches them in the background so they work offline after installation.

### Persistence

| Key | Where | Notes |
|---|---|---|
| `mode:active` | synced | `{id, at}`; never `kids` (Kids Mode belongs to one device) |
| `travel:checklist` | synced (per item) | |
| `hajj:state` | synced | `{type: "hajj"\|"umrah", at}` |
| `hajj:progress:hajj`, `hajj:progress:umrah` | synced (per step) | |
| `hajj:checklist` | synced (per item) | |
| `travel:places` | this device | destination and saved places — location stays on the device, as it always has |
| `mosque:selected`, `mosque:saved`, `mosque:notes` | this device | a chosen mosque reveals where you are |
| `modes:quiet`, `mode:dismissed` | this device | |
| `kids:device` | this device | `{active, profiles: {childId: {token, child}}}` — a device token per child using this device (siblings can share one) |
| `kids:lock` | this device | PBKDF2 hash of the grown-up PIN that leaves Kids Mode |

Invalid or unknown values fall back to Normal Mode. Guests keep everything in
localStorage; the existing sync engine uploads it on first sign-in.

## 3. Kids Mode and family security model

Server tables (all RLS-enabled): `family_children`, `child_progress`,
`child_achievements`, `child_devices`, `child_pair_codes`.

* **Parents** use their normal SalaamStreet account. Every family operation is
  a `security definer` RPC that checks `parent_id = auth.uid()`; RLS also only
  lets a parent read their own children. One parent can never see another's.
* **Children never sign in and never receive the parent's credentials.** A
  device gets a random 256-bit **device token** scoped to exactly one child,
  either by the parent tapping "Use on this device" (signed-in parent) or by
  entering a one-time 8-character **pairing code** the parent created (valid
  15 minutes, single use). Only a SHA-256 hash of the token and code is
  stored.
* Child RPCs (`kid_*`) take the token, resolve the one child it belongs to,
  and can only read that child's profile/progress and record that child's
  progress. They cannot read or change restrictions, other children or any
  parent data. Progress for a section the parent switched off is rejected by
  the database, not just hidden.
* Achievements are awarded by the database from saved progress; children can't
  write them.
* Starting Kids Mode on the parent's own device signs the parent out of that
  device first (their data stays in the account), so the child never has the
  parent's session. Leaving Kids Mode asks for a grown-up PIN (stored only as
  a salted PBKDF2 hash on the device). A forgotten PIN can be cleared by
  unpairing the device, which leaves only the guest app (no parent data).
* Parents can revoke any device and delete a child; deletion cascades to all of
  that child's rows immediately.

Data collected for a child: a first name or nickname (≤ 24 characters), an
age range, an avatar choice, and learning progress. Nothing else.

## 4. Content and accuracy

Guides (travel prayer, Hajj, Umrah) and kids lessons cite the Qur'an or a
specific hadith reference for each point. Where the schools differ (distance
and duration for shortening, combining, Muzdalifah, the order of the rites on
the 10th, the type of Hajj) the guide says so and names the main positions
instead of choosing one. Qur'an text in Kids Mode is loaded from the app's
Qur'an source, never typed in. Mosque information comes only from
OpenStreetMap and is labelled as such; prayer times shown for a mosque are
calculated start times, not the mosque's iqamah times.
