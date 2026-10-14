/* SalaamStreet — extras.js (classic script)
   Static reference data: Islamic calendar events, hadith collections and knowledge. Exposed on window.SS. */
(function () {
  "use strict";
  window.SS = window.SS || {};

  /* Key Islamic dates by fixed Hijri month/day. Gregorian dates vary with
     moon-sighting and method, so we present the Hijri date and note the
     difference of practice where relevant. Never presented as the only view. */
  SS.ISLAMIC_EVENTS = [
    { month: 1, day: 1, en: "Islamic New Year", ar: "رأس السنة الهجرية", note: "" },
    { month: 1, day: 10, en: "Day of Ashura", ar: "يوم عاشوراء", note: "Recommended fast (Sahih Muslim 1134)." },
    { month: 3, day: 12, en: "Mawlid an-Nabi", ar: "المولد النبوي", note: "Observance differs among scholars." },
    { month: 7, day: 27, en: "Isra & Mi'raj", ar: "الإسراء والمعراج", note: "Date and observance differ among scholars." },
    { month: 8, day: 15, en: "Mid-Sha'ban", ar: "ليلة النصف من شعبان", note: "Observance differs among scholars." },
    { month: 9, day: 1, en: "Start of Ramadan", ar: "بداية رمضان", note: "Subject to moon-sighting." },
    { month: 9, day: 27, en: "Laylat al-Qadr (sought)", ar: "ليلة القدر", note: "Sought in the last ten nights (Sahih al-Bukhari 2017)." },
    { month: 10, day: 1, en: "Eid al-Fitr", ar: "عيد الفطر", note: "Subject to moon-sighting." },
    { month: 12, day: 9, en: "Day of Arafah", ar: "يوم عرفة", note: "Recommended fast for non-pilgrims (Sahih Muslim 1162)." },
    { month: 12, day: 10, en: "Eid al-Adha", ar: "عيد الأضحى", note: "" },
  ];

  /* Hadith collections available on the fawazahmed0 hadith-api, in the
     order the library shows them. `bounded` collections (the forties) are
     loaded whole; the large books are browsed by number, with a book index
     from js/hadith-books.js. `last` is the highest hadith number; `mixed`
     marks books whose hadith carry different gradings (shown on each one).
     Compiler death years are Hijri (AH). */
  SS.HADITH_GROUPS = [
    { id: "forty", key: "hadith.groupForty" },
    { id: "six", key: "hadith.groupSix" },
    { id: "more", key: "hadith.groupMore" },
  ];
  SS.HADITH_COLLECTIONS = [
    { id: "nawawi", group: "forty", en: "40 Hadith Nawawi", ar: "الأربعون النووية", eng: "eng-nawawi", ara: "ara-nawawi", bounded: true, last: 42, cite: "Nawawi's Forty Hadith",
      by: { en: "Imam an-Nawawi", ar: "الإمام النووي", d: 676 } },
    { id: "qudsi", group: "forty", en: "40 Hadith Qudsi", ar: "الأربعون القدسية", eng: "eng-qudsi", ara: "ara-qudsi", bounded: true, last: 40, cite: "Forty Hadith Qudsi" },
    { id: "dehlawi", group: "forty", en: "40 Hadith Shah Waliullah", ar: "أربعون الدهلوي", eng: "eng-dehlawi", ara: "ara-dehlawi", bounded: true, last: 40, cite: "Forty Hadith of Shah Waliullah Dehlawi",
      by: { en: "Shah Waliullah Dehlawi", ar: "شاه ولي الله الدهلوي", d: 1176 } },
    { id: "bukhari", group: "six", en: "Sahih al-Bukhari", ar: "صحيح البخاري", eng: "eng-bukhari", ara: "ara-bukhari", bounded: false, last: 7563, cite: "Sahih al-Bukhari",
      by: { en: "Imam al-Bukhari", ar: "الإمام البخاري", d: 256 } },
    { id: "muslim", group: "six", en: "Sahih Muslim", ar: "صحيح مسلم", eng: "eng-muslim", ara: "ara-muslim", bounded: false, last: 7563, cite: "Sahih Muslim",
      by: { en: "Imam Muslim", ar: "الإمام مسلم", d: 261 } },
    { id: "abudawud", group: "six", en: "Sunan Abu Dawud", ar: "سنن أبي داود", eng: "eng-abudawud", ara: "ara-abudawud", bounded: false, last: 5274, mixed: true, cite: "Sunan Abu Dawud",
      by: { en: "Imam Abu Dawud", ar: "الإمام أبو داود", d: 275 } },
    { id: "tirmidhi", group: "six", en: "Jami' at-Tirmidhi", ar: "جامع الترمذي", eng: "eng-tirmidhi", ara: "ara-tirmidhi", bounded: false, last: 3956, mixed: true, cite: "Jami' at-Tirmidhi",
      by: { en: "Imam at-Tirmidhi", ar: "الإمام الترمذي", d: 279 } },
    { id: "nasai", group: "six", en: "Sunan an-Nasa'i", ar: "سنن النسائي", eng: "eng-nasai", ara: "ara-nasai", bounded: false, last: 5758, mixed: true, cite: "Sunan an-Nasa'i",
      by: { en: "Imam an-Nasa'i", ar: "الإمام النسائي", d: 303 } },
    { id: "ibnmajah", group: "six", en: "Sunan Ibn Majah", ar: "سنن ابن ماجه", eng: "eng-ibnmajah", ara: "ara-ibnmajah", bounded: false, last: 4341, mixed: true, cite: "Sunan Ibn Majah",
      by: { en: "Imam Ibn Majah", ar: "الإمام ابن ماجه", d: 273 } },
    { id: "malik", group: "more", en: "Muwatta Malik", ar: "موطأ مالك", eng: "eng-malik", ara: "ara-malik", bounded: false, last: 1858, mixed: true, cite: "Muwatta Malik",
      by: { en: "Imam Malik", ar: "الإمام مالك", d: 179 } },
  ];

  /* Knowledge: short, sourced foundations and the terms used in hadith
     gradings. Standard definitions from the sciences of hadith (mustalah);
     nothing here is a ruling. `link` opens the hadith in the library. */
  SS.KNOWLEDGE = {
    foundations: [
      { id: "islam", en: "Islam — the five pillars", ar: "الإسلام — الأركان الخمسة",
        items: [
          { en: "The testimony that there is no god but Allah and that Muhammad is the Messenger of Allah", ar: "شهادة أن لا إله إلا الله وأن محمدًا رسول الله" },
          { en: "Establishing the prayer", ar: "إقام الصلاة" },
          { en: "Giving zakah", ar: "إيتاء الزكاة" },
          { en: "Fasting in Ramadan", ar: "صوم رمضان" },
          { en: "Hajj to the House, for whoever is able", ar: "حج البيت لمن استطاع إليه سبيلًا" },
        ],
        src: "Sahih al-Bukhari 8 · Sahih Muslim 16", link: "#/hadith/bukhari/8" },
      { id: "iman", en: "Iman — the six articles of faith", ar: "الإيمان — الأركان الستة",
        items: [
          { en: "Belief in Allah", ar: "الإيمان بالله" },
          { en: "His angels", ar: "وملائكته" },
          { en: "His books", ar: "وكتبه" },
          { en: "His messengers", ar: "ورسله" },
          { en: "The Last Day", ar: "واليوم الآخر" },
          { en: "Divine decree (qadar), its good and its bad", ar: "والقدر خيره وشره" },
        ],
        src: "Sahih Muslim 8 · 40 Hadith Nawawi 2", link: "#/hadith/nawawi/2" },
      { id: "ihsan", en: "Ihsan — excellence", ar: "الإحسان",
        text: { en: "To worship Allah as though you see Him; and if you do not see Him, He surely sees you.", ar: "أن تعبد الله كأنك تراه، فإن لم تكن تراه فإنه يراك." },
        src: "Sahih Muslim 8 · 40 Hadith Nawawi 2", link: "#/hadith/nawawi/2" },
    ],
    terms: [
      { term: "Hadith", ar: "حديث", en: "A report of what the Prophet ﷺ said, did or approved.", dar: "ما أُضيف إلى النبي ﷺ من قول أو فعل أو تقرير." },
      { term: "Isnad", ar: "إسناد", en: "The chain of narrators who passed a hadith on, one to the next.", dar: "سلسلة الرواة الذين نقلوا الحديث بعضهم عن بعض." },
      { term: "Matn", ar: "متن", en: "The words of the hadith itself, after the chain.", dar: "نص الحديث نفسه بعد الإسناد." },
      { term: "Sahih", ar: "صحيح", en: "Authentic: a connected chain of trustworthy, precise narrators, free of irregularity and hidden defects.", dar: "ما اتصل سنده بنقل العدل الضابط عن مثله من غير شذوذ ولا علة." },
      { term: "Hasan", ar: "حسن", en: "Good: like sahih, but a narrator's precision is slightly lower. It is accepted as evidence.", dar: "كالصحيح لكن خفّ ضبط أحد رواته، وهو مقبول يُحتج به." },
      { term: "Da'if", ar: "ضعيف", en: "Weak: one of the conditions of acceptance is missing, so it is not used to establish rulings.", dar: "ما فقد شرطًا من شروط القبول، فلا تُثبت به الأحكام." },
      { term: "Mawdu'", ar: "موضوع", en: "Fabricated: falsely attributed to the Prophet ﷺ. It may only be mentioned to warn against it.", dar: "المكذوب على النبي ﷺ، ولا تجوز روايته إلا مع بيان حاله." },
      { term: "Marfu'", ar: "مرفوع", en: "Attributed to the Prophet ﷺ himself.", dar: "ما أُضيف إلى النبي ﷺ." },
      { term: "Mawquf", ar: "موقوف", en: "The words or deeds of a Companion, not attributed to the Prophet ﷺ.", dar: "ما أُضيف إلى الصحابي من قول أو فعل." },
      { term: "Mutawatir", ar: "متواتر", en: "Narrated by so many people at every stage that they could not have agreed on an error.", dar: "ما رواه جمع كثير في كل طبقة يستحيل تواطؤهم على الكذب." },
      { term: "Hadith Qudsi", ar: "حديث قدسي", en: "The Prophet ﷺ relates the meaning from Allah in his own words. It is not part of the Qur'an.", dar: "ما ينقله النبي ﷺ عن ربه، وليس من القرآن." },
    ],
  };

})();
