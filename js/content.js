/* SalaamStreet — content.js (classic script)
   Reference content: the 99 Names of Allah, juz boundaries, the morning and
   evening adhkar sequence, the Arabic alphabet, and the Qur'an translations
   offered in the reader. Exposed on window.SS. */
(function () {
  "use strict";
  window.SS = window.SS || {};

  /* ── The Most Beautiful Names (al-Asma' al-Husna) ─────────────────
     The commonly circulated list of 99, following the narration in
     at-Tirmidhi 3507. Scholars differ on exactly which names that list
     contains; the Names themselves are affirmed in the Qur'an and Sunnah. */
  var N = [
    ["الرحمن", "Ar-Rahman", "The Most Compassionate"],
    ["الرحيم", "Ar-Rahim", "The Most Merciful"],
    ["الملك", "Al-Malik", "The King"],
    ["القدوس", "Al-Quddus", "The Most Holy"],
    ["السلام", "As-Salam", "The Source of Peace"],
    ["المؤمن", "Al-Mu'min", "The Granter of Security"],
    ["المهيمن", "Al-Muhaymin", "The Guardian"],
    ["العزيز", "Al-'Aziz", "The Almighty"],
    ["الجبار", "Al-Jabbar", "The Compeller"],
    ["المتكبر", "Al-Mutakabbir", "The Supreme"],
    ["الخالق", "Al-Khaliq", "The Creator"],
    ["البارئ", "Al-Bari'", "The Maker"],
    ["المصور", "Al-Musawwir", "The Fashioner of Forms"],
    ["الغفار", "Al-Ghaffar", "The Ever-Forgiving"],
    ["القهار", "Al-Qahhar", "The Subduer"],
    ["الوهاب", "Al-Wahhab", "The Bestower"],
    ["الرزاق", "Ar-Razzaq", "The Provider"],
    ["الفتاح", "Al-Fattah", "The Opener"],
    ["العليم", "Al-'Alim", "The All-Knowing"],
    ["القابض", "Al-Qabid", "The Withholder"],
    ["الباسط", "Al-Basit", "The Extender"],
    ["الخافض", "Al-Khafid", "The Abaser"],
    ["الرافع", "Ar-Rafi'", "The Exalter"],
    ["المعز", "Al-Mu'izz", "The Giver of Honour"],
    ["المذل", "Al-Mudhill", "The Giver of Dishonour"],
    ["السميع", "As-Sami'", "The All-Hearing"],
    ["البصير", "Al-Basir", "The All-Seeing"],
    ["الحكم", "Al-Hakam", "The Judge"],
    ["العدل", "Al-'Adl", "The Utterly Just"],
    ["اللطيف", "Al-Latif", "The Subtle, the Kind"],
    ["الخبير", "Al-Khabir", "The All-Aware"],
    ["الحليم", "Al-Halim", "The Forbearing"],
    ["العظيم", "Al-'Azim", "The Magnificent"],
    ["الغفور", "Al-Ghafur", "The All-Forgiving"],
    ["الشكور", "Ash-Shakur", "The Most Appreciative"],
    ["العلي", "Al-'Aliyy", "The Most High"],
    ["الكبير", "Al-Kabir", "The Most Great"],
    ["الحفيظ", "Al-Hafiz", "The Preserver"],
    ["المقيت", "Al-Muqit", "The Sustainer"],
    ["الحسيب", "Al-Hasib", "The Reckoner"],
    ["الجليل", "Al-Jalil", "The Majestic"],
    ["الكريم", "Al-Karim", "The Most Generous"],
    ["الرقيب", "Ar-Raqib", "The Watchful"],
    ["المجيب", "Al-Mujib", "The Responsive"],
    ["الواسع", "Al-Wasi'", "The All-Encompassing"],
    ["الحكيم", "Al-Hakim", "The All-Wise"],
    ["الودود", "Al-Wadud", "The Most Loving"],
    ["المجيد", "Al-Majid", "The Most Glorious"],
    ["الباعث", "Al-Ba'ith", "The Resurrector"],
    ["الشهيد", "Ash-Shahid", "The Witness"],
    ["الحق", "Al-Haqq", "The Truth"],
    ["الوكيل", "Al-Wakil", "The Trustee"],
    ["القوي", "Al-Qawiyy", "The All-Strong"],
    ["المتين", "Al-Matin", "The Firm"],
    ["الولي", "Al-Waliyy", "The Protecting Friend"],
    ["الحميد", "Al-Hamid", "The Praiseworthy"],
    ["المحصي", "Al-Muhsi", "The Accounter"],
    ["المبدئ", "Al-Mubdi'", "The Originator"],
    ["المعيد", "Al-Mu'id", "The Restorer"],
    ["المحيي", "Al-Muhyi", "The Giver of Life"],
    ["المميت", "Al-Mumit", "The Bringer of Death"],
    ["الحي", "Al-Hayy", "The Ever-Living"],
    ["القيوم", "Al-Qayyum", "The Sustainer of All"],
    ["الواجد", "Al-Wajid", "The Finder"],
    ["الماجد", "Al-Maajid", "The Noble"],
    ["الواحد", "Al-Wahid", "The One"],
    ["الأحد", "Al-Ahad", "The Unique"],
    ["الصمد", "As-Samad", "The Eternal Refuge"],
    ["القادر", "Al-Qadir", "The All-Capable"],
    ["المقتدر", "Al-Muqtadir", "The All-Powerful"],
    ["المقدم", "Al-Muqaddim", "The Expediter"],
    ["المؤخر", "Al-Mu'akhkhir", "The Delayer"],
    ["الأول", "Al-Awwal", "The First"],
    ["الآخر", "Al-Akhir", "The Last"],
    ["الظاهر", "Az-Zahir", "The Manifest"],
    ["الباطن", "Al-Batin", "The Hidden"],
    ["الوالي", "Al-Wali", "The Governor"],
    ["المتعالي", "Al-Muta'ali", "The Supremely Exalted"],
    ["البر", "Al-Barr", "The Source of Goodness"],
    ["التواب", "At-Tawwab", "The Accepter of Repentance"],
    ["المنتقم", "Al-Muntaqim", "The Avenger"],
    ["العفو", "Al-'Afuww", "The Pardoner"],
    ["الرؤوف", "Ar-Ra'uf", "The Most Kind"],
    ["مالك الملك", "Malik al-Mulk", "Owner of All Sovereignty"],
    ["ذو الجلال والإكرام", "Dhul-Jalali wal-Ikram", "Lord of Majesty and Generosity"],
    ["المقسط", "Al-Muqsit", "The Equitable"],
    ["الجامع", "Al-Jami'", "The Gatherer"],
    ["الغني", "Al-Ghaniyy", "The Self-Sufficient"],
    ["المغني", "Al-Mughni", "The Enricher"],
    ["المانع", "Al-Mani'", "The Preventer"],
    ["الضار", "Ad-Darr", "The Bringer of Harm"],
    ["النافع", "An-Nafi'", "The Bringer of Benefit"],
    ["النور", "An-Nur", "The Light"],
    ["الهادي", "Al-Hadi", "The Guide"],
    ["البديع", "Al-Badi'", "The Incomparable Originator"],
    ["الباقي", "Al-Baqi", "The Everlasting"],
    ["الوارث", "Al-Warith", "The Inheritor"],
    ["الرشيد", "Ar-Rashid", "The Guide to the Right Path"],
    ["الصبور", "As-Sabur", "The Most Patient"],
  ];
  SS.NAMES = N.map(function (n, i) { return { n: i + 1, ar: n[0], tr: n[1], en: n[2] }; });

  /* ── Juz boundaries: [surah, ayah] where each juz begins ───────────── */
  SS.JUZ = [
    [1, 1], [2, 142], [2, 253], [3, 93], [4, 24], [4, 148], [5, 82], [6, 111], [7, 88], [8, 41],
    [9, 93], [11, 6], [12, 53], [15, 1], [17, 1], [18, 75], [21, 1], [23, 1], [25, 21], [27, 56],
    [29, 46], [33, 31], [36, 28], [39, 32], [41, 47], [46, 1], [51, 31], [58, 1], [67, 1], [78, 1],
  ];

  /* ── Qur'an translations offered in the reader (AlQuran Cloud editions) ── */
  SS.TRANSLATIONS = [
    { id: "en.sahih", label: "English — Saheeh International", lang: "en", dir: "ltr" },
    { id: "ur.jalandhry", label: "اردو — جالندھری (Urdu)", lang: "ur", dir: "rtl" },
    { id: "id.indonesian", label: "Bahasa Indonesia — Kemenag", lang: "id", dir: "ltr" },
    { id: "tr.diyanet", label: "Türkçe — Diyanet İşleri", lang: "tr", dir: "ltr" },
    { id: "bn.bengali", label: "বাংলা — Muhiuddin Khan (Bengali)", lang: "bn", dir: "ltr" },
    { id: "fr.hamidullah", label: "Français — Hamidullah", lang: "fr", dir: "ltr" },
    { id: "ms.basmeih", label: "Bahasa Melayu — Basmeih", lang: "ms", dir: "ltr" },
    { id: "es.cortes", label: "Español — Cortés", lang: "es", dir: "ltr" },
    { id: "de.bubenheim", label: "Deutsch — Bubenheim & Elyas", lang: "de", dir: "ltr" },
  ];

  /* ── Morning & evening adhkar (guided sequence) ──────────────────────
     Items are either Qur'an passages (fetched from the Qur'an API so the
     text is always the authentic Uthmani text), references to SS.DUAS, or
     inline entries. `when`: "both" | "morning" | "evening". */
  SS.ADHKAR = [
    { id: "kursi", when: "both", count: 1, quran: [[2, 255]], titleEn: "Ayat al-Kursi", source: "Qur'an 2:255 — recited morning and evening (Hisn al-Muslim)" },
    { id: "quls", when: "both", count: 3, quran: [[112, 0], [113, 0], [114, 0]], titleEn: "Al-Ikhlas, Al-Falaq and An-Nas", source: "Abu Dawud 5082; At-Tirmidhi 3575" },
    { id: "asbahna", when: "morning", count: 1, dua: "asbahna" },
    {
      id: "amsayna", when: "evening", count: 1, titleEn: "Upon entering the evening",
      arabic: "اللَّهُمَّ بِكَ أَمْسَيْنَا، وَبِكَ أَصْبَحْنَا، وَبِكَ نَحْيَا، وَبِكَ نَمُوتُ، وَإِلَيْكَ الْمَصِيرُ",
      transliteration: "Allahumma bika amsayna, wa bika asbahna, wa bika nahya, wa bika namutu, wa ilaykal-masir.",
      translationEn: "O Allah, by You we enter the evening and by You we enter the morning; by You we live and by You we die, and to You is the final return.",
      source: "At-Tirmidhi 3391",
    },
    { id: "sayyid", when: "both", count: 1, dua: "sayyid-istighfar" },
    { id: "bismillah", when: "both", count: 3, dua: "bismillah-protection" },
    { id: "radeetu", when: "both", count: 3, dua: "radeetu" },
    {
      id: "kalimat", when: "evening", count: 3, titleEn: "Refuge in Allah's perfect words",
      arabic: "أَعُوذُ بِكَلِمَاتِ اللَّهِ التَّامَّاتِ مِنْ شَرِّ مَا خَلَقَ",
      transliteration: "A'udhu bikalimatillahit-tammati min sharri ma khalaq.",
      translationEn: "I seek refuge in the perfect words of Allah from the evil of what He has created.",
      source: "Sahih Muslim 2709",
    },
    {
      id: "subhanallah-bihamdihi", when: "both", count: 100, titleEn: "Glory and praise",
      arabic: "سُبْحَانَ اللَّهِ وَبِحَمْدِهِ",
      transliteration: "SubhanAllahi wa bihamdihi.",
      translationEn: "Glory be to Allah, and praise be to Him.",
      source: "Sahih Muslim 2692",
    },
    {
      id: "tahlil-100", when: "morning", count: 100, titleEn: "Declaration of Oneness",
      arabic: "لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ، وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ",
      transliteration: "La ilaha illallahu wahdahu la sharika lah, lahul-mulku wa lahul-hamd, wa huwa 'ala kulli shay'in qadir.",
      translationEn: "There is no god but Allah alone, without partner. His is the dominion and His is the praise, and He is over all things capable.",
      source: "Sahih al-Bukhari 3293 (said 100 times in a day)",
    },
  ];

  /* ── Arabic alphabet ─────────────────────────────────────────────────
     [letter, name (Arabic), name (English), sound hint, connects to the next letter?] */
  var L = [
    ["ا", "ألف", "Alif", "Long ‘aa’, or a carrier for hamza", false],
    ["ب", "باء", "Ba", "‘b’ as in book", true],
    ["ت", "تاء", "Ta", "‘t’ as in tea (light)", true],
    ["ث", "ثاء", "Tha", "‘th’ as in think", true],
    ["ج", "جيم", "Jim", "‘j’ as in jam", true],
    ["ح", "حاء", "Ha", "A breathy ‘h’ from the middle of the throat", true],
    ["خ", "خاء", "Kha", "‘kh’ like the ‘ch’ in Scottish loch", true],
    ["د", "دال", "Dal", "‘d’ as in door (light)", false],
    ["ذ", "ذال", "Dhal", "‘th’ as in this", false],
    ["ر", "راء", "Ra", "A rolled ‘r’", false],
    ["ز", "زاي", "Zay", "‘z’ as in zoo", false],
    ["س", "سين", "Sin", "‘s’ as in sun", true],
    ["ش", "شين", "Shin", "‘sh’ as in shoe", true],
    ["ص", "صاد", "Sad", "A heavy, full-mouthed ‘s’", true],
    ["ض", "ضاد", "Dad", "A heavy ‘d’ — the sound unique to Arabic", true],
    ["ط", "طاء", "Ta", "A heavy ‘t’", true],
    ["ظ", "ظاء", "Za", "A heavy ‘th’ as in this", true],
    ["ع", "عين", "'Ayn", "A voiced sound from the middle of the throat", true],
    ["غ", "غين", "Ghayn", "A gargled ‘gh’, like the French ‘r’", true],
    ["ف", "فاء", "Fa", "‘f’ as in fan", true],
    ["ق", "قاف", "Qaf", "A deep ‘q’ from the back of the throat", true],
    ["ك", "كاف", "Kaf", "‘k’ as in kite", true],
    ["ل", "لام", "Lam", "‘l’ as in lamp", true],
    ["م", "ميم", "Mim", "‘m’ as in moon", true],
    ["ن", "نون", "Nun", "‘n’ as in noon", true],
    ["ه", "هاء", "Ha", "‘h’ as in hat", true],
    ["و", "واو", "Waw", "‘w’ as in water, or a long ‘oo’", false],
    ["ي", "ياء", "Ya", "‘y’ as in yes, or a long ‘ee’", true],
  ];
  SS.LETTERS = L.map(function (l) { return { ch: l[0], nameAr: l[1], name: l[2], hint: l[3], joins: l[4] }; });

  /* Short vowels and other marks, shown on the letter ب. */
  SS.HARAKAT = [
    { mark: "بَ", name: "Fatha", ar: "فتحة", sound: "ba", hint: "A short ‘a’ — a small stroke above the letter." },
    { mark: "بِ", name: "Kasra", ar: "كسرة", sound: "bi", hint: "A short ‘i’ — a small stroke below the letter." },
    { mark: "بُ", name: "Damma", ar: "ضمة", sound: "bu", hint: "A short ‘u’ — a small curl above the letter." },
    { mark: "بْ", name: "Sukun", ar: "سكون", sound: "b", hint: "No vowel — the letter is stopped." },
    { mark: "بّ", name: "Shadda", ar: "شدة", sound: "bb", hint: "The letter is doubled (held slightly longer)." },
    { mark: "بً", name: "Tanwin fath", ar: "تنوين فتح", sound: "ban", hint: "‘-an’ at the end of a word." },
    { mark: "بٍ", name: "Tanwin kasr", ar: "تنوين كسر", sound: "bin", hint: "‘-in’ at the end of a word." },
    { mark: "بٌ", name: "Tanwin damm", ar: "تنوين ضم", sound: "bun", hint: "‘-un’ at the end of a word." },
    { mark: "بَا", name: "Long a (alif)", ar: "مد بالألف", sound: "baa", hint: "Fatha followed by alif makes a long ‘aa’." },
    { mark: "بِي", name: "Long i (ya)", ar: "مد بالياء", sound: "bee", hint: "Kasra followed by ya makes a long ‘ee’." },
    { mark: "بُو", name: "Long u (waw)", ar: "مد بالواو", sound: "boo", hint: "Damma followed by waw makes a long ‘oo’." },
  ];
})();
