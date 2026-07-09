# SalaamStreet — Database Schema (Prisma / PostgreSQL)

**Version:** 1.0 · **Status:** Awaiting approval

Design notes: NextAuth tables per the Prisma adapter; all Islamic content carries `source`/`sourceRef` for authenticity auditing; user coordinates stored **only** when the user explicitly saves a location.

```prisma
// ───────── Auth (NextAuth Prisma adapter) ─────────
model User {
  id            String    @id @default(cuid())
  name          String?
  email         String    @unique
  emailVerified DateTime?
  image         String?
  createdAt     DateTime  @default(now())

  preferences   UserPreferences?
  savedLocation SavedLocation?
  bookmarks     QuranBookmark[]
  lastRead      QuranLastRead?
  duaFavorites  DuaFavorite[]
  dhikrSessions DhikrSession[]
  dhikrStreak   DhikrStreak?
  accounts      Account[]
  sessions      Session[]
}

model Account {                       // standard NextAuth fields
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  user              User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime
  @@unique([identifier, token])
}

// ───────── User settings ─────────
model UserPreferences {
  userId            String  @id
  locale            String  @default("en")        // en | ar
  theme             String  @default("system")    // light | dark | system
  calculationMethod String  @default("MWL")       // MWL | ISNA | EGYPT | MAKKAH | KARACHI | …
  asrMethod         String  @default("STANDARD")  // STANDARD | HANAFI
  preferredReciter  String?                       // Reciter.id
  showTransliteration Boolean @default(false)
  notificationsEnabled Boolean @default(false)
  user              User    @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model SavedLocation {                 // explicit opt-in only
  userId    String  @id
  label     String                    // "Home", city name
  latitude  Float                     // rounded to 2dp before save
  longitude Float
  timezone  String
  user      User    @relation(fields: [userId], references: [id], onDelete: Cascade)
}

// ───────── Quran content (self-hosted, seeded) ─────────
model Surah {
  id              Int     @id                    // 1–114
  nameArabic      String
  nameEnglish     String                          // "Al-Fatihah"
  nameTranslation String                          // "The Opener"
  revelationPlace String                          // MECCAN | MEDINAN
  ayahCount       Int
  ayahs           Ayah[]
}

model Ayah {
  id            Int    @id                        // global ayah number 1–6236
  surahId       Int
  numberInSurah Int
  textUthmani   String @db.Text
  translationEn String @db.Text                   // Saheeh International
  transliteration String @db.Text
  juz           Int
  page          Int                               // Madani mushaf page
  source        String                            // "Tanzil Uthmani v1.1"
  surah         Surah  @relation(fields: [surahId], references: [id])
  @@unique([surahId, numberInSurah])
  @@index([juz])
  @@index([page])
}

model Reciter {
  id         String @id                           // "mishary_alafasy"
  nameEn     String
  nameAr     String
  audioUrlTemplate String                         // per-ayah CDN pattern
  style      String?                              // murattal | mujawwad
}

// ───────── User ↔ Quran ─────────
model QuranBookmark {
  id        String   @id @default(cuid())
  userId    String
  ayahId    Int
  note      String?
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([userId, ayahId])
}

model QuranLastRead {
  userId    String   @id
  ayahId    Int
  updatedAt DateTime @updatedAt
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

// ───────── Duas (self-hosted, seeded) ─────────
model DuaCategory {
  id     String @id                               // "morning-evening"
  nameEn String
  nameAr String
  icon   String?
  order  Int
  duas   Dua[]
}

model Dua {
  id              String @id @default(cuid())
  categoryId      String
  titleEn         String
  textArabic      String @db.Text
  transliteration String @db.Text
  translationEn   String @db.Text
  source          String                          // "Hisnul Muslim"
  sourceRef       String                          // "#27 · Abu Dawud 5088 (sahih)"
  order           Int
  category        DuaCategory @relation(fields: [categoryId], references: [id])
  favorites       DuaFavorite[]
  @@index([categoryId])
}

model DuaFavorite {
  userId    String
  duaId     String
  createdAt DateTime @default(now())
  user      User @relation(fields: [userId], references: [id], onDelete: Cascade)
  dua       Dua  @relation(fields: [duaId], references: [id], onDelete: Cascade)
  @@id([userId, duaId])
}

// ───────── Dhikr ─────────
model DhikrSession {
  id        String   @id @default(cuid())
  userId    String
  dhikrName String                                // "SubhanAllah" or custom
  count     Int
  target    Int?
  date      DateTime @db.Date
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId, date])
}

model DhikrStreak {
  userId        String   @id
  currentStreak Int      @default(0)
  longestStreak Int      @default(0)
  lastActiveDate DateTime? @db.Date
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

// ───────── Server cache ─────────
model PrayerTimesCache {
  id        String   @id @default(cuid())
  latKey    Float                                 // 2dp
  lngKey    Float
  date      DateTime @db.Date
  method    String
  asrMethod String
  payload   Json                                  // AlAdhan timings + hijri
  expiresAt DateTime
  @@unique([latKey, lngKey, date, method, asrMethod])
  @@index([expiresAt])
}
```

**v2 extension points (planned, not created yet):** `HadithCollection/Hadith` (grading + Sunnah.com ref), `TafsirEntry` (per-ayah, per-work), `HijriEvent`, `Course/Lesson/Enrollment`, `Goal/Achievement`. All follow the same `source`/`sourceRef` pattern.
