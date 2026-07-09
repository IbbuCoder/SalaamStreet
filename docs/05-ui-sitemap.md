# SalaamStreet — UI Sitemap & Design System

**Version:** 1.0 · **Status:** Awaiting approval

## 1. Design Language

- **Palette:** Emerald `#059669` (primary, scale 50–950) · White/near-white surfaces · Rich black `#0A0F0D` (dark mode base) · Gold `#C9A227` accents (used sparingly: streaks, achievements, active states).
- **Typography:** Latin — a clean geometric sans (e.g., Figtree/Inter). Arabic UI — IBM Plex Sans Arabic. Quran text — KFGQPC Uthmanic Hafs. Duas — Amiri.
- **Feel:** generous whitespace, soft large-radius cards, subtle geometric-pattern textures (very low contrast), gentle motion (respects reduced-motion). Peaceful > flashy.
- **Dark mode:** true dark green-black, not gray; gold gains slight luminance.

## 2. Navigation

- **Desktop:** slim left sidebar — Dashboard, Prayer Times, Qibla, Quran, Duas, Dhikr, Settings. Top bar: location chip, locale switcher (EN/عربي), theme toggle, avatar/sign-in.
- **Mobile:** bottom tab bar — Dashboard · Prayer · Quran · Dhikr · More (sheet with Qibla, Duas, Settings).
- **RTL:** entire layout mirrors for Arabic.

## 3. Page Map (v1)

```
/{locale}
├── /                     Dashboard
│     • Next-prayer hero card (name, countdown, location chip)
│     • Today's remaining prayers strip
│     • Daily ayah card (Arabic + translation + surah:ayah ref)
│     • Dhikr streak ring (gold) + continue button
│     • Continue reading (last-read surah:ayah)
│     • Hijri date
├── /prayer-times         Today's 5 + sunrise; method & Asr selectors;
│     │                   notification toggles per prayer; location controls
│     └── /monthly        Month grid, exportable
├── /qibla                Compass view (device orientation) with calibration hint;
│                         fallback: map with bearing line + degrees from North
├── /quran                Surah index (search, juz tabs, resume banner)
│     ├── /[surah]        Reader: ayah-by-ayah cards or continuous mushaf-style;
│     │                   translation/transliteration toggles; per-ayah play,
│     │                   bookmark, share; sticky audio player (qari, speed, repeat)
│     └── /juz/[juz]      Same reader scoped to juz
├── /duas                 Category grid (icons)
│     └── /[category]     Dua cards: Arabic, transliteration, translation,
│                         source badge (e.g., "Hisnul Muslim #27"), favorite
├── /dhikr                Large tap counter, preset chips (33/34/100),
│                         custom dhikr, streak stats, gentle haptic/pulse
├── /settings             Language · Theme · Calculation method · Asr madhhab ·
│                         Reciter · Location (view/clear/manual) · Notifications ·
│                         Account (export data, delete account)
├── /auth/signin          Email magic link + Google; guest-mode explainer
└── /privacy              Privacy policy incl. location policy
```

## 4. Key Flows

1. **First visit:** dashboard loads with Mecca defaults + banner → "Set your location for accurate times" → permission dialog (the four options from the PRD) → times refresh. No account required.
2. **Guest → account:** bookmarks/streaks kept in localStorage; on sign-up, one-time merge into DB.
3. **Quran session:** index → surah → tap ayah play → sticky player continues across ayahs → position auto-saved on scroll.
4. **Dhikr:** open → yesterday's streak visible → tap through 33/33/34 preset → completion pulse + gold ring update.

## 5. States & Accessibility

- Every data view has loading (skeleton), empty, error (with retry), and offline (cached data + notice) states.
- Focus-visible rings (emerald), ARIA labels on counters/players, `lang="ar"` on all Arabic text, minimum touch target 44px, contrast AA in both themes.
