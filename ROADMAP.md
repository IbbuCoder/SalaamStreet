# SalaamStreet Roadmap

What we plan to build after **3.1.7 — NVHS MSA: join with your school email**, in order. This is a plan, not a
promise: nothing planned below exists in the app yet, and there are no dates —
releases ship when they're ready and tested. The same list appears in the app
under About → Updates (`SS.ROADMAP` in `js/content.js`); keep the two in step.

**Status key:** ✅ Completed · 🚧 In progress · 📋 Planned · ⏸ Deferred · ✖ Cancelled

**How to maintain this file**

- Change a status only when it's true in `main`. A release is ✅ only when its
  completion criteria are met and its notes are in `SS.CHANGELOG`.
- When building something reveals a new dependency, or shows that something
  already exists, edit the release here in the same pull request.
- Move work between releases freely; record why in "Changes to the plan".
- Principles that apply to every release: Qur'an, hadith and rulings come from
  cited, trustworthy sources and are never generated; differences of scholarly
  opinion are presented as such; personal data stays on the device unless the
  person signs in; the essentials stay free; no ads.

| Release | Theme | Status |
|---|---|---|
| 3.0 | Modes | ✅ Completed |
| 3.1.0 | NVHS MSA | ✅ Completed |
| 3.1.5 | Modes, made useful | ✅ Completed |
| 3.1.6 | NVHS MSA members | ✅ Completed |
| 3.1.7 | NVHS MSA: join with your school email | ✅ Completed |
| 3.2 | Personalization | 📋 Planned |
| 3.3 | Qur'an Experience | 📋 Planned |
| 3.4 | Community: mosque pages | 📋 Planned |
| 3.5 | Islamic Learning | 📋 Planned |
| 3.6 | Ramadan Experience | 📋 Planned |
| 3.7 | Advanced Islamic Tools | 📋 Planned |
| 3.8 | Family Ecosystem | 📋 Planned |
| 3.9 | Notifications | 📋 Planned |
| 3.10 | Performance, Security & Polish | 📋 Planned |
| 4.0 | Next-generation SalaamStreet | 📋 Proposal (not scheduled) |

---

## 3.0 — Modes · ✅ Completed

**Goal:** context-specific experiences across SalaamStreet.

Shipped: the Modes architecture (`js/modes.js`, lazy `js/modes/*.js`), Normal,
Travel, Kids, Hajj & Umrah and Mosque modes, mode switching and persistence
(synced when signed in), parent/child profiles with server-enforced
restrictions (`backend/supabase-schema.sql`), and tests for the database rules
(`tests/family.test.js`) and every mode in the browser (`tests/e2e.test.js`).
Release notes: [`docs/release-notes/3.0.0.md`](docs/release-notes/3.0.0.md).
Design notes: [`docs/06-modes.md`](docs/06-modes.md).

Known limits carried forward (each is planned below):

- Mosque information is OpenStreetMap only: no iqamah/Jumu'ah times,
  announcements or events from mosques yet → **3.4**.
- Kids Mode sends no notifications, and parents get no learning reminders → **3.9**.
- A child's device notices that a parent removed it the next time it talks to
  the server (opening the app, saving progress, or after a minute) → **3.10**.
- Travel destinations and saved mosques stay on each device on purpose
  (location privacy); syncing them would need an explicit opt-in → **3.2**.

## 3.1.0 — NVHS MSA · ✅ Completed

**Goal:** a home for the Neuqua Valley High School MSA inside SalaamStreet.

Shipped: the MSA page (`#/msa`, `js/msa.js`) with the club's announcements —
title, text, an optional picture, pinning and an end date — readable without an
account and offline once loaded; the newest "show on Home" announcement as one
slim, hideable card on Home; posting, editing and deleting for the MSA's own
accounts only, checked by the database on every write (`msa_*` in
`backend/supabase-schema.sql`, tested in `tests/msa.test.js`); pictures shrunk
and stripped of location data on the poster's device; nothing in Kids Mode.
Release notes: [`docs/release-notes/3.1.0.md`](docs/release-notes/3.1.0.md).

Not in this release (later, with mosque pages in 3.4): events with "add to
calendar", members-only details, reporting.

## 3.1.5 — Modes, made useful · ✅ Completed

**Goal:** give every mode a point, and make modes easier to use.

Shipped: each mode answers one question inside Home's prayer card (Travel:
how many rak'ahs and when to combine, and a trip end date that brings you home
in one tap; Mosque: one-tap "I'm at the mosque" quiet hour; Hajj & Umrah: the
next step and a tawaf/sa'i round counter); the top-bar badge opens a quick
switcher; a one-row-per-mode picker with Kids Mode moved to the Family page;
the app's own icons with a colour per mode instead of emoji; location errors in
Travel and Mosque Mode shown instead of loading forever. Release notes:
[`docs/release-notes/3.1.5.md`](docs/release-notes/3.1.5.md). Design notes:
[`docs/06-modes.md`](docs/06-modes.md) §5.

