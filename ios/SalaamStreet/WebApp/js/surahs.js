/* SalaamStreet — surah metadata (classic script, exposes window.SS). */
(function () {
"use strict";
/**
 * SalaamStreet — Surah metadata (self-hosted).
 * Source: standard Quranic corpus metadata (114 surahs, 6236 ayahs total).
 * Fields: n (number), ar (Arabic name), en (transliterated name),
 * meaning (English meaning), ayahs (verse count), type (meccan|medinan).
 */
const SURAHS = [
  { n: 1, ar: "الفاتحة", en: "Al-Fatihah", meaning: "The Opener", ayahs: 7, type: "meccan" },
  { n: 2, ar: "البقرة", en: "Al-Baqarah", meaning: "The Cow", ayahs: 286, type: "medinan" },
  { n: 3, ar: "آل عمران", en: "Aal Imran", meaning: "Family of Imran", ayahs: 200, type: "medinan" },
  { n: 4, ar: "النساء", en: "An-Nisa", meaning: "The Women", ayahs: 176, type: "medinan" },
  { n: 5, ar: "المائدة", en: "Al-Ma'idah", meaning: "The Table Spread", ayahs: 120, type: "medinan" },
  { n: 6, ar: "الأنعام", en: "Al-An'am", meaning: "The Cattle", ayahs: 165, type: "meccan" },
  { n: 7, ar: "الأعراف", en: "Al-A'raf", meaning: "The Heights", ayahs: 206, type: "meccan" },
  { n: 8, ar: "الأنفال", en: "Al-Anfal", meaning: "The Spoils of War", ayahs: 75, type: "medinan" },
  { n: 9, ar: "التوبة", en: "At-Tawbah", meaning: "The Repentance", ayahs: 129, type: "medinan" },
  { n: 10, ar: "يونس", en: "Yunus", meaning: "Jonah", ayahs: 109, type: "meccan" },
  { n: 11, ar: "هود", en: "Hud", meaning: "Hud", ayahs: 123, type: "meccan" },
  { n: 12, ar: "يوسف", en: "Yusuf", meaning: "Joseph", ayahs: 111, type: "meccan" },
  { n: 13, ar: "الرعد", en: "Ar-Ra'd", meaning: "The Thunder", ayahs: 43, type: "medinan" },
  { n: 14, ar: "إبراهيم", en: "Ibrahim", meaning: "Abraham", ayahs: 52, type: "meccan" },
  { n: 15, ar: "الحجر", en: "Al-Hijr", meaning: "The Rocky Tract", ayahs: 99, type: "meccan" },
  { n: 16, ar: "النحل", en: "An-Nahl", meaning: "The Bee", ayahs: 128, type: "meccan" },
  { n: 17, ar: "الإسراء", en: "Al-Isra", meaning: "The Night Journey", ayahs: 111, type: "meccan" },
  { n: 18, ar: "الكهف", en: "Al-Kahf", meaning: "The Cave", ayahs: 110, type: "meccan" },
  { n: 19, ar: "مريم", en: "Maryam", meaning: "Mary", ayahs: 98, type: "meccan" },
  { n: 20, ar: "طه", en: "Taha", meaning: "Ta-Ha", ayahs: 135, type: "meccan" },
  { n: 21, ar: "الأنبياء", en: "Al-Anbya", meaning: "The Prophets", ayahs: 112, type: "meccan" },
  { n: 22, ar: "الحج", en: "Al-Hajj", meaning: "The Pilgrimage", ayahs: 78, type: "medinan" },
  { n: 23, ar: "المؤمنون", en: "Al-Mu'minun", meaning: "The Believers", ayahs: 118, type: "meccan" },
  { n: 24, ar: "النور", en: "An-Nur", meaning: "The Light", ayahs: 64, type: "medinan" },
  { n: 25, ar: "الفرقان", en: "Al-Furqan", meaning: "The Criterion", ayahs: 77, type: "meccan" },
  { n: 26, ar: "الشعراء", en: "Ash-Shu'ara", meaning: "The Poets", ayahs: 227, type: "meccan" },
  { n: 27, ar: "النمل", en: "An-Naml", meaning: "The Ant", ayahs: 93, type: "meccan" },
  { n: 28, ar: "القصص", en: "Al-Qasas", meaning: "The Stories", ayahs: 88, type: "meccan" },
  { n: 29, ar: "العنكبوت", en: "Al-Ankabut", meaning: "The Spider", ayahs: 69, type: "meccan" },
  { n: 30, ar: "الروم", en: "Ar-Rum", meaning: "The Romans", ayahs: 60, type: "meccan" },
  { n: 31, ar: "لقمان", en: "Luqman", meaning: "Luqman", ayahs: 34, type: "meccan" },
  { n: 32, ar: "السجدة", en: "As-Sajdah", meaning: "The Prostration", ayahs: 30, type: "meccan" },
  { n: 33, ar: "الأحزاب", en: "Al-Ahzab", meaning: "The Combined Forces", ayahs: 73, type: "medinan" },
  { n: 34, ar: "سبأ", en: "Saba", meaning: "Sheba", ayahs: 54, type: "meccan" },
  { n: 35, ar: "فاطر", en: "Fatir", meaning: "Originator", ayahs: 45, type: "meccan" },
  { n: 36, ar: "يس", en: "Ya-Sin", meaning: "Ya Sin", ayahs: 83, type: "meccan" },
  { n: 37, ar: "الصافات", en: "As-Saffat", meaning: "Those Who Set the Ranks", ayahs: 182, type: "meccan" },
  { n: 38, ar: "ص", en: "Sad", meaning: "The Letter Sad", ayahs: 88, type: "meccan" },
  { n: 39, ar: "الزمر", en: "Az-Zumar", meaning: "The Troops", ayahs: 75, type: "meccan" },
  { n: 40, ar: "غافر", en: "Ghafir", meaning: "The Forgiver", ayahs: 85, type: "meccan" },
  { n: 41, ar: "فصلت", en: "Fussilat", meaning: "Explained in Detail", ayahs: 54, type: "meccan" },
  { n: 42, ar: "الشورى", en: "Ash-Shuraa", meaning: "The Consultation", ayahs: 53, type: "meccan" },
  { n: 43, ar: "الزخرف", en: "Az-Zukhruf", meaning: "The Ornaments of Gold", ayahs: 89, type: "meccan" },
  { n: 44, ar: "الدخان", en: "Ad-Dukhan", meaning: "The Smoke", ayahs: 59, type: "meccan" },
  { n: 45, ar: "الجاثية", en: "Al-Jathiyah", meaning: "The Crouching", ayahs: 37, type: "meccan" },
  { n: 46, ar: "الأحقاف", en: "Al-Ahqaf", meaning: "The Wind-Curved Sandhills", ayahs: 35, type: "meccan" },
  { n: 47, ar: "محمد", en: "Muhammad", meaning: "Muhammad", ayahs: 38, type: "medinan" },
  { n: 48, ar: "الفتح", en: "Al-Fath", meaning: "The Victory", ayahs: 29, type: "medinan" },
  { n: 49, ar: "الحجرات", en: "Al-Hujurat", meaning: "The Rooms", ayahs: 18, type: "medinan" },
  { n: 50, ar: "ق", en: "Qaf", meaning: "The Letter Qaf", ayahs: 45, type: "meccan" },
  { n: 51, ar: "الذاريات", en: "Adh-Dhariyat", meaning: "The Winnowing Winds", ayahs: 60, type: "meccan" },
  { n: 52, ar: "الطور", en: "At-Tur", meaning: "The Mount", ayahs: 49, type: "meccan" },
  { n: 53, ar: "النجم", en: "An-Najm", meaning: "The Star", ayahs: 62, type: "meccan" },
  { n: 54, ar: "القمر", en: "Al-Qamar", meaning: "The Moon", ayahs: 55, type: "meccan" },
  { n: 55, ar: "الرحمن", en: "Ar-Rahman", meaning: "The Beneficent", ayahs: 78, type: "medinan" },
  { n: 56, ar: "الواقعة", en: "Al-Waqi'ah", meaning: "The Inevitable", ayahs: 96, type: "meccan" },
  { n: 57, ar: "الحديد", en: "Al-Hadid", meaning: "The Iron", ayahs: 29, type: "medinan" },
  { n: 58, ar: "المجادلة", en: "Al-Mujadila", meaning: "The Pleading Woman", ayahs: 22, type: "medinan" },
  { n: 59, ar: "الحشر", en: "Al-Hashr", meaning: "The Exile", ayahs: 24, type: "medinan" },
  { n: 60, ar: "الممتحنة", en: "Al-Mumtahanah", meaning: "She That Is To Be Examined", ayahs: 13, type: "medinan" },
  { n: 61, ar: "الصف", en: "As-Saf", meaning: "The Ranks", ayahs: 14, type: "medinan" },
  { n: 62, ar: "الجمعة", en: "Al-Jumu'ah", meaning: "The Congregation, Friday", ayahs: 11, type: "medinan" },
  { n: 63, ar: "المنافقون", en: "Al-Munafiqun", meaning: "The Hypocrites", ayahs: 11, type: "medinan" },
  { n: 64, ar: "التغابن", en: "At-Taghabun", meaning: "The Mutual Disillusion", ayahs: 18, type: "medinan" },
  { n: 65, ar: "الطلاق", en: "At-Talaq", meaning: "The Divorce", ayahs: 12, type: "medinan" },
  { n: 66, ar: "التحريم", en: "At-Tahrim", meaning: "The Prohibition", ayahs: 12, type: "medinan" },
  { n: 67, ar: "الملك", en: "Al-Mulk", meaning: "The Sovereignty", ayahs: 30, type: "meccan" },
  { n: 68, ar: "القلم", en: "Al-Qalam", meaning: "The Pen", ayahs: 52, type: "meccan" },
  { n: 69, ar: "الحاقة", en: "Al-Haqqah", meaning: "The Reality", ayahs: 52, type: "meccan" },
  { n: 70, ar: "المعارج", en: "Al-Ma'arij", meaning: "The Ascending Stairways", ayahs: 44, type: "meccan" },
  { n: 71, ar: "نوح", en: "Nuh", meaning: "Noah", ayahs: 28, type: "meccan" },
  { n: 72, ar: "الجن", en: "Al-Jinn", meaning: "The Jinn", ayahs: 28, type: "meccan" },
  { n: 73, ar: "المزمل", en: "Al-Muzzammil", meaning: "The Enshrouded One", ayahs: 20, type: "meccan" },
  { n: 74, ar: "المدثر", en: "Al-Muddaththir", meaning: "The Cloaked One", ayahs: 56, type: "meccan" },
  { n: 75, ar: "القيامة", en: "Al-Qiyamah", meaning: "The Resurrection", ayahs: 40, type: "meccan" },
  { n: 76, ar: "الإنسان", en: "Al-Insan", meaning: "The Man", ayahs: 31, type: "medinan" },
  { n: 77, ar: "المرسلات", en: "Al-Mursalat", meaning: "The Emissaries", ayahs: 50, type: "meccan" },
  { n: 78, ar: "النبأ", en: "An-Naba", meaning: "The Tidings", ayahs: 40, type: "meccan" },
  { n: 79, ar: "النازعات", en: "An-Nazi'at", meaning: "Those Who Drag Forth", ayahs: 46, type: "meccan" },
  { n: 80, ar: "عبس", en: "Abasa", meaning: "He Frowned", ayahs: 42, type: "meccan" },
  { n: 81, ar: "التكوير", en: "At-Takwir", meaning: "The Overthrowing", ayahs: 29, type: "meccan" },
  { n: 82, ar: "الإنفطار", en: "Al-Infitar", meaning: "The Cleaving", ayahs: 19, type: "meccan" },
  { n: 83, ar: "المطففين", en: "Al-Mutaffifin", meaning: "The Defrauding", ayahs: 36, type: "meccan" },
  { n: 84, ar: "الإنشقاق", en: "Al-Inshiqaq", meaning: "The Sundering", ayahs: 25, type: "meccan" },
  { n: 85, ar: "البروج", en: "Al-Buruj", meaning: "The Mansions of the Stars", ayahs: 22, type: "meccan" },
  { n: 86, ar: "الطارق", en: "At-Tariq", meaning: "The Nightcomer", ayahs: 17, type: "meccan" },
  { n: 87, ar: "الأعلى", en: "Al-A'la", meaning: "The Most High", ayahs: 19, type: "meccan" },
  { n: 88, ar: "الغاشية", en: "Al-Ghashiyah", meaning: "The Overwhelming", ayahs: 26, type: "meccan" },
  { n: 89, ar: "الفجر", en: "Al-Fajr", meaning: "The Dawn", ayahs: 30, type: "meccan" },
  { n: 90, ar: "البلد", en: "Al-Balad", meaning: "The City", ayahs: 20, type: "meccan" },
  { n: 91, ar: "الشمس", en: "Ash-Shams", meaning: "The Sun", ayahs: 15, type: "meccan" },
  { n: 92, ar: "الليل", en: "Al-Layl", meaning: "The Night", ayahs: 21, type: "meccan" },
  { n: 93, ar: "الضحى", en: "Ad-Duhaa", meaning: "The Morning Hours", ayahs: 11, type: "meccan" },
  { n: 94, ar: "الشرح", en: "Ash-Sharh", meaning: "The Relief", ayahs: 8, type: "meccan" },
  { n: 95, ar: "التين", en: "At-Tin", meaning: "The Fig", ayahs: 8, type: "meccan" },
  { n: 96, ar: "العلق", en: "Al-Alaq", meaning: "The Clot", ayahs: 19, type: "meccan" },
  { n: 97, ar: "القدر", en: "Al-Qadr", meaning: "The Power", ayahs: 5, type: "meccan" },
  { n: 98, ar: "البينة", en: "Al-Bayyinah", meaning: "The Clear Proof", ayahs: 8, type: "medinan" },
  { n: 99, ar: "الزلزلة", en: "Az-Zalzalah", meaning: "The Earthquake", ayahs: 8, type: "medinan" },
  { n: 100, ar: "العاديات", en: "Al-Adiyat", meaning: "The Courser", ayahs: 11, type: "meccan" },
  { n: 101, ar: "القارعة", en: "Al-Qari'ah", meaning: "The Calamity", ayahs: 11, type: "meccan" },
  { n: 102, ar: "التكاثر", en: "At-Takathur", meaning: "The Rivalry in World Increase", ayahs: 8, type: "meccan" },
  { n: 103, ar: "العصر", en: "Al-Asr", meaning: "The Declining Day", ayahs: 3, type: "meccan" },
  { n: 104, ar: "الهمزة", en: "Al-Humazah", meaning: "The Traducer", ayahs: 9, type: "meccan" },
  { n: 105, ar: "الفيل", en: "Al-Fil", meaning: "The Elephant", ayahs: 5, type: "meccan" },
  { n: 106, ar: "قريش", en: "Quraysh", meaning: "Quraysh", ayahs: 4, type: "meccan" },
  { n: 107, ar: "الماعون", en: "Al-Ma'un", meaning: "The Small Kindnesses", ayahs: 7, type: "meccan" },
  { n: 108, ar: "الكوثر", en: "Al-Kawthar", meaning: "The Abundance", ayahs: 3, type: "meccan" },
  { n: 109, ar: "الكافرون", en: "Al-Kafirun", meaning: "The Disbelievers", ayahs: 6, type: "meccan" },
  { n: 110, ar: "النصر", en: "An-Nasr", meaning: "The Divine Support", ayahs: 3, type: "medinan" },
  { n: 111, ar: "المسد", en: "Al-Masad", meaning: "The Palm Fiber", ayahs: 5, type: "meccan" },
  { n: 112, ar: "الإخلاص", en: "Al-Ikhlas", meaning: "The Sincerity", ayahs: 4, type: "meccan" },
  { n: 113, ar: "الفلق", en: "Al-Falaq", meaning: "The Daybreak", ayahs: 5, type: "meccan" },
  { n: 114, ar: "الناس", en: "An-Nas", meaning: "Mankind", ayahs: 6, type: "meccan" },
];

/** Cumulative ayah offsets: globalAyahNumber = OFFSETS[surah-1] + numberInSurah */
const OFFSETS = (() => {
  const out = [0];
  for (let i = 0; i < SURAHS.length - 1; i++) out.push(out[i] + SURAHS[i].ayahs);
  return out;
})();

const TOTAL_AYAHS = OFFSETS[113] + SURAHS[113].ayahs; // 6236

/** @param {number} surah 1–114  @param {number} ayah 1-based within surah */
function globalAyahNumber(surah, ayah) {
  return OFFSETS[surah - 1] + ayah;
}

function getSurah(n) {
  return SURAHS[n - 1] || null;
}
window.SS = window.SS || {};
Object.assign(window.SS, { SURAHS: SURAHS, OFFSETS: OFFSETS, TOTAL_AYAHS: TOTAL_AYAHS, globalAyahNumber: globalAyahNumber, getSurah: getSurah });
})();
