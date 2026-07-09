/* SalaamStreet — extras.js (classic script)
   Static reference data: Islamic calendar events, hadith collections, and the
   premium feature list. Exposed on window.SS. */
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

  /* Hadith collections available on the fawazahmed0 hadith-api.
     The two "40 Hadith" collections are bounded and famous — ideal for a
     curated library. The large canonical books are offered for browsing by
     number. `bounded` collections are loaded whole; others fetched per number. */
  SS.HADITH_COLLECTIONS = [
    { id: "nawawi", en: "40 Hadith Nawawi", ar: "الأربعون النووية", eng: "eng-nawawi", ara: "ara-nawawi", bounded: true, cite: "Nawawi's Forty Hadith" },
    { id: "qudsi", en: "40 Hadith Qudsi", ar: "الأربعون القدسية", eng: "eng-qudsi", ara: "ara-qudsi", bounded: true, cite: "Forty Hadith Qudsi" },
    { id: "bukhari", en: "Sahih al-Bukhari", ar: "صحيح البخاري", eng: "eng-bukhari", ara: "ara-bukhari", bounded: false, cite: "Sahih al-Bukhari" },
    { id: "muslim", en: "Sahih Muslim", ar: "صحيح مسلم", eng: "eng-muslim", ara: "ara-muslim", bounded: false, cite: "Sahih Muslim" },
  ];

  /* Premium feature list (for the pricing/upgrade pages). `live` marks what is
     actually unlockable today; the rest are clearly labeled as planned so we
     never overpromise. */
  SS.PREMIUM_FEATURES = [
    { icon: "🎨", en: "Premium themes", ar: "ثيمات مميزة", live: true },
    { icon: "🗂️", en: "Collections (organize bookmarks)", ar: "المجموعات (تنظيم الإشارات)", live: true },
    { icon: "📝", en: "Unlimited notes on ayat", ar: "ملاحظات غير محدودة على الآيات", live: true },
    { icon: "📊", en: "Premium dashboard & analytics", ar: "لوحة تحكم وتحليلات مميزة", live: true },
    { icon: "🅰️", en: "Quranic Arabic course", ar: "دورة العربية القرآنية", live: false },
    { icon: "🗣️", en: "Modern Standard Arabic course", ar: "دورة العربية الفصحى الحديثة", live: false },
    { icon: "🤖", en: "AI Arabic tutor", ar: "مدرّس عربية بالذكاء الاصطناعي", live: false },
    { icon: "🧠", en: "Memorization planner", ar: "مخطط الحفظ", live: false },
    { icon: "📐", en: "Grammar lessons", ar: "دروس النحو", live: false },
    { icon: "🃏", en: "Flashcards", ar: "بطاقات تعليمية", live: false },
    { icon: "❓", en: "Quizzes", ar: "اختبارات", live: false },
    { icon: "📅", en: "Study planner", ar: "مخطط الدراسة", live: false },
  ];
})();