## 3.1.6 — NVHS MSA members · ✅ Completed

**Goal:** only real NVHS MSA members see members-only announcements.

Shipped: joining from the MSA page with a full name and either the live
meeting code (6 digits, changes every 10 minutes, shown only to the approver)
or a request the approver decides against a roster kept only in the database;
one approved account per name, with a second claim flagged for an in-person
check; members-only announcements left out by the database for everyone else;
membership until 1 July. Release notes:
[`docs/release-notes/3.1.6.md`](docs/release-notes/3.1.6.md).

Limit: SalaamStreet can't check school accounts (students sign in with
personal ones), so the meeting code and the approver are the proof.

## 3.1.7 — NVHS MSA: join with your school email · ✅ Completed

**Goal:** let real NVHS students on the MSA's list in without any work.

Shipped: a confirmed school email that fits a roster name is a member at
once; the MSA page tells students to sign in with their school email using
the emailed code, not Google; a simpler Manage page (at-a-glance numbers, only
what needs you on top, the list with joined / not joined yet and search);
Google sign-in always asks which account to use. Release notes:
[`docs/release-notes/3.1.7.md`](docs/release-notes/3.1.7.md).

Next (when they want it): teachers and MSA exec helping to manage members
and posts — planned with **3.4**.

## 3.2 — Personalization · 📋 Planned

**Goal:** SalaamStreet adapts to each person's preferences.

**Proposed features:** a personalized Home with cards you can show, hide and
reorder; favourite tools and custom shortcuts (building on each mode's quick
links); clearer account preferences; an opt-in to sync travel places and saved
mosques; more notification choices; better mode suggestions (still dismissible,
still never inferred from sensitive signals).

**Dependencies:** the mode registry in `js/modes.js` (quick links and Home
blocks are already data); new synced keys in `js/sync.js`.
**Risks:** a cluttered Home; settings sprawl; sync conflicts on card order.
**Completion criteria:** Home layout is customizable per mode, persists and
syncs; defaults unchanged for people who never customize; tests cover
ordering conflicts across devices.

## 3.3 — Qur'an Experience · 📋 Planned

**Goal:** make reading, listening and learning the Qur'an more cohesive.

