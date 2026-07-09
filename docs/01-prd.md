# SalaamStreet — Product Requirements Document (PRD)

**Version:** 1.0 · **Date:** 2026-07-08 · **Status:** Awaiting approval

## 1. Vision

An all-in-one modern Islamic platform helping Muslims strengthen their relationship with Allah through authentic knowledge, worship tools, learning, organization, and community — delivered with a peaceful, premium, modern experience.

## 2. Guiding Principles

1. **Authenticity** — Qur'an, hadith, and rulings come only from verified sources; nothing is ever generated or invented. Content is always labeled by type: Qur'an, Hadith (with grading where available), scholarly opinion, or general advice.
2. **Respect for scholarly difference** — where valid differences exist (e.g., prayer calculation methods, madhhab-specific Asr timing), the user chooses; we never present one opinion as the only truth.
3. **Privacy-first** — location is opt-in with clear explanation, never stored server-side without consent, never shared. Minimal data collection.
4. **Secure by default** — OWASP practices, no secrets in code, encrypted transit and storage.
5. **Accessible & fast** — WCAG 2.1 AA, Core Web Vitals green, works on low-end devices.

## 3. Target Users

| Persona | Needs |
|---|---|
| Practicing professional | Accurate prayer times, quick Qibla, dhikr on the go, dark mode |
| Quran student | Reader with translation/transliteration, audio by qari, bookmarks, progress |
| New Muslim / learner | Duas with context, clear labeling of sources, gentle guidance |
| Arabic speaker | Full RTL Arabic UI, Uthmani script |

## 4. Release Phases

### v1 — Worship Core (this build)

| # | Feature | Summary |
|---|---|---|
| 1 | Auth & profiles | Email + OAuth (Google) via NextAuth. Profile: name, locale, calculation method, madhhab (Asr), theme. |
| 2 | Personalized dashboard | Next prayer countdown, daily ayah, dhikr streak, quick links. Works logged-out with degraded personalization. |
| 3 | Prayer times | By location (permission flow below) or manual city. Methods: MWL, ISNA, Egypt, Umm al-Qura, Karachi, etc. Hanafi/Standard Asr toggle. Monthly view. Optional notifications (browser push, opt-in). |
| 4 | Qibla finder | Compass (device orientation) + map bearing fallback, great-circle calculation to the Kaaba (21.4225°N, 39.8262°E). |
| 5 | Quran reader | 114 surahs, Uthmani script, translation (Saheeh International en; Arabic-only mode), transliteration toggle, juz/page navigation, bookmarks, last-read position, per-ayah audio. |
| 6 | Audio recitations | Multiple qaris, per-ayah and continuous playback, playback speed, repeat for memorization. |
| 7 | Dua library | Hisnul Muslim–based collection, categorized (morning/evening, travel, distress…), Arabic + transliteration + translation + source citation. Favorites. |
| 8 | Dhikr counter | Tap counter with presets (SubhanAllah 33× etc.), custom dhikr, haptic/visual feedback, daily streaks, sync when logged in. |
| 9 | Settings | Language (en/ar + RTL), theme (light/dark/system), location controls, notification controls, data export/delete (GDPR). |

### v2 — Knowledge

Hadith library (Sunnah.com sourced, graded), Tafsir (Ibn Kathir first), Islamic/Hijri calendar with events, learning academy (structured courses), goals & achievements.

### v3 — Community & AI

AI assistant (retrieval-grounded, cites sources, never issues fatwas — refers rulings to scholars), mosque finder, halal business finder, community spaces, additional languages (ur, fr, tr, id).

## 5. Non-Functional Requirements

- **Performance:** LCP < 2.5s, TTI < 3.5s on mid-range mobile; Quran text statically generated.
- **Accessibility:** WCAG 2.1 AA; full keyboard nav; screen-reader labels incl. Arabic `lang`/`dir` attributes; reduced-motion support.
- **i18n:** en + ar at launch; all strings externalized; RTL-safe layout (Tailwind logical properties).
- **Offline resilience:** last-loaded prayer times and Quran positions cached client-side.
- **Security:** OWASP ASVS-aligned; rate limiting; CSRF/XSS protection; secrets via env vars only.
- **Privacy:** no third-party analytics with PII; location processed client-side where possible; clear privacy policy.

## 6. Location Permission Flow (required UX)

Before any location use, show:

> "We use your location only to provide accurate prayer times, Qibla direction, nearby mosques, and halal businesses."

Options: **Allow while using app** · **Allow once** · **Manual location** · **Don't allow**. Location can be disabled anytime in Settings; manual city entry is always available and fully functional.

## 7. Success Metrics (v1)

- D7 retention ≥ 25%; median prayer-time page load < 1.5s; ≥ 30% of signed-in users set a dhikr streak; zero authenticity incidents (mis-cited or invented content).

## 8. Out of Scope for v1

Payments/donations, mobile native apps (responsive web only), user-generated content, live streams, matrimonial features.

## 9. Risks

| Risk | Mitigation |
|---|---|
| External API downtime | Self-host Quran text; cache prayer times server-side; graceful fallbacks |
| Content authenticity errors | Only verified datasets; source citation stored with every content row; review checklist |
| Scholarly-difference complaints | User-selectable methods; neutral framing; "differences of opinion" notes |
| iOS compass permission quirks | Map-bearing fallback for Qibla |
