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

  /* ── Version & release notes (newest first) ──────────────────────── */
  SS.VERSION = "2.6.0";
  SS.CHANGELOG = [
    {
      v: "2.6.0", date: "2026-10-05",
      en: "Qur'an+: Offline Qur'an", ar: "القرآن+: القرآن دون اتصال",
      den: "Download the Qur'an once and read, listen and study with no internet.",
      dar: "نزّل القرآن مرة واحدة واقرأ واستمع وتدبّر دون إنترنت.",
      items: [
        { en: "New Offline Qur'an in Settings: download all 114 surahs (Arabic, your translation and transliteration) to read with no internet", ar: "جديد: القرآن دون اتصال في الإعدادات — نزّل السور الـ١١٤ (العربية وترجمتك والنقحرة) لتقرأ دون إنترنت" },
        { en: "Add more translations for offline reading, each shown with its size", ar: "أضف ترجمات أخرى للقراءة دون اتصال، مع حجم كل منها" },
        { en: "Download recitation for one surah or all of them, and listen offline — even continuous play into the next surah", ar: "نزّل التلاوة لسورة واحدة أو للسور كلها واستمع دون اتصال — حتى مع التشغيل المتواصل إلى السورة التالية" },
        { en: "Download Tafsir Ibn Kathir for offline study", ar: "نزّل تفسير ابن كثير للدراسة دون اتصال" },
        { en: "Downloads pause, resume and carry on by themselves after a lost connection or a closed tab, with progress, sizes and clear messages", ar: "التنزيلات تتوقف وتُستأنف وتكمل وحدها بعد انقطاع الاتصال أو إغلاق الصفحة، مع التقدّم والأحجام ورسائل واضحة" },
        { en: "See the storage used and remove any download, or all of them; downloads stay on your device and are never synced", ar: "اعرف المساحة المستخدمة واحذف أي تنزيل أو كلها؛ تبقى التنزيلات على جهازك ولا تُزامَن أبدًا" },
        { en: "Ready for a downloadable Qur'an PDF with a built-in offline viewer (shown once the file is available)", ar: "جاهز لملف قرآن PDF قابل للتنزيل مع عارض مدمج يعمل دون اتصال (يظهر عند توفّر الملف)" },
      ],
    },
    {
      v: "2.5.8", date: "2026-10-05",
      en: "SalaamStreet at a glance", ar: "سلام ستريت في لمحة",
      items: [
        { en: "New “SalaamStreet at a glance” page: quick facts about the app and answers to common questions", ar: "صفحة جديدة «سلام ستريت في لمحة»: معلومات سريعة عن التطبيق وإجابات عن الأسئلة الشائعة" },
        { en: "Our story now names Ibrahim's father, Aquil, who builds SalaamStreet with him", ar: "قصتنا تذكر الآن والد إبراهيم، عقيل، الذي يبني سلام ستريت معه" },
        { en: "Easier for search engines and AI assistants to understand SalaamStreet correctly", ar: "أسهل على محركات البحث والمساعدات الذكية فهم سلام ستريت بشكل صحيح" },
      ],
    },
    {
      v: "2.5.7", date: "2026-10-05",
      en: "Camera, launch screen & search fixes", ar: "إصلاحات الكاميرا وشاشة البدء والبحث",
      items: [
        { en: "Qibla Camera Mode: the camera now comes back on its own when you return to the app — no more black screen", ar: "وضع الكاميرا للقبلة: تعود الكاميرا تلقائيًا عند الرجوع إلى التطبيق — لا شاشة سوداء بعد الآن" },
        { en: "The camera never stays on in the background if you leave Camera Mode while it's starting", ar: "لا تبقى الكاميرا تعمل في الخلفية إذا غادرت وضع الكاميرا أثناء تشغيلها" },
        { en: "iPhone and iPad: the launch screen now matches light or dark mode", ar: "iPhone وiPad: شاشة البدء تطابق الآن الوضع الفاتح أو الداكن" },
        { en: "Easier to find on Google: new Qibla direction page, Qibla directions for 60 cities, and a proper logo and preview when SalaamStreet is shared", ar: "أسهل في العثور عليه عبر Google: صفحة جديدة لاتجاه القبلة، واتجاه القبلة لـ٦٠ مدينة، وشعار ومعاينة مناسبة عند مشاركة سلام ستريت" },
      ],
    },
    {
      v: "2.5.6", date: "2026-10-05",
      en: "More languages, fewer rough edges", ar: "لغات أكثر وتحسينات صغيرة",
      items: [
        { en: "Urdu, Bengali, Indonesian, Turkish and French now cover the whole app — accounts, the new Qibla, the MSA tab and the About page (drafts, pending native review)", ar: "الأردية والبنغالية والإندونيسية والتركية والفرنسية تغطي الآن التطبيق كله — الحسابات والقبلة الجديدة وتبويب الرابطة وصفحة «من نحن» (مسودات بانتظار المراجعة)" },
        { en: "The MSA tab now names our first school: the Neuqua Valley High School (NVHS) MSA", ar: "تبويب الرابطة يذكر الآن مدرستنا الأولى: رابطة مدرسة Neuqua Valley الثانوية (NVHS)" },
        { en: "Fixed the Account page being slightly too wide on small phones in some languages", ar: "إصلاح اتساع صفحة الحساب قليلًا على الهواتف الصغيرة في بعض اللغات" },
      ],
    },
    {
      v: "2.5.5", date: "2026-10-04",
      en: "Quality of Life + Bug Fixes", ar: "تحسينات الاستخدام وإصلاح الأخطاء",
      den: "A redesigned Qibla with a smoother Camera Mode, Ayah of the Day audio, and a first look at SalaamStreet for MSAs.",
      dar: "قبلة بتصميم جديد ووضع كاميرا أكثر سلاسة، وتلاوة لآية اليوم، ولمحة أولى عن سلام ستريت لروابط الطلاب المسلمين.",
      groups: [
        { en: "Qibla", ar: "القبلة", items: [
          { en: "Redesigned Qibla compass, in light and dark mode", ar: "تصميم جديد لبوصلة القبلة في الوضعين الفاتح والداكن" },
          { en: "Smoother Camera Mode — no more lag", ar: "وضع كاميرا أكثر سلاسة — دون تأخير" },
          { en: "Clear “Turn left / Turn right” guidance and a heading strip in Camera Mode", ar: "إرشاد واضح «استدر يسارًا / يمينًا» وشريط اتجاه في وضع الكاميرا" },
          { en: "Lock-on animation and a short vibration when you face the Qibla", ar: "حركة تثبيت واهتزاز قصير عندما تتجه إلى القبلة" },
        ] },
        { en: "Home", ar: "الرئيسية", items: [
          { en: "Listen to the Ayah of the Day", ar: "استمع إلى آية اليوم" },
        ] },
        { en: "MSA", ar: "رابطة الطلاب المسلمين", items: [
          { en: "New MSA tab — opening soon, starting with the Neuqua Valley High School (NVHS) MSA", ar: "تبويب جديد لرابطة الطلاب المسلمين — قريبًا، بدءًا برابطة مدرسة Neuqua Valley الثانوية (NVHS)" },
        ] },
        { en: "Accounts", ar: "الحسابات", items: [
          { en: "Continue with Google is now switched on", ar: "تفعيل تسجيل الدخول عبر Google" },
          { en: "Create an account with email and password, and reset a forgotten password", ar: "إنشاء حساب بالبريد الإلكتروني وكلمة المرور، واستعادة كلمة مرور منسية" },
        ] },
        { en: "Bug fixes", ar: "إصلاح الأخطاء", items: [
          { en: "Fixed the wrong colour flashing for a moment when the app opens", ar: "إصلاح ظهور لون خاطئ للحظة عند فتح التطبيق" },
          { en: "General bug fixes and stability improvements", ar: "إصلاحات عامة وتحسينات في الثبات" },
        ] },
      ],
    },
    {
      v: "2.5.0", date: "2026-10-04",
      en: "Accounts + Guest Mode", ar: "الحسابات ووضع الضيف",
      den: "Optional free accounts to keep your bookmarks, streaks and settings on all your devices — and everything keeps working without one in guest mode.",
      dar: "حسابات مجانية اختيارية لتبقى إشاراتك وسلاسلك وإعداداتك على كل أجهزتك — ويبقى كل شيء يعمل دونها في وضع الضيف.",
      groups: [
        { en: "Accounts", ar: "الحسابات", items: [
          { en: "Added free SalaamStreet accounts", ar: "حسابات سلام ستريت المجانية" },
          { en: "Added Apple, Google, Phone, and Email sign-in", ar: "تسجيل الدخول عبر Apple وGoogle والهاتف والبريد الإلكتروني" },
          { en: "Added cross-device synchronization", ar: "المزامنة بين الأجهزة" },
          { en: "Added synced bookmarks, streaks, settings, and Qur'an progress", ar: "مزامنة الإشارات والسلاسل والإعدادات والتقدّم في القرآن" },
          { en: "Added personalized account dashboard", ar: "لوحة شخصية لحسابك" },
          { en: "Added Continue Reading", ar: "متابعة القراءة" },
          { en: "Improved bookmark management", ar: "إدارة أفضل للإشارات" },
        ] },
        { en: "Guest Mode", ar: "وضع الضيف", items: [
          { en: "SalaamStreet can still be used without an account", ar: "يمكن استخدام سلام ستريت دون حساب" },
          { en: "No account is required for core features", ar: "لا حاجة إلى حساب للميزات الأساسية" },
          { en: "Guest data can be migrated when creating an account", ar: "تُنقل بيانات الضيف عند إنشاء حساب" },
        ] },
        { en: "Qibla", ar: "القبلة", items: [
          { en: "Fixed Qibla direction and compass issues", ar: "إصلاح اتجاه القبلة ومشكلات البوصلة" },
          { en: "Added Qibla Camera Mode", ar: "وضع الكاميرا للقبلة" },
        ] },
        { en: "Qur'an", ar: "القرآن", items: [
          { en: "Fixed Qur'an Tafsir issues", ar: "إصلاح مشكلات التفسير" },
          { en: "Improved Tafsir loading and ayah synchronization", ar: "تحسين تحميل التفسير ومطابقته للآية" },
        ] },
        { en: "UI & Stability", ar: "الواجهة والثبات", items: [
          { en: "Fixed loading screen theme mismatch", ar: "إصلاح اختلاف مظهر شاشة التحميل" },
          { en: "Improved startup theme handling", ar: "تحسين تطبيق المظهر عند البدء" },
          { en: "General bug fixes and stability improvements", ar: "إصلاحات عامة وتحسينات في الثبات" },
        ] },
      ],
    },
    {
      v: "2.4.1", date: "2026-10-04",
      en: "Polish, flexibility & UI quality", ar: "تحسينات ومرونة وجودة الواجهة",
      items: [
        { en: "The official SalaamStreet logo everywhere — app icon, browser tab, home screen, launch screens and share images", ar: "شعار سلام ستريت الرسمي في كل مكان — أيقونة التطبيق والمتصفح والشاشة الرئيسية وشاشات البدء وصور المشاركة" },
        { en: "Choose miles or kilometres, 12- or 24-hour time, and your own dhikr targets", ar: "اختر الأميال أو الكيلومترات، وصيغة ١٢ أو ٢٤ ساعة، وأهداف الذكر الخاصة بك" },
        { en: "Optional Imsak, midnight and last-third times, and keep playing into the next surah", ar: "أوقات اختيارية للإمساك ومنتصف الليل والثلث الأخير، ومتابعة التشغيل إلى السورة التالية" },
        { en: "A clearer Updates tab, richer Adhkar and Hadith pages, and Arabic layout fixes", ar: "تبويب تحديثات أوضح، وصفحات أذكار وحديث أغنى، وإصلاحات في تخطيط العربية" },
      ],
    },
    {
      v: "2.4.0", date: "2026-10-04",
      en: "Our story, a new look and home-screen support", ar: "قصتنا وهوية جديدة ودعم الشاشة الرئيسية",
      items: [
        { en: "New About page with the story behind SalaamStreet and our promise", ar: "صفحة «من نحن» الجديدة مع قصة سلام ستريت ووعدنا" },
        { en: "Updates tab with version history and what's coming next", ar: "تبويب التحديثات مع سجل الإصدارات وما هو قادم" },
        { en: "New SalaamStreet logo", ar: "شعار جديد لسلام ستريت" },
        { en: "Better “Add to Home Screen” support on iPhone and iPad, with launch screens", ar: "دعم أفضل لـ«الإضافة إلى الشاشة الرئيسية» على iPhone وiPad مع شاشات البدء" },
      ],
    },
    {
      v: "2.3.0", date: "2026-10-04",
      en: "Five more languages", ar: "خمس لغات إضافية",
      items: [
        { en: "Urdu, Bengali, Indonesian, Turkish and French (drafts, pending native review)", ar: "الأردية والبنغالية والإندونيسية والتركية والفرنسية (مسودات بانتظار المراجعة)" },
        { en: "Language picker in the top bar; Qur'an translation follows your language", ar: "اختيار اللغة من الشريط العلوي؛ وترجمة القرآن تتبع لغتك" },
      ],
    },
    {
      v: "2.2.0", date: "2026-10-04",
      en: "For mosques, and easier to find", ar: "للمساجد، وأسهل في الوصول",
      items: [
        { en: "Free prayer-times widget for mosque websites", ar: "أداة مجانية لمواقيت الصلاة لمواقع المساجد" },
        { en: "Pages for every surah, the duas, the 99 Names and 60 cities' prayer times", ar: "صفحات لكل سورة والأدعية والأسماء الحسنى ومواقيت ٦٠ مدينة" },
      ],
    },
    {
      v: "2.1.0", date: "2026-10-04",
      en: "Daily habits and deeper study", ar: "عادات يومية ودراسة أعمق",
      items: [
        { en: "Prayer tracker, prayer reminders and a Friday Al-Kahf reminder", ar: "متابعة الصلاة وتنبيهات الصلاة وتذكير الكهف يوم الجمعة" },
        { en: "Guided morning & evening adhkar, and Ramadan mode", ar: "أذكار الصباح والمساء الموجّهة ووضع رمضان" },
        { en: "Qur'an reading plans, juz, memorize mode, search and 9 translations", ar: "خطط قراءة القرآن والأجزاء ووضع الحفظ والبحث و٩ ترجمات" },
        { en: "99 Names of Allah, mosque finder, Learn Arabic and share-as-image", ar: "الأسماء الحسنى والبحث عن المساجد وتعلّم العربية والمشاركة كصورة" },
      ],
    },
    {
      v: "2.0.0", date: "2026-10-04",
      en: "Rebuilt for every screen", ar: "إعادة بناء لكل الشاشات",
      items: [
        { en: "Redesigned for phones, tablets, laptops and large monitors", ar: "تصميم جديد للهواتف والأجهزة اللوحية والحواسيب والشاشات الكبيرة" },
        { en: "Everything is free — the old paid plans were removed", ar: "كل شيء مجاني — أُزيلت الخطط المدفوعة القديمة" },
        { en: "Works offline and can be installed like an app", ar: "يعمل دون اتصال ويمكن تثبيته كتطبيق" },
      ],
    },
    {
      v: "1.0.0", date: "",
      en: "The first SalaamStreet web app", ar: "أول نسخة ويب من سلام ستريت",
      items: [
        { en: "Prayer times, Qibla, Qur'an with audio, hadith, duas, dhikr and the Islamic calendar", ar: "مواقيت الصلاة والقبلة والقرآن بالصوت والحديث والأدعية والذكر والتقويم الهجري" },
      ],
    },
  ];
  // Releases with grouped notes also expose a flat `items` list.
  SS.CHANGELOG.forEach(function (c) {
    if (c.groups && !c.items) c.items = [].concat.apply([], c.groups.map(function (g) { return g.items; }));
  });
  /* What's planned — honest plans in order, never dates. Nothing here is released yet. */
  SS.ROADMAP = [
    { v: "2.7.0", icon: "scroll", en: "Hadith + Knowledge", ar: "الحديث والمعرفة",
      den: "More hadith and authentic Islamic knowledge — always clearly sourced.",
      dar: "مزيد من الأحاديث والمعرفة الإسلامية الموثوقة — مع ذكر المصدر دائمًا." },
    { v: "2.8.0", icon: "letters", en: "Learn", ar: "تعلّم",
      den: "Step-by-step learning that grows from today's Arabic letters lessons.",
      dar: "تعلّم خطوة بخطوة ينطلق من دروس الحروف العربية الحالية." },
    { v: "2.9.0", icon: "mosque", en: "MSA + Community", ar: "رابطة الطلاب المسلمين والمجتمع",
      den: "Tools for Muslim Student Associations and local communities. The MSA tab is already open as a preview.",
      dar: "أدوات لروابط الطلاب المسلمين والمجتمعات المحلية. تبويب الرابطة متاح الآن كمعاينة." },
    { v: "3.0.0", icon: "sparkle", en: "Major SalaamStreet Milestone", ar: "محطة كبرى لسلام ستريت",
      den: "A major milestone for SalaamStreet. Plans may change as we learn from you.",
      dar: "محطة كبرى في مسيرة سلام ستريت. قد تتغير الخطط بحسب ما نتعلمه منكم." },
  ];
})();
