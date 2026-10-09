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
  SS.VERSION = "3.1.5";
  SS.CHANGELOG = [
    {
      v: "3.1.5", date: "2026-10-09",
      en: "Modes, made useful", ar: "أوضاع أنفع",
      den: "Each mode now answers one question the moment you open the app — and switching takes one tap.",
      dar: "صار كل وضع يجيب عن سؤال واحد بمجرد فتح التطبيق — والتبديل بلمسة واحدة.",
      groups: [
        { en: "Every mode has a point", ar: "لكل وضع فائدة واضحة", items: [
          { en: "Travel Mode tells you how to pray: Dhuhr, Asr and Isha as 2 rak'ahs, and when you may combine — with sources, right in the prayer card on Home", ar: "وضع السفر يخبرك كيف تصلي: الظهر والعصر والعشاء ركعتين، ومتى يجوز الجمع — مع الأدلة، داخل بطاقة الصلاة في الرئيسية" },
          { en: "Travel Mode: set the day you're coming home; after it, Home asks once and \u201cI'm home\u201d switches the mode off and your prayer times back to home", ar: "وضع السفر: حدّد يوم عودتك؛ بعده تسألك الرئيسية مرة واحدة، و«عدتُ إلى البيت» يوقف الوضع ويعيد مواقيت مدينتك" },
          { en: "Mosque Mode: one big \u201cI'm at the mosque\u201d button turns on Quiet Mode for an hour, and it ends by itself", ar: "وضع المسجد: زر كبير «أنا في المسجد» يشغّل الوضع الهادئ لساعة، وينتهي من تلقاء نفسه" },
          { en: "Hajj & Umrah Mode: your next step on Home, and a round counter for tawaf and sa'i that says where each round goes", ar: "وضع الحج والعمرة: خطوتك التالية في الرئيسية، وعدّاد لأشواط الطواف والسعي يبيّن اتجاه كل شوط" },
        ] },
        { en: "Cleaner and easier", ar: "أنظف وأسهل", items: [
          { en: "No more box of grey tiles above Home: the mode's answer sits inside the prayer card, and Home gets shorter", ar: "لا مزيد من المربعات الرمادية أعلى الرئيسية: إجابة الوضع داخل بطاقة الصلاة، والرئيسية أقصر" },
          { en: "Tap the mode badge in the top bar to switch modes without leaving the page", ar: "المس شارة الوضع في الشريط العلوي لتبديل الوضع دون مغادرة الصفحة" },
          { en: "A simpler mode picker: one row per mode, one tap, and a line saying what each is for", ar: "منتقي أوضاع أبسط: سطر لكل وضع، ولمسة واحدة، وجملة توضح فائدة كل وضع" },
          { en: "The app's own icons and a colour for each mode, instead of emoji", ar: "أيقونات التطبيق ولون لكل وضع بدل الرموز التعبيرية" },
          { en: "Kids Mode is set up from the Family page (linked from Modes), since it belongs to a child's device", ar: "يُعدّ وضع الأطفال من صفحة العائلة (برابط من الأوضاع)، لأنه يخص جهاز الطفل" },
        ] },
        { en: "Fixes", ar: "إصلاحات", items: [
          { en: "If your location can't be found, Travel Mode and Mosque Mode say so instead of loading forever", ar: "إذا تعذّر تحديد موقعك، يوضح وضعا السفر والمسجد ذلك بدل التحميل بلا نهاية" },
          { en: "On a Friday afternoon, Mosque Mode shows next Friday's Jumu'ah, not today's", ar: "بعد ظهر الجمعة يعرض وضع المسجد جمعة الأسبوع القادم لا جمعة اليوم" },
          { en: "Long Names of Allah no longer push the Name of the day card off the edge of small phones", ar: "لم تعد أسماء الله الطويلة تدفع بطاقة اسم اليوم خارج حافة الهواتف الصغيرة" },
        ] },
      ],
    },
    {
      v: "3.1.0", date: "2026-10-09",
      en: "NVHS MSA", ar: "رابطة الطلاب المسلمين في NVHS",
      den: "A home for the Neuqua Valley High School Muslim Student Association: its announcements, with pictures, for everyone.",
      dar: "مكان لرابطة الطلاب المسلمين في مدرسة نيوكوا فالي الثانوية: إعلاناتها بالصور للجميع.",
      groups: [
        { en: "New: NVHS MSA", ar: "جديد: رابطة NVHS", items: [
          { en: "An NVHS MSA page in the menu and sidebar with the club's announcements — no account needed to read them", ar: "صفحة لرابطة NVHS في القائمة والشريط الجانبي فيها إعلانات الرابطة — دون حاجة إلى حساب لقراءتها" },
          { en: "Each announcement can have a picture; long ones fold with \u201cRead more\u201d, and web links can be tapped", ar: "يمكن أن يكون لكل إعلان صورة؛ وتُطوى الإعلانات الطويلة مع «اقرأ المزيد»، والروابط قابلة للنقر" },
          { en: "Important announcements also appear as one slim card on everyone's Home, which you can hide", ar: "تظهر الإعلانات المهمة أيضًا كبطاقة صغيرة في رئيسية الجميع، ويمكنك إخفاؤها" },
          { en: "The MSA's posters sign in to post, edit, pin and delete — with a title, text and a photo, and an end date so old posts disappear", ar: "ينشر منسقو الرابطة بعد تسجيل الدخول ويعدّلون ويثبّتون ويحذفون — بعنوان ونص وصورة وتاريخ انتهاء لتختفي الإعلانات القديمة" },
          { en: "Only the MSA's own accounts can post, and the server checks it every time; photos are shrunk and their location data removed before upload", ar: "لا ينشر إلا حسابات الرابطة نفسها، ويتحقق الخادم من ذلك في كل مرة؛ وتُصغّر الصور وتُزال منها بيانات الموقع قبل الرفع" },
          { en: "Works offline with the last announcements loaded; Kids Mode never shows them", ar: "تعمل دون اتصال بآخر الإعلانات المحمّلة؛ ولا تظهر أبدًا في وضع الأطفال" },
        ] },
      ],
    },
    {
      v: "3.0.0", date: "2026-10-08",
      en: "Modes", ar: "الأوضاع",
      den: "A new way to experience SalaamStreet: five Modes that put the right tools first for what you're doing — at home, travelling, learning as a child, on Hajj or Umrah, or at the mosque.",
      dar: "طريقة جديدة لاستخدام سلام ستريت: خمسة أوضاع تقدّم الأدوات المناسبة لما تفعله — في البيت، أو في السفر، أو تعلّم الأطفال، أو في الحج والعمرة، أو في المسجد.",
      groups: [
        { en: "New: Modes", ar: "جديد: الأوضاع", items: [
          { en: "Choose Your Mode — Normal, Travel, Kids, Hajj & Umrah and Mosque — from your Account page, the menu or the sidebar", ar: "اختر وضعك — عادي، سفر، أطفال، حج وعمرة، مسجد — من صفحة حسابك أو القائمة أو الشريط الجانبي" },
          { en: "Each mode puts its own dashboard at the top of Home and reorders your quick links; switching back to Normal restores everything, and nothing is ever deleted", ar: "لكل وضع لوحته أعلى الرئيسية وترتيبه للاختصارات، والرجوع إلى الوضع العادي يعيد كل شيء ولا يُحذف شيء" },
          { en: "Your mode is remembered after a refresh or restart, and syncs across your devices when you're signed in; guests keep it on the device and bring it with them when they sign up", ar: "يُحفظ وضعك بعد التحديث أو إعادة التشغيل، ويُزامن بين أجهزتك عند تسجيل الدخول، ويبقى على الجهاز للزائر وينتقل معه عند التسجيل" },
          { en: "A small mode badge in the top bar opens the mode picker; gentle, dismissible suggestions (at most one per visit) offer a mode on the Mosques, Calendar and travel-dua pages", ar: "شارة صغيرة في الشريط العلوي تفتح منتقي الأوضاع، واقتراحات لطيفة قابلة للإغلاق (مرة على الأكثر في الزيارة) في صفحات المساجد والتقويم وأدعية السفر" },
        ] },
        { en: "Kids Mode and Family", ar: "وضع الأطفال والعائلة", items: [
          { en: "A parent-managed Kids Mode: add several children (first name or nickname, age range and avatar only) and choose what each can use", ar: "وضع أطفال يديره الوالدان: أضف عدة أطفال (الاسم الأول أو اسم التدليل والعمر والصورة الرمزية فقط) واختر ما يستخدمه كل منهم" },
          { en: "Children never get the parent's password: a device is connected to one child with a one-time code, or by the parent on their own device, and a grown-up PIN is needed to leave", ar: "لا يحصل الطفل على كلمة مرور الوالد: يُربط الجهاز بطفل واحد برمز لمرة واحدة أو من جهاز الوالد، ويلزم رمز الكبار للخروج" },
          { en: "Learn prayer and wudu, read and listen to short surahs, everyday duas, stories of the Prophets, Names of Allah, good manners, pillars and history — every lesson with its source", ar: "تعلّم الصلاة والوضوء، واقرأ واستمع إلى السور القصيرة، والأدعية اليومية، وقصص الأنبياء، وأسماء الله، والآداب، والأركان، والتاريخ — مع مصدر كل درس" },
          { en: "Quizzes, put-the-steps-in-order activities, flashcards, a daily learning card and gentle achievements — saved for each child separately, never a competition", ar: "اختبارات وأنشطة ترتيب الخطوات وبطاقات وبطاقة تعلّم يومية وإنجازات لطيفة — تُحفظ لكل طفل على حدة ولا تنافس فيها" },
          { en: "A Family page for parents: each child's real progress, achievements and devices; restrictions enforced by the server; reset progress or remove a child and all their data", ar: "صفحة العائلة للوالدين: تقدّم كل طفل الحقيقي وإنجازاته وأجهزته، وقيود يفرضها الخادم، وإعادة ضبط التقدّم أو حذف الطفل وكل بياناته" },
        ] },
        { en: "Travel Mode", ar: "وضع السفر", items: [
          { en: "Prayer times with a countdown, the Qibla and the Hijri date wherever you are — with or without location permission", ar: "مواقيت الصلاة مع العد التنازلي والقبلة والتاريخ الهجري حيثما كنت — بإذن الموقع أو دونه" },
          { en: "A destination with its own prayer times and Qibla, saved places, and one tap to use a place for prayer times app-wide (and back home again)", ar: "وجهة بمواقيتها وقبلتها، وأماكن محفوظة، ولمسة واحدة لاعتماد مكان لمواقيت التطبيق كله (والعودة إلى مدينتك)" },
          { en: "Travel duas, a four-part travel checklist, and sourced guidance on shortening and combining prayers that sets out where the schools differ", ar: "أدعية السفر، وقائمة سفر من أربعة أقسام، وإرشاد موثّق في القصر والجمع يبيّن مواضع الخلاف بين المذاهب" },
        ] },
        { en: "Hajj & Umrah Mode", ar: "وضع الحج والعمرة", items: [
          { en: "Step-by-step Umrah (7 steps) and Hajj (11 steps, 8–13 Dhul-Hijjah) guides with sources, the duas for each step, and notes where scholars differ", ar: "دليل العمرة (٧ خطوات) والحج (١١ خطوة، من ٨ إلى ١٣ ذي الحجة) خطوة بخطوة مع المصادر وأدعية كل خطوة ومواضع الخلاف" },
          { en: "Mark steps done, see where you are and what's next, resume where you left off, and start over for a new pilgrimage; a packing and preparation checklist", ar: "علّم الخطوات المكتملة، واعرف أين أنت وما التالي، وتابع من حيث توقفت، وابدأ من جديد لنسك جديد، مع قائمة تجهيز واستعداد" },
        ] },
        { en: "Mosque Mode", ar: "وضع المسجد", items: [
          { en: "Choose your mosque near you or by searching an area, save favourites, and see its prayer times, next Friday and Qibla", ar: "اختر مسجدك قريبًا منك أو بالبحث في منطقة، واحفظ المفضلة، واعرض مواقيته والجمعة القادمة والقبلة" },
          { en: "Honest data: details come from OpenStreetMap and are labelled as such; times are calculated start times, not the mosque's iqamah; you can note a Jumu'ah time for yourself", ar: "بيانات صادقة: التفاصيل من OpenStreetMap وموسومة بذلك، والمواقيت أوقات دخول محسوبة لا أوقات الإقامة، ويمكنك تدوين وقت الجمعة لنفسك" },
          { en: "Optional Quiet Mode: no animations, fewer cards, and no non-prayer reminders or sounds from SalaamStreet while you're there", ar: "وضع هادئ اختياري: بلا حركة وبطاقات أقل وبلا تذكيرات أو أصوات غير الصلاة من سلام ستريت أثناء وجودك" },
        ] },
        { en: "Improvements", ar: "تحسينات", items: [
          { en: "Everything in Modes works on phones, tablets and desktops, in light and dark themes, in all seven interface languages, with keyboard and screen-reader support", ar: "كل ما في الأوضاع يعمل على الهواتف والأجهزة اللوحية والحواسيب، بالسمة الفاتحة والداكنة، وبلغات الواجهة السبع، مع دعم لوحة المفاتيح وقارئ الشاشة" },
          { en: "Mode pages load only when opened, and keep working offline once visited", ar: "صفحات الأوضاع لا تُحمّل إلا عند فتحها، وتعمل دون اتصال بعد زيارتها" },
          { en: "The mosque finder now also shows a mosque's website and phone when OpenStreetMap has them", ar: "صار الباحث عن المساجد يعرض موقع المسجد وهاتفه إن توفّرا في OpenStreetMap" },
        ] },
      ],
    },
    {
      v: "2.9.5", date: "2026-10-06",
      en: "More Stories, and a cleaner app", ar: "قصص أكثر وتطبيق أنظف",
      den: "Eleven new stories beyond the Prophets, a clear Play/Pause to listen to a whole story, and a tidier, less cluttered app.",
      dar: "إحدى عشرة قصة جديدة غير قصص الأنبياء، وزر تشغيل/إيقاف واضح للاستماع إلى القصة كاملة، وتطبيق أكثر ترتيبًا.",
      groups: [
        { en: "Stories", ar: "القصص", items: [
          { en: "11 new stories — now 17 in four groups: the Prophets, Stories from the Qur'an, the Prophet ﷺ and his Companions, and Stories the Prophet ﷺ told", ar: "١١ قصة جديدة — صارت ١٧ في أربع مجموعات: الأنبياء، وقصص من القرآن، والنبي ﷺ وأصحابه، وقصص حدّث بها النبي ﷺ" },
          { en: "New: Maryam, the People of the Cave, Luqman's advice, the Owners of the Garden, the Year of the Elephant, Khadijah, the Hijrah, Bilal, the Three Men in the Cave, Water for a Thirsty Dog, and the Man Who Never Gave Up on Repentance", ar: "جديد: مريم، وأصحاب الكهف، ووصية لقمان، وأصحاب الجنة، وعام الفيل، وخديجة، والهجرة، وبلال، والثلاثة في الغار، وسقيا الكلب، وقاتل المئة" },
          { en: "A big, clear Play / Pause button: listen to a whole story — each ayah is recited and the story moves on by itself", ar: "زر تشغيل/إيقاف كبير وواضح: استمع إلى القصة كاملة — تُتلى كل آية وتنتقل القصة وحدها" },
          { en: "Stories have moved off the Home screen — find them in the menu", ar: "نُقلت القصص من الشاشة الرئيسية — تجدها في القائمة" },
        ] },
        { en: "A cleaner app", ar: "تطبيق أنظف", items: [
          { en: "Removed the MSA preview tab until MSA tools are ready (still planned for a future update)", ar: "أُزيل تبويب معاينة الرابطة حتى تجهز أدواتها (ما زالت مخطّطة لتحديث قادم)" },
          { en: "The “new version is ready” bar only appears when there really is a newer version", ar: "شريط «إصدار جديد جاهز» لا يظهر إلا عند وجود إصدار أحدث فعلًا" },
          { en: "Layout fixes on the Stories page and in the story viewer", ar: "إصلاحات في تخطيط صفحة القصص وعارضها" },
        ] },
      ],
    },
    {
      v: "2.9.0", date: "2026-10-06",
      en: "SalaamStreet Stories", ar: "قصص سلام ستريت",
      den: "Stories of the Prophets in short tap-through slides — told only from the Qur'an and authentic hadith, with the source on every part.",
      dar: "قصص الأنبياء في شرائح قصيرة تتنقّل بينها باللمس — من القرآن والسنة الصحيحة فقط، مع المصدر في كل جزء.",
      items: [
        { en: "New: SalaamStreet Stories — the stories of Adam, Nuh, Ibrahim, Yusuf, Musa and Yunus", ar: "جديد: قصص سلام ستريت — قصص آدم ونوح وإبراهيم ويوسف وموسى ويونس" },
        { en: "Every part shows the Qur'an's own words in Arabic with the translation, straight from the Qur'an reader's source, and you can listen to each ayah", ar: "كل جزء يعرض كلمات القرآن نفسها بالعربية مع الترجمة من مصدر قارئ القرآن مباشرة، ويمكنك الاستماع إلى كل آية" },
        { en: "Each story ends with its lesson, and any part can be shared as an image", ar: "تنتهي كل قصة بعبرتها، ويمكن مشاركة أي جزء كصورة" },
        { en: "“Today”: the Ayah, Name, Dua and Hadith of the day as one short story", ar: "«اليوم»: آية واسم ودعاء وحديث اليوم في قصة قصيرة واحدة" },
        { en: "Story circles at the top of Home; tap or swipe through, and your progress is saved", ar: "دوائر القصص أعلى الرئيسية؛ تنقّل باللمس أو السحب، ويُحفظ تقدّمك" },
      ],
    },
    {
      v: "2.8.0", date: "2026-10-05",
      en: "The SalaamStreet App", ar: "تطبيق سلام ستريت",
      den: "Made for everyone who keeps SalaamStreet on their phone, tablet or computer: smarter reminders, a daily Qur'an goal, prayer times with no internet, and a simpler Qibla.",
      dar: "صُمّم لكل من يبقي سلام ستريت على هاتفه أو جهازه اللوحي أو حاسوبه: تذكيرات أذكى، وهدف يومي للقرآن، ومواقيت صلاة دون إنترنت، وقبلة أبسط.",
      groups: [
        { en: "Prayer", ar: "الصلاة", items: [
          { en: "“Did you pray?” on the Home screen — tick the current prayer with one tap", ar: "«هل صليت؟» في الشاشة الرئيسية — سجّل الصلاة الحالية بلمسة واحدة" },
          { en: "An “I prayed” button on prayer reminders that ticks it for you", ar: "زر «صلّيت» في تذكيرات الصلاة يسجّلها لك" },
          { en: "Prayer times now work with no internet — calculated on your device when you're offline", ar: "مواقيت الصلاة تعمل الآن دون إنترنت — تُحسب على جهازك عند انقطاع الاتصال" },
          { en: "Reminders that arrive even when SalaamStreet is closed (Settings → Prayer reminders, where available)", ar: "تذكيرات تصلك حتى عندما يكون سلام ستريت مغلقًا (الإعدادات ← تذكيرات الصلاة، حيث يتوفر)" },
          { en: "Optional badge on the app icon for prayers not yet ticked today", ar: "شارة اختيارية على أيقونة التطبيق للصلوات غير المسجّلة اليوم" },
        ] },
        { en: "Qur'an & adhkar", ar: "القرآن والأذكار", items: [
          { en: "Set a daily Qur'an goal and watch it fill as you read, with an optional reminder", ar: "حدّد هدفًا يوميًا للقرآن وتابع تقدّمك أثناء القراءة، مع تذكير اختياري" },
          { en: "Morning and evening adhkar reminders", ar: "تذكير بأذكار الصباح والمساء" },
          { en: "Sleep timer for recitation (15, 30 or 60 minutes)", ar: "مؤقّت إيقاف للتلاوة (١٥ أو ٣٠ أو ٦٠ دقيقة)" },
          { en: "The screen stays on while you read, follow adhkar or count dhikr", ar: "تبقى الشاشة مضاءة أثناء القراءة والأذكار والذكر" },
        ] },
        { en: "Your week", ar: "أسبوعك", items: [
          { en: "Every Friday, a short summary of your week: prayers, ayahs read and adhkar", ar: "كل جمعة، ملخّص قصير لأسبوعك: الصلوات والآيات المقروءة والأذكار" },
        ] },
        { en: "Qibla", ar: "القبلة", items: [
          { en: "A simpler Qibla finder: one clear instruction at a time and a big “Start compass” button", ar: "باحث قبلة أبسط: تعليمة واضحة واحدة في كل مرة وزر كبير «تشغيل البوصلة»" },
          { en: "How-to and details folded away until you need them", ar: "طريقة الاستخدام والتفاصيل مطويّة حتى تحتاجها" },
        ] },
        { en: "Fixes", ar: "إصلاحات", items: [
          { en: "Fixed the white launch screen in dark mode on newer iPhones and iPads (iPhone 16 and 17, iPhone Air, iPad mini, iPad Pro) and on iPads held sideways", ar: "إصلاح شاشة البدء البيضاء في الوضع الداكن على أجهزة iPhone وiPad الأحدث (iPhone 16 و17 وiPhone Air وiPad mini وiPad Pro) وعلى iPad بالوضع الأفقي" },
          { en: "When a new version is ready, SalaamStreet asks before updating", ar: "عند توفّر إصدار جديد، يسألك سلام ستريت قبل التحديث" },
        ] },
      ],
    },
    {
      v: "2.7.0", date: "2026-10-05",
      en: "Hadith + Knowledge", ar: "الحديث والمعرفة",
      den: "Ten hadith collections with every grading shown, a new Knowledge tab, and a calmer, less crowded app.",
      dar: "عشر مجموعات حديثية مع ذكر كل درجة، وتبويب جديد للمعرفة، وتطبيق أهدأ وأقل ازدحامًا.",
      groups: [
        { en: "Hadith", ar: "الحديث", items: [
          { en: "Six new collections: Sunan Abu Dawud, Jami' at-Tirmidhi, Sunan an-Nasa'i, Sunan Ibn Majah, Muwatta Malik and the 40 Hadith of Shah Waliullah — ten in all", ar: "ست مجموعات جديدة: سنن أبي داود وجامع الترمذي وسنن النسائي وسنن ابن ماجه وموطأ مالك وأربعون الدهلوي — عشر مجموعات في المجموع" },
          { en: "Jump straight to any book (chapter) of Bukhari, Muslim, the Sunan and the Muwatta, and see which book you're reading", ar: "انتقل مباشرة إلى أي كتاب في البخاري ومسلم والسنن والموطأ، واعرف الكتاب الذي تقرأ فيه" },
          { en: "Every scholar's grading is shown — the first on the card, the rest one tap away — with weak grades clearly marked", ar: "تظهر أحكام العلماء كلها — الأول على البطاقة والبقية بلمسة — مع تمييز الضعيف بوضوح" },
          { en: "Hadith of the day from An-Nawawi's Forty, and each collection now names its compiler", ar: "حديث اليوم من الأربعين النووية، وكل مجموعة تذكر الآن جامعها" },
        ] },
        { en: "Knowledge", ar: "المعرفة", items: [
          { en: "New Knowledge tab: the five pillars of Islam, the six articles of faith and ihsan, each with its source", ar: "تبويب جديد للمعرفة: أركان الإسلام الخمسة وأركان الإيمان الستة والإحسان، مع مصدر كل منها" },
          { en: "Understanding hadith: short explanations of sahih, hasan, da'if, isnad and the other terms you see in gradings", ar: "فهم الحديث: شرح موجز للصحيح والحسن والضعيف والإسناد وغيرها من المصطلحات التي تراها في الأحكام" },
        ] },
        { en: "A calmer app", ar: "تطبيق أهدأ", items: [
          { en: "Hadith collections are now short, grouped lists instead of big cards", ar: "مجموعات الحديث أصبحت قوائم قصيرة مجمّعة بدل البطاقات الكبيرة" },
          { en: "Home: your shortcuts (prayers today, adhkar, Qur'an, dhikr streak) sit together in one card", ar: "الرئيسية: اختصاراتك (صلوات اليوم والأذكار والقرآن وسلسلة الذكر) في بطاقة واحدة" },
          { en: "Settings is much shorter: Offline Qur'an has its own page, one tap away", ar: "الإعدادات أقصر بكثير: للقرآن دون اتصال صفحة خاصة على بُعد لمسة" },
        ] },
      ],
    },
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
    { v: "3.2.0", icon: "user", en: "Personalization", ar: "التخصيص",
      den: "A Home screen you arrange yourself: dashboard cards, favourite tools and shortcuts, more notification choices and better mode suggestions.",
      dar: "شاشة رئيسية ترتّبها بنفسك: بطاقات وأدوات مفضلة واختصارات، وخيارات أكثر للتنبيهات، واقتراحات أفضل للأوضاع." },
    { v: "3.3.0", icon: "book", en: "Qur'an Experience", ar: "تجربة القرآن",
      den: "A more cohesive reader: reading history, more translations side by side, better audio and repeat controls, and memorization progress.",
      dar: "قارئ أكثر تكاملًا: سجل القراءة، وترجمات أكثر جنبًا إلى جنب، وتحكم أفضل بالصوت والتكرار، وتتبع الحفظ." },
    { v: "3.4.0", icon: "mosque", en: "Community: mosque pages", ar: "المجتمع: صفحات المساجد",
      den: "Mosque pages with verified Jumu'ah and iqamah times, events and announcements, built on the NVHS MSA page — and shown in Mosque Mode.",
      dar: "صفحات للمساجد بأوقات جمعة وإقامة وفعاليات وإعلانات موثقة، مبنية على صفحة رابطة NVHS — وتظهر في وضع المسجد." },
    { v: "3.5.0", icon: "open-book", en: "Islamic Learning", ar: "التعلّم الإسلامي",
      den: "Organized learning paths with lessons, quizzes and flashcards — Seerah, history and hadith — shared with Kids Mode.",
      dar: "مسارات تعلّم منظّمة بدروس واختبارات وبطاقات — السيرة والتاريخ والحديث — مشتركة مع وضع الأطفال." },
    { v: "3.6.0", icon: "moon", en: "Ramadan Experience", ar: "تجربة رمضان",
      den: "A fuller Ramadan dashboard: suhoor and iftar, fasting tracker, Qur'an goals, Laylat al-Qadr and an Eid countdown — a seasonal feature, not another mode.",
      dar: "لوحة رمضان أشمل: السحور والإفطار، ومتابعة الصيام، وأهداف القرآن، وليلة القدر، والعد التنازلي للعيد — ميزة موسمية لا وضعًا آخر." },
    { v: "3.7.0", icon: "compass", en: "Advanced Islamic Tools", ar: "أدوات إسلامية متقدمة",
      den: "A Hijri date converter, a zakat calculator, better tool search and more that works offline — with every assumption explained.",
      dar: "محوّل التاريخ الهجري، وحاسبة الزكاة، وبحث أفضل في الأدوات، والمزيد مما يعمل دون اتصال — مع شرح كل افتراض." },
    { v: "3.8.0", icon: "users", en: "Family Ecosystem", ar: "منظومة العائلة",
      den: "Building on Kids Mode: shared family learning goals, better progress summaries and family-friendly Ramadan tools.",
      dar: "امتداد لوضع الأطفال: أهداف تعلّم عائلية مشتركة، وملخصات تقدّم أفضل، وأدوات رمضان مناسبة للعائلة." },
    { v: "3.9.0", icon: "bell", en: "Notifications", ar: "التنبيهات",
      den: "Useful, configurable reminders — Jumu'ah, Qur'an, learning, MSA and mosque announcements — with custom schedules and no spam.",
      dar: "تذكيرات مفيدة قابلة للضبط — الجمعة والقرآن والتعلّم وإعلانات الرابطة والمساجد — بجداول مخصصة ودون إزعاج." },
    { v: "3.10.0", icon: "sparkle", en: "Performance, Security & Polish", ar: "الأداء والأمان والتحسين",
      den: "Faster loading, better offline support, an accessibility and security review, and bug fixes.",
      dar: "تحميل أسرع، ودعم أفضل دون اتصال، ومراجعة لإمكانية الوصول والأمان، وإصلاح الأخطاء." },
  ];
})();
