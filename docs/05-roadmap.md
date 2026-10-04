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

## Next

- Optional account sync (Supabase schema in `backend/`) for bookmarks, streaks and settings
- Push reminders that arrive even when the site is closed (needs a small push server)
- Native-speaker review of the draft Urdu, Bengali, Indonesian, Turkish and French translations

## Principles

Qur'an, hadith and tafsir always come from established sources with citations
shown; nothing is generated. Scholarly differences (calculation method, Asr)
are user choices. Personal data stays on the device unless the user opts in.