Much already exists (114 surahs, juz navigation, bookmarks with folders and
notes, resume, 4 reciters, speed/repeat, translation search, 9 translation
languages, reading plans, memorize mode, Offline Qur'an). This release joins
it up rather than rebuilding it.

**Proposed features:** reading history; more than one translation side by
side; a broader reciter list; improved audio controls with range repeat
(ayah A to B); memorization progress per surah; better search (Arabic and
transliteration).

**Dependencies:** AlQuran Cloud editions; Islamic Network audio CDN coverage
per reciter; Offline Qur'an storage limits.
**Risks:** licensing of additional translations and recitations; storage on
small phones.
**Completion criteria:** every new text or audio source is verified and
attributed; offline behaviour unchanged or better; no regressions in the
existing reader tests.

## 3.4 — Community: mosque pages · 📋 Planned

**Goal:** better access to mosques and their events.

Already in the app (3.1.0): the NVHS MSA page with announcements, posting
limited to the MSA's own accounts by the database.

**Proposed features:** mosque pages built the same way, with verified Jumu'ah
and iqamah times, event calendars ("add to calendar") and announcements;
reporting; event discovery. Mosque Mode reads these when a mosque has a page —
today it shows an honest empty state.

**Dependencies:** a verification process for who may publish for an
organization; moderation; new tables with RLS; Mosque Mode (`js/modes/mosque.js`).
**Risks:** impersonation and inaccurate times; moderation workload; Kids Mode
must never show community content unless a parent allows it.
**Completion criteria:** only verified organization admins can publish;
published data shows its source and last update; reporting and takedown
work; Kids Mode stays free of community content by default.

## 3.5 — Islamic Learning · 📋 Planned

**Goal:** a structured learning experience for all ages.

**Proposed features:** organized learning paths (beginner foundations,
prayer, Seerah, Prophets, Islamic history, hadith); lessons, quizzes and
flashcards built on the components Kids Mode introduced; progress for
signed-in adults; Kids Mode reuses the same lessons at age-appropriate levels.

**Dependencies:** Kids Mode content model (`js/modes/kids.js`); Stories;
Hadith library; Knowledge tab.
**Risks:** religious accuracy at scale — every lesson needs a source and
review; age-appropriateness.
**Completion criteria:** each lesson cites its sources; content reviewed by
someone qualified before release; progress stored per person (and per child).

## 3.6 — Ramadan Experience · 📋 Planned

**Goal:** a polished seasonal Ramadan experience — a seasonal feature, not a
sixth mode.

Already in the app: a Ramadan card with suhoor/iftar times and a countdown,
and a fasting log.

**Proposed features:** a Ramadan dashboard; Qur'an goals for the month;
Ramadan calendar; daily duas and dhikr; Laylat al-Qadr information (with
scholarly views on the date); an Eid countdown; optional Ramadan reminders.

**Dependencies:** prayer times using the person's location and calculation
method (including Imsak); 3.9 for reminders.
**Risks:** moon-sighting differences — dates must be presented as approximate
and adjustable.
**Completion criteria:** suhoor/iftar always follow the chosen location and
method; date differences explained; works offline once opened.

## 3.7 — Advanced Islamic Tools · 📋 Planned

**Goal:** expand and improve the tool collection.

Already in the app: Qibla compass and camera mode, Islamic calendar, prayer
times and tracker, dhikr counter, mosque finder.

**Proposed features:** a Hijri ↔ Gregorian date converter; a zakat calculator
(with the nisab basis and madhhab differences explained); fasting tools;
better tool search; more tools working offline.

**Dependencies:** a reliable source for gold/silver prices (or manual entry).
**Risks:** zakat and nisab differ between scholars; prices go stale.
**Completion criteria:** every calculation states its assumptions and
sources; results reproducible in tests.

## 3.8 — Family Ecosystem · 📋 Planned

**Goal:** grow the parent-managed Kids experience into a family platform.

**Proposed features:** a richer family dashboard and progress summaries;
shared family learning activities and goals; finer parental controls (per
lesson, time limits); family-friendly Ramadan tools; optional family event
planning.

**Dependencies:** 3.5 learning paths; 3.6 Ramadan; the family tables and
`family_*`/`kid_*` functions from 3.0.
**Risks:** children's privacy — keep data minimal; never add social features
between families.
**Completion criteria:** every new piece of child data is justified and
deletable; authorization tests extended for each new function.

## 3.9 — Notifications · 📋 Planned

**Goal:** notifications that are useful, configurable and never spam.

Already in the app: prayer reminders (in-app and, when set up, Web Push when
the app is closed), Friday Al-Kahf, morning/evening adhkar and Qur'an-goal
reminders; Quiet Mode holds back non-prayer reminders.

**Proposed features:** Jumu'ah reminders for your mosque; Qur'an and learning
reminders (including parent-set reminders for a child); event and MSA
announcements (after 3.4); custom schedules; one place for all notification
preferences; better delivery reliability.

**Dependencies:** the push server (`backend/functions/send-reminders`);
3.4 for events.
**Risks:** notification fatigue; platform limits (iOS web push requires an
installed app).
**Completion criteria:** every notification type is opt-in and individually
switchable; rate limits prevent bursts; Quiet Mode respected.

## 3.10 — Performance, Security & Polish · 📋 Planned

**Goal:** prepare SalaamStreet for its next major stage.

**Planned work:** faster loading and smaller scripts; caching and offline
improvements; PWA polish; an accessibility review with assistive-technology
users; navigation and search polish; a security review (including the family
functions and device tokens — e.g. revoking a child's device instantly via
realtime, and token rotation); API and database performance; error handling;
cross-device testing; bug fixes.

**Dependencies:** none beyond the releases before it.
**Risks:** polishing without measuring.
**Completion criteria:** measured improvements (load time, bundle size,
Lighthouse/axe scores) recorded before and after; no open high-severity
security findings.

## 4.0 — Next-generation SalaamStreet · 📋 Proposal (not scheduled)

**Goal:** evaluate a larger evolution after the 3.x series.

**Possible directions:** more intelligent personalization; advanced Islamic
search; a carefully sourced Islamic assistant; deeper Qur'an and learning
experiences; more capable community tools; smarter Modes; wider offline
support; a better mobile experience; possibly native mobile apps.

These are proposals, not commitments. Each must be weighed against
feasibility, safety (especially anything that could produce religious content
— it must only quote and cite verified sources, never generate rulings),
cost, privacy, user feedback and the existing architecture before it is
scheduled.

---

## Changes to the plan

- **3.0:** the earlier plan called this release "SalaamStreet Kids". It became
  "Modes", with Kids Mode as one of five modes.
- **MSA + Community** was planned as 3.1.0; it is now **3.4 Community**,
  together with mosque pages, because Mosque Mode (3.0) needs the same
  verified-organization foundation.
- **Ramadan** stays a seasonal experience (3.6), not another mode.
- **3.1.0 became NVHS MSA** (October 2026): the MSA's announcements were
  wanted sooner, so they shipped on their own; mosque pages stay in **3.4**,
  built on the same tables. Personalization moved to **3.2** and everything
  after it moved down one; Islamic Learning now follows mosque pages.
- **3.1.6 NVHS MSA members** was added so members-only details (rooms, times,
  photos) reach only real members.
- **3.1.5 Modes, made useful** was added after feedback that the 3.0 modes
  looked busy and didn't change much (see `docs/06-modes.md` §5).
