# SalaamStreet — Folder Structure

**Version:** 1.0 · **Status:** Awaiting approval

```
salaamstreet/
├── app/
│   ├── [locale]/                     # en | ar (RTL)
│   │   ├── layout.tsx                # html lang/dir, fonts, providers
│   │   ├── page.tsx                  # dashboard (guest + personalized)
│   │   ├── prayer-times/
│   │   │   ├── page.tsx
│   │   │   └── monthly/page.tsx
│   │   ├── qibla/page.tsx
│   │   ├── quran/
│   │   │   ├── page.tsx              # surah index
│   │   │   ├── [surah]/page.tsx      # reader (SSG ×114)
│   │   │   └── juz/[juz]/page.tsx
│   │   ├── duas/
│   │   │   ├── page.tsx              # categories
│   │   │   └── [category]/page.tsx
│   │   ├── dhikr/page.tsx
│   │   ├── settings/page.tsx
│   │   ├── auth/
│   │   │   ├── signin/page.tsx
│   │   │   └── verify/page.tsx
│   │   ├── privacy/page.tsx
│   │   └── not-found.tsx
│   ├── api/
│   │   ├── auth/[...nextauth]/route.ts
│   │   ├── prayer-times/route.ts     # AlAdhan proxy + cache
│   │   ├── bookmarks/route.ts
│   │   ├── dhikr/route.ts            # counter sync + streaks
│   │   ├── favorites/route.ts
│   │   └── user/route.ts             # prefs, export, delete
│   ├── manifest.ts
│   ├── sitemap.ts
│   └── globals.css
├── components/
│   ├── ui/                           # Button, Card, Dialog, Tabs, Toast…
│   ├── layout/                       # Header, SideNav, MobileNav, Footer, LocaleSwitcher, ThemeToggle
│   ├── dashboard/                    # NextPrayerCard, DailyAyah, StreakCard, QuickLinks
│   ├── prayer/                       # TimesTable, MethodSelector, LocationPrompt, MonthlyGrid
│   ├── qibla/                        # Compass, MapBearing, CalibrationHint
│   ├── quran/                        # SurahList, AyahView, AudioPlayer, TranslationToggle, BookmarkButton
│   ├── duas/                         # DuaCard, CategoryGrid, SourceBadge
│   └── dhikr/                        # Counter, PresetPicker, StreakRing
├── hooks/                            # useGeolocation, usePrayerTimes, useQiblaBearing,
│                                     # useAudioPlayer, useDhikrCounter, useLocalStorage
├── lib/
│   ├── prisma.ts                     # singleton client
│   ├── auth.ts                       # NextAuth config
│   ├── prayer/                       # aladhan client, cache, method definitions
│   ├── qibla.ts                      # great-circle bearing
│   ├── quran/                        # surah metadata, audio URL builder
│   ├── i18n/                         # next-intl config + messages/en.json, ar.json
│   ├── validation/                   # zod schemas per API route
│   └── rate-limit.ts
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed/                         # seed.ts + data/ (quran, duas, reciters)
├── public/                           # icons, og images, fonts fallback
├── styles/                           # (tokens live in globals.css @theme)
├── types/                            # shared TS types (PrayerTimes, Ayah, Dua…)
├── utils/                            # formatters (hijri, time), cn(), constants
├── middleware.ts                     # locale routing + security headers
├── .env.example
├── next.config.ts
├── package.json
└── README.md
```

**Conventions:** feature-scoped component folders; no file over ~250 lines; server-only modules marked with `import "server-only"`; every exported function documented with JSDoc where non-obvious.
