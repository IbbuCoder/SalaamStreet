/* SalaamStreet — modes/kids.js (classic script, loaded on demand)
   3.0 Kids Mode and the parent's Family area.

   #/family  (parent, signed in with their normal account)
     add/edit/remove children, choose what each child can use, see each
     child's progress and achievements, pair a child's own device with a
     one-time code, or start Kids Mode on this device.
   #/kids    (child)
     Learn (prayer, wudu) · Read (short surahs) · Listen (stories) ·
     Practice (quizzes, flashcards) · Explore (Names of Allah, manners,
     history, pillars) · Duas · Today · Progress and achievements.

   Security (see backend/supabase-schema.sql, "3.0 — Family & Kids Mode"):
   a child's device only holds a device token for that child; every read and
   write goes through kid_* functions that are limited to that one child and
   enforce the parent's restrictions. Starting Kids Mode on the parent's own
   device signs the parent out of it first, so the child never has the
   parent's session. Leaving Kids Mode needs the grown-up PIN (a salted
   PBKDF2 hash kept on this device) or the parent's own sign-in.

   Content: Qur'an text is loaded from the app's Qur'an source (never typed
   here); duas come from the app's sourced dua library; stories from the
   app's Qur'an/hadith-only stories; every lesson cites its source. */
(function () {
  "use strict";
  var M = SS.modes, L = M.L;
  var $ = function (id) { return document.getElementById(id); };
  function t(k) { return SS.i18n.t(k); }
  function f(k, v) { return SS.ui.f(k, v); }
  function esc(s) { return SS.esc(s); }
  function icon(n, c) { return SS.ui.icon(n, c); }
  function isAr() { return SS.i18n.isAr(); }

  var SECTIONS = ["prayer", "quran", "duas", "stories", "learn", "quiz"];
  var AVATARS = { star: "⭐", moon: "🌙", sun: "☀️", tree: "🌳", flower: "🌸", book: "📘", camel: "🐪", bird: "🐦", fish: "🐟", leaf: "🍃" };
  var AGES = ["4-6", "7-9", "10-12"];
  var ACH = [
    { code: "first_dua", emoji: "🤲" }, { code: "first_quiz", emoji: "✅" }, { code: "first_surah", emoji: "📖" },
    { code: "first_story", emoji: "🌙" }, { code: "prayer_basics", emoji: "🕌" }, { code: "wudu_basics", emoji: "💧" },
    { code: "five_lessons", emoji: "⭐" },
  ];

  /* ═══════════ Content ═══════════ */
  var LESSONS = [
    { id: "names", emoji: "🕌", title: { en: "The five daily prayers", ar: "الصلوات الخمس" },
      intro: { en: "Allah asks us to pray five times every day. Each prayer has its own time.", ar: "أمرنا الله أن نصلي خمس مرات كل يوم، ولكل صلاة وقتها." },
      points: [
        { en: "Fajr — at dawn, before the sun rises", ar: "الفجر — عند الفجر قبل شروق الشمس" },
        { en: "Dhuhr — just after midday", ar: "الظهر — بعد منتصف النهار" },
        { en: "Asr — in the afternoon", ar: "العصر — بعد الظهر" },
        { en: "Maghrib — just after sunset", ar: "المغرب — بعد غروب الشمس" },
        { en: "Isha — at night", ar: "العشاء — في الليل" },
      ],
      src: { en: "Five daily prayers: Sahih al-Bukhari 349 · “Prayer is prescribed at set times” — Qur'an 4:103", ar: "الصلوات الخمس: صحيح البخاري ٣٤٩ · ﴿إِنَّ الصَّلَاةَ كَانَتْ عَلَى الْمُؤْمِنِينَ كِتَابًا مَوْقُوتًا﴾ النساء ١٠٣" } },
    { id: "rakahs", emoji: "🔢", title: { en: "How many rak'ahs?", ar: "كم ركعة؟" },
      intro: { en: "A rak'ah is one round of standing, bowing and prostrating. Each prayer has a set number.", ar: "الركعة: قيام وركوع وسجود. ولكل صلاة عدد من الركعات." },
      points: [
        { en: "Fajr — 2 rak'ahs", ar: "الفجر — ركعتان" },
        { en: "Dhuhr — 4 rak'ahs", ar: "الظهر — أربع ركعات" },
        { en: "Asr — 4 rak'ahs", ar: "العصر — أربع ركعات" },
        { en: "Maghrib — 3 rak'ahs", ar: "المغرب — ثلاث ركعات" },
        { en: "Isha — 4 rak'ahs", ar: "العشاء — أربع ركعات" },
        { en: "That makes 17 rak'ahs every day!", ar: "المجموع سبع عشرة ركعة كل يوم!" },
      ],
      src: { en: "As the Prophet ﷺ prayed and all Muslims pray; see Sahih al-Bukhari 350", ar: "كما صلّى النبي ﷺ وأجمع عليه المسلمون؛ انظر صحيح البخاري ٣٥٠" } },
    { id: "wudu", emoji: "💧", title: { en: "Wudu: getting ready to pray", ar: "الوضوء: الاستعداد للصلاة" },
      intro: { en: "Before we pray, we make wudu — we wash in a special order. Put the steps in the right order!", ar: "قبل الصلاة نتوضأ، فنغسل أعضاءنا بترتيب خاص. رتّب الخطوات!" },
      steps: [
        { en: "Make the intention and say Bismillah", ar: "انوِ الوضوء وقل: بسم الله" },
        { en: "Wash your hands three times", ar: "اغسل يديك ثلاثًا" },
        { en: "Rinse your mouth", ar: "تمضمض" },
        { en: "Rinse your nose", ar: "استنشق واستنثر" },
        { en: "Wash your face", ar: "اغسل وجهك" },
        { en: "Wash your arms up to the elbows — right first", ar: "اغسل يديك إلى المرفقين — اليمنى أولًا" },
        { en: "Wipe over your head and ears", ar: "امسح رأسك وأذنيك" },
        { en: "Wash your feet up to the ankles — right first", ar: "اغسل رجليك إلى الكعبين — اليمنى أولًا" },
      ],
      src: { en: "Qur'an 5:6 · Sahih al-Bukhari 159 ('Uthman showing the Prophet's ﷺ wudu)", ar: "المائدة ٦ · صحيح البخاري ١٥٩ (وضوء عثمان كوضوء النبي ﷺ)" } },
    { id: "steps", emoji: "🧎", title: { en: "How to pray", ar: "كيف أصلي؟" },
      intro: { en: "The Prophet ﷺ said: “Pray as you have seen me praying.” Put the steps of one rak'ah in order!", ar: "قال النبي ﷺ: «صلوا كما رأيتموني أصلي». رتّب خطوات الركعة!" },
      steps: [
        { en: "Face the Qibla and say “Allahu Akbar”", ar: "استقبل القبلة وقل: الله أكبر" },
        { en: "Stand and recite al-Fatihah", ar: "قف واقرأ الفاتحة" },
        { en: "Bow (ruku'): “Subhana Rabbiyal-'Azim”", ar: "اركع وقل: سبحان ربي العظيم" },
        { en: "Stand up straight again", ar: "ارفع واعتدل قائمًا" },
        { en: "Prostrate (sujud): “Subhana Rabbiyal-A'la”", ar: "اسجد وقل: سبحان ربي الأعلى" },
        { en: "Sit up for a moment", ar: "اجلس قليلًا" },
        { en: "Prostrate a second time", ar: "اسجد السجدة الثانية" },
      ],
      after: { en: "At the end of the prayer, sit, recite the tashahhud and finish with “As-salamu 'alaykum wa rahmatullah” to the right and then the left. Some small details differ between schools — learn them with your family or teacher.", ar: "وفي آخر الصلاة تجلس للتشهد ثم تسلّم: «السلام عليكم ورحمة الله» عن يمينك ثم عن يسارك. وبعض التفاصيل الصغيرة تختلف بين المذاهب، فتعلّمها مع أهلك أو معلّمك." },
      src: { en: "Sahih al-Bukhari 631, 757 · Sahih Muslim 397", ar: "صحيح البخاري ٦٣١، ٧٥٧ · صحيح مسلم ٣٩٧" } },
  ];
  var SURAHS_K = [1, 112, 113, 114, 108, 103, 110, 105, 106, 107, 109];
  var DUA_IDS = ["before-eating", "after-eating", "sleep-bismika", "wake-alhamdu", "leaving-home", "entering-mosque", "travel-mount", "rabbi-zidni", "rabbi-irhamhuma", "rabbana-dunya"];
  var DUA_TITLES = {
    "before-eating": { en: "Before eating", ar: "قبل الطعام" }, "after-eating": { en: "After eating", ar: "بعد الطعام" },
    "sleep-bismika": { en: "Before sleeping", ar: "قبل النوم" }, "wake-alhamdu": { en: "When I wake up", ar: "عند الاستيقاظ" },
    "leaving-home": { en: "Leaving home", ar: "الخروج من البيت" }, "entering-mosque": { en: "Going into the mosque", ar: "دخول المسجد" },
    "travel-mount": { en: "When we travel", ar: "عند السفر" }, "rabbi-zidni": { en: "To learn more", ar: "لزيادة العلم" },
    "rabbi-irhamhuma": { en: "For my parents", ar: "للوالدين" }, "rabbana-dunya": { en: "For good in both worlds", ar: "لخير الدنيا والآخرة" },
  };
  // Stories by age: gentler stories for the youngest; all of them from 10.
  var STORY_AGE = {
    "4-6": ["adam", "nuh", "ibrahim", "yusuf", "musa", "yunus", "elephant", "thirsty-dog"],
    "7-9": ["adam", "nuh", "ibrahim", "yusuf", "musa", "yunus", "elephant", "thirsty-dog", "maryam", "cave", "luqman", "garden", "khadijah", "hijrah", "bilal", "three-cave"],
  };
  var LEARN = [
    { id: "names", emoji: "✨", title: { en: "Names of Allah", ar: "أسماء الله الحسنى" }, kind: "names" },
    { id: "manners", emoji: "🤝", title: { en: "Good manners", ar: "الآداب الإسلامية" }, kind: "list", items: [
      { en: "Say Bismillah and eat with your right hand.", ar: "سمِّ الله وكُل بيمينك.", src: { en: "Sahih al-Bukhari 5376", ar: "صحيح البخاري ٥٣٧٦" } },
      { en: "Greet people with “As-salamu 'alaykum”.", ar: "ألقِ السلام: «السلام عليكم».", src: { en: "Sahih Muslim 54", ar: "صحيح مسلم ٥٤" } },
      { en: "Smiling at others is a charity.", ar: "تبسّمك في وجه أخيك صدقة.", src: { en: "At-Tirmidhi 1956 — graded hasan", ar: "الترمذي ١٩٥٦ — حسن" } },
      { en: "Be kind and gentle to your parents.", ar: "أحسن إلى والديك وكن لطيفًا معهما.", src: { en: "Qur'an 17:23–24", ar: "الإسراء ٢٣–٢٤" } },
      { en: "Always tell the truth.", ar: "قل الصدق دائمًا.", src: { en: "Sahih al-Bukhari 6094", ar: "صحيح البخاري ٦٠٩٤" } },
      { en: "When you sneeze, say “Alhamdulillah”.", ar: "إذا عطست فقل: الحمد لله.", src: { en: "Sahih al-Bukhari 6224", ar: "صحيح البخاري ٦٢٢٤" } },
    ] },
    { id: "pillars", emoji: "🏛️", title: { en: "The five pillars of Islam", ar: "أركان الإسلام الخمسة" }, kind: "knowledge", k: "islam" },
    { id: "iman", emoji: "💚", title: { en: "What Muslims believe", ar: "أركان الإيمان" }, kind: "knowledge", k: "iman" },
    { id: "history", emoji: "📜", title: { en: "Islamic history", ar: "من التاريخ الإسلامي" }, kind: "list", items: [
      { en: "The Prophet Muhammad ﷺ was born in Makkah, around the year 570.", ar: "وُلد النبي محمد ﷺ في مكة نحو سنة ٥٧٠م.", src: { en: "Seerah (the Prophet's biography)", ar: "السيرة النبوية" } },
      { en: "When he was forty, the angel Jibril brought the first words of the Qur'an in the cave of Hira: “Read!”", ar: "ولما بلغ الأربعين نزل عليه جبريل بأول ما نزل من القرآن في غار حراء: ﴿اقْرَأْ﴾.", src: { en: "Qur'an 96:1–5 · Sahih al-Bukhari 3", ar: "العلق ١–٥ · صحيح البخاري ٣" } },
      { en: "In 622 he moved from Makkah to Madinah — the Hijrah. The Islamic calendar starts from that year.", ar: "وفي سنة ٦٢٢م هاجر من مكة إلى المدينة، ومن تلك السنة يبدأ التقويم الهجري.", src: { en: "Sahih al-Bukhari 3905", ar: "صحيح البخاري ٣٩٠٥" } },
      { en: "In Madinah the Muslims built the Prophet's Mosque together.", ar: "وفي المدينة بنى المسلمون المسجد النبوي معًا.", src: { en: "Sahih al-Bukhari 428", ar: "صحيح البخاري ٤٢٨" } },
      { en: "Years later the Muslims returned to Makkah, and the Prophet ﷺ cleared the Ka'bah of idols.", ar: "وبعد سنوات فتح المسلمون مكة، وطهّر النبي ﷺ الكعبة من الأصنام.", src: { en: "Sahih al-Bukhari 4287", ar: "صحيح البخاري ٤٢٨٧" } },
    ] },
  ];
  var QUIZZES = [
    { id: "prayer", emoji: "🕌", title: { en: "Prayer quiz", ar: "اختبار الصلاة" }, qs: [
      { q: { en: "How many prayers do we pray every day?", ar: "كم صلاة نصلي كل يوم؟" }, a: [{ en: "5", ar: "٥" }, { en: "3", ar: "٣" }, { en: "7", ar: "٧" }], c: 0 },
      { q: { en: "Which prayer is just after sunset?", ar: "أي صلاة تكون بعد غروب الشمس؟" }, a: [{ en: "Fajr", ar: "الفجر" }, { en: "Maghrib", ar: "المغرب" }, { en: "Isha", ar: "العشاء" }], c: 1 },
      { q: { en: "How many rak'ahs does Fajr have?", ar: "كم ركعة في صلاة الفجر؟" }, a: [{ en: "4", ar: "٤" }, { en: "3", ar: "٣" }, { en: "2", ar: "٢" }], c: 2 },
      { q: { en: "Which way do we face when we pray?", ar: "إلى أين نتجه في الصلاة؟" }, a: [{ en: "Towards the Ka'bah in Makkah (the Qibla)", ar: "إلى الكعبة في مكة (القبلة)" }, { en: "Towards the sun", ar: "إلى الشمس" }, { en: "Any way we like", ar: "إلى أي جهة" }], c: 0 },
      { q: { en: "What do we say to start the prayer?", ar: "ماذا نقول لنبدأ الصلاة؟" }, a: [{ en: "Ameen", ar: "آمين" }, { en: "Allahu Akbar", ar: "الله أكبر" }, { en: "Alhamdulillah", ar: "الحمد لله" }], c: 1 },
      { q: { en: "How many rak'ahs does Maghrib have?", ar: "كم ركعة في صلاة المغرب؟" }, a: [{ en: "2", ar: "٢" }, { en: "3", ar: "٣" }, { en: "4", ar: "٤" }], c: 1 },
    ] },
    { id: "wudu", emoji: "💧", title: { en: "Wudu quiz", ar: "اختبار الوضوء" }, qs: [
      { q: { en: "What do we wash first in wudu?", ar: "ماذا نغسل أولًا في الوضوء؟" }, a: [{ en: "Our feet", ar: "الرجلين" }, { en: "Our hands", ar: "اليدين" }, { en: "Our face", ar: "الوجه" }], c: 1 },
      { q: { en: "Which one do we wipe instead of wash?", ar: "أيها نمسحه ولا نغسله؟" }, a: [{ en: "Our head", ar: "الرأس" }, { en: "Our face", ar: "الوجه" }, { en: "Our arms", ar: "اليدين" }], c: 0 },
      { q: { en: "We wash our arms up to the…", ar: "نغسل اليدين إلى…" }, a: [{ en: "wrists", ar: "الرسغين" }, { en: "shoulders", ar: "الكتفين" }, { en: "elbows", ar: "المرفقين" }], c: 2 },
      { q: { en: "What do we wash last?", ar: "ماذا نغسل في آخر الوضوء؟" }, a: [{ en: "Our feet", ar: "الرجلين" }, { en: "Our face", ar: "الوجه" }, { en: "Our hands", ar: "اليدين" }], c: 0 },
    ] },
    { id: "duas", emoji: "🤲", title: { en: "Duas quiz", ar: "اختبار الأدعية" }, qs: [
      { q: { en: "What do we say before eating?", ar: "ماذا نقول قبل الأكل؟" }, a: [{ en: "Bismillah", ar: "بسم الله" }, { en: "SubhanAllah", ar: "سبحان الله" }, { en: "Astaghfirullah", ar: "أستغفر الله" }], c: 0 },
      { q: { en: "After eating we thank Allah by saying…", ar: "بعد الأكل نشكر الله فنقول…" }, a: [{ en: "Allahu Akbar", ar: "الله أكبر" }, { en: "Alhamdulillah", ar: "الحمد لله" }, { en: "Bismillah", ar: "بسم الله" }], c: 1 },
      { q: { en: "“Rabbi zidni 'ilma” asks Allah for more…", ar: "«رب زدني علمًا» نطلب فيها المزيد من…" }, a: [{ en: "toys", ar: "الألعاب" }, { en: "food", ar: "الطعام" }, { en: "knowledge", ar: "العلم" }], c: 2 },
      { q: { en: "When do we say “Bismika Allahumma amutu wa ahya”?", ar: "متى نقول «باسمك اللهم أموت وأحيا»؟" }, a: [{ en: "Before sleeping", ar: "قبل النوم" }, { en: "Before eating", ar: "قبل الأكل" }, { en: "Going into the mosque", ar: "عند دخول المسجد" }], c: 0 },
    ] },
    { id: "quran", emoji: "📖", title: { en: "Qur'an quiz", ar: "اختبار القرآن" }, qs: [
      { q: { en: "Which surah comes first in the Qur'an?", ar: "ما أول سورة في المصحف؟" }, a: [{ en: "Al-Ikhlas", ar: "الإخلاص" }, { en: "Al-Fatihah", ar: "الفاتحة" }, { en: "An-Nas", ar: "الناس" }], c: 1 },
      { q: { en: "How many surahs are in the Qur'an?", ar: "كم عدد سور القرآن؟" }, a: [{ en: "114", ar: "١١٤" }, { en: "30", ar: "٣٠" }, { en: "99", ar: "٩٩" }], c: 0 },
      { q: { en: "Surah Al-Ikhlas teaches us that Allah is…", ar: "تعلّمنا سورة الإخلاص أن الله…" }, a: [{ en: "One", ar: "أحد" }, { en: "two", ar: "اثنان" }, { en: "many", ar: "كثيرون" }], c: 0 },
      { q: { en: "Which surah is the last in the Qur'an?", ar: "ما آخر سورة في المصحف؟" }, a: [{ en: "Al-Baqarah", ar: "البقرة" }, { en: "Al-Fatihah", ar: "الفاتحة" }, { en: "An-Nas", ar: "الناس" }], c: 2 },
      { q: { en: "In which month did the Qur'an begin to come down?", ar: "في أي شهر بدأ نزول القرآن؟" }, a: [{ en: "Ramadan", ar: "رمضان" }, { en: "Muharram", ar: "محرم" }, { en: "Shawwal", ar: "شوال" }], c: 0 },
    ] },
    { id: "pillars", emoji: "🏛️", title: { en: "Pillars quiz", ar: "اختبار الأركان" }, qs: [
      { q: { en: "How many pillars of Islam are there?", ar: "كم عدد أركان الإسلام؟" }, a: [{ en: "3", ar: "٣" }, { en: "5", ar: "٥" }, { en: "6", ar: "٦" }], c: 1 },
      { q: { en: "Which of these is one of the five pillars?", ar: "أيّ هذه من أركان الإسلام الخمسة؟" }, a: [{ en: "Fasting in Ramadan", ar: "صوم رمضان" }, { en: "Wearing new clothes on Eid", ar: "لبس الجديد في العيد" }, { en: "Reading a story", ar: "قراءة قصة" }], c: 0 },
      { q: { en: "Hajj is a journey to…", ar: "الحج رحلة إلى…" }, a: [{ en: "Madinah", ar: "المدينة" }, { en: "Makkah", ar: "مكة" }, { en: "Jerusalem", ar: "القدس" }], c: 1 },
      { q: { en: "How many articles of faith (iman) are there?", ar: "كم عدد أركان الإيمان؟" }, a: [{ en: "5", ar: "٥" }, { en: "10", ar: "١٠" }, { en: "6", ar: "٦" }], c: 2 },
      { q: { en: "Zakah means giving…", ar: "الزكاة هي أن نعطي…" }, a: [{ en: "part of our wealth to people in need", ar: "جزءًا من مالنا للمحتاجين" }, { en: "a present to a friend", ar: "هدية لصديق" }, { en: "our toys away", ar: "ألعابنا" }], c: 0 },
    ] },
  ];

  /* ── Titles for any progress item (parent's view) ── */
  function itemTitle(item) {
    var p = String(item).split(":"), sec = p[0], id = p.slice(1).join(":");
    if (sec === "prayer") { var l = LESSONS.filter(function (x) { return x.id === id; })[0]; return l ? L(l.title) : id; }
    if (sec === "quran") { var s = SS.SURAHS[+id - 1]; return s ? SS.ui.surahName(s) : id; }
    if (sec === "duas") return DUA_TITLES[id] ? L(DUA_TITLES[id]) : id;
    if (sec === "stories") { var st = (SS.STORIES || []).filter(function (x) { return x.id === id; })[0]; return st ? L(st) : id; }
    if (sec === "learn") { var le = LEARN.filter(function (x) { return x.id === id; })[0]; return le ? L(le.title) : id; }
    if (sec === "quiz") { var q = QUIZZES.filter(function (x) { return x.id === id; })[0]; return q ? L(q.title) : id; }
    return item;
  }
  function storiesFor(age) {
    var ids = STORY_AGE[age];
    return (SS.STORIES || []).filter(function (s) { return !ids || ids.indexOf(s.id) > -1; });
  }
  function sectionTotal(sec, age) {
    return { prayer: LESSONS.length, quran: SURAHS_K.length, duas: DUA_IDS.length, stories: storiesFor(age).length, learn: LEARN.length, quiz: QUIZZES.length }[sec];
  }

  /* ═══════════ Server calls ═══════════ */
  function rpc(fn, args) {
    if (!SS.account || !SS.account.configured()) return Promise.reject(Object.assign(new Error("not-configured"), { code: "not-configured" }));
    return SS.account.client().then(function (c) { return c.rpc(fn, args || {}); }).then(function (r) {
      if (r.error) throw r.error;
      return r.data;
    });
  }
  function isOffline(e) { return navigator.onLine === false || (e && (e.offline || /fetch|network|Failed to fetch|Load failed/i.test(String(e.message || e)))); }
  function isRevoked(e) { return e && /invalid or revoked device/.test(String(e.message || "")); }
  function errText(e) {
    if (isOffline(e)) return t("family.errOffline");
    var m = String((e && e.message) || "");
    if (/invalid or expired code/.test(m)) return t("kids.codeInvalid");
    if (/at most 10/.test(m)) return t("family.errTooMany");
    if (/too many devices/.test(m)) return t("family.errDevices");
    if (/not signed in|JWT|jwt/.test(m)) return t("family.errSession");
    if (/child not found/.test(m)) return t("family.errNotFound");
    return t("common.error");
  }
  function deviceLabel() {
    var ua = navigator.userAgent || "";
    var name = /iPad/.test(ua) ? "iPad" : /iPhone/.test(ua) ? "iPhone" : /Android/.test(ua) ? "Android" : /Mac/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : /CrOS/.test(ua) ? "Chromebook" : "Browser";
    return (name + " · " + SS.localDate()).slice(0, 40);
  }
  function dateText(iso) {
    try { return new Date(iso).toLocaleDateString(SS.i18n.dateLocale(), { day: "numeric", month: "short", year: "numeric" }); } catch (e) { return String(iso).slice(0, 10); }
  }

  /* ═══════════ This device's Kids profiles ═══════════ */
  function devStore() {
    var d = SS.store.get("kids:device");
    if (!d || typeof d !== "object" || !d.profiles || typeof d.profiles !== "object") d = { active: null, profiles: {} };
    return d;
  }
  function saveDev(d) {
    if (!Object.keys(d.profiles).length) SS.store.remove("kids:device");
    else SS.store.set("kids:device", d);
    M.apply();
  }
  function addProfile(token, child, makeActive) {
    var d = devStore();
    d.profiles[child.id] = { token: token, child: child };
    if (makeActive || !d.active) d.active = child.id;
    saveDev(d);
  }
  function removeProfile(id) {
    var d = devStore();
    delete d.profiles[id];
    if (d.active === id) d.active = Object.keys(d.profiles)[0] || null;
    SS.store.remove("kids:progress:" + id);
    SS.store.remove("kids:queue:" + id);
    saveDev(d);
    if (!M.kidLocked()) SS.store.remove("kids:lock");
  }
  function updateChild(child) {
    var d = devStore();
    if (d.profiles[child.id]) { d.profiles[child.id].child = child; saveDev(d); }
  }
  function cur() { return M.kidDevice(); }
  function allowed(sec) { var c = cur(); return !!(c && (c.child.sections || []).indexOf(sec) > -1); }

  /* ── Progress: local copy per child + a queue for offline saves ── */
  function cache(id) {
    var c = SS.store.get("kids:progress:" + id);
    c = c && typeof c === "object" ? c : {};
    if (!c.items || typeof c.items !== "object") c.items = {};
    if (!Array.isArray(c.ach)) c.ach = [];
    return c;
  }
  function queue(id) { var q = SS.store.get("kids:queue:" + id); return Array.isArray(q) ? q : []; }
  function isDone(item) { var c = cur(); return !!(c && cache(c.id).items[item] && cache(c.id).items[item].status === "done"); }
  function bestScore(item) { var c = cur(), x = c && cache(c.id).items[item]; return x && typeof x.score === "number" ? x.score : null; }

  /** Save progress for the active child: shown at once, sent when online. */
  function record(item, status, score) {
    var c = cur();
    if (!c || !allowed(item.split(":")[0])) return;
    var pc = cache(c.id), old = pc.items[item] || {};
    pc.items[item] = { status: old.status === "done" ? "done" : status, score: Math.max(old.score == null ? -1 : old.score, score == null ? -1 : score), at: new Date().toISOString() };
    if (pc.items[item].score < 0) delete pc.items[item].score;
    SS.store.set("kids:progress:" + c.id, pc);
    var q = queue(c.id).filter(function (x) { return x.item !== item; });
    var entry = { item: item, status: pc.items[item].status };
    if (pc.items[item].score != null) entry.score = pc.items[item].score;
    q.push(entry);
    SS.store.set("kids:queue:" + c.id, q.slice(-200));
    flush(c.id);
  }
  var flushing = {};
  function flush(id) {
    var d = devStore(), p = d.profiles[id];
    if (!p) return Promise.resolve();
    if (flushing[id]) return flushing[id];
    var q = queue(id);
    if (!q.length || navigator.onLine === false) return Promise.resolve();
    var batch = q.slice(0, 50);
    flushing[id] = rpc("kid_save", { p_token: p.token, p_items: batch }).then(function (res) {
      flushing[id] = null;
      var sent = {}; batch.forEach(function (b) { sent[b.item] = JSON.stringify(b); });
      SS.store.set("kids:queue:" + id, queue(id).filter(function (x) { return sent[x.item] !== JSON.stringify(x); }));
      applyServer(id, res);
      if (queue(id).length) return flush(id);
    }, function (e) {
      flushing[id] = null;
      if (isRevoked(e)) { revoked(id); return; }
      // Offline or a server problem: keep the queue and try again later.
    });
    return flushing[id];
  }
  function applyServer(id, res) {
    if (!res) return;
    var before = cache(id), items = {}, had = {};
    before.ach.forEach(function (a) { had[a.code] = 1; });
    (res.progress || []).forEach(function (p) { items[p.item] = { status: p.status, score: p.score == null ? undefined : p.score, at: p.at }; });
    // Saves still waiting to go out stay visible.
    queue(id).forEach(function (x) { if (!items[x.item] || items[x.item].status !== "done") items[x.item] = { status: x.status, score: x.score }; });
    var pc = { items: items, ach: res.achievements || [], at: Date.now() };
    SS.store.set("kids:progress:" + id, pc);
    if (res.child) updateChild(res.child);
    var c = cur();
    if (c && c.id === id && c.child.show_progress !== false) {
      pc.ach.forEach(function (a) { if (!had[a.code] && before.at) SS.toast("🎉 " + t("kids.ach_" + a.code)); });
    }
    if (res.rejected && res.rejected.length && SS.currentView() === "kids") kidsRender(lastParams);
  }
  function refresh(id) {
    var p = devStore().profiles[id];
    if (!p || navigator.onLine === false) return Promise.resolve();
    return flush(id).then(function () {
      return rpc("kid_progress", { p_token: p.token });
    }).then(function (res) { applyServer(id, res); }, function (e) { if (isRevoked(e)) revoked(id); });
  }
  function revoked(id) {
    var name = (devStore().profiles[id] || {}).child;
    removeProfile(id);
    SS.toast(f("kids.removedByParent", { n: name ? name.name : "" }));
    if (SS.currentView() === "kids") kidsRender([]);
  }

  /* ── Grown-up PIN (salted PBKDF2, on this device only) ── */
  function hex(buf) { return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ("0" + b.toString(16)).slice(-2); }).join(""); }
  function unhex(h) { var a = new Uint8Array(h.length / 2); for (var i = 0; i < a.length; i++) a[i] = parseInt(h.substr(i * 2, 2), 16); return a; }
  var crypto = window.crypto, TextEncoder = window.TextEncoder;
  function cryptoOk() { return !!(crypto && crypto.subtle && crypto.getRandomValues && TextEncoder); }
  function derive(pin, saltHex, iter) {
    return crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]).then(function (k) {
      return crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: unhex(saltHex), iterations: iter }, k, 256);
    }).then(hex);
  }
  function setPin(pin) {
    var salt = hex(crypto.getRandomValues(new Uint8Array(16))), iter = 150000;
    return derive(pin, salt, iter).then(function (h) { SS.store.set("kids:lock", { salt: salt, hash: h, iter: iter, fails: 0, until: 0 }); });
  }
  /** Resolves true/false; rejects with {wait: seconds} while locked out after wrong tries. */
  function checkPin(pin) {
    var lk = SS.store.get("kids:lock");
    if (!lk || !lk.salt || !lk.hash) return Promise.resolve(true); // no PIN set on this device
    if (lk.until && Date.now() < lk.until) return Promise.reject({ wait: Math.ceil((lk.until - Date.now()) / 1000) });
    return derive(pin, lk.salt, lk.iter || 150000).then(function (h) {
      var l2 = SS.store.get("kids:lock") || lk;
      if (h === lk.hash) { l2.fails = 0; l2.until = 0; SS.store.set("kids:lock", l2); return true; }
      l2.fails = (l2.fails || 0) + 1;
      if (l2.fails >= 5) l2.until = Date.now() + Math.min(15 * 60, 60 * Math.pow(2, l2.fails - 5)) * 1000;
      SS.store.set("kids:lock", l2);
      return false;
    });
  }
  function validPin(p) { return /^\d{4,8}$/.test(p); }

  /* ═══════════ Shared dialog ═══════════ */
  function dialog() {
    var dlg = $("kid-dialog");
    if (dlg) return dlg;
    dlg = document.createElement("dialog");
    dlg.className = "modal";
    dlg.id = "kid-dialog";
    dlg.setAttribute("aria-labelledby", "kid-dlg-h");
    dlg.innerHTML = '<div class="modal-body"><div class="modal-head"><h2 id="kid-dlg-h"></h2><button class="icon-btn" data-close type="button" aria-label="' + esc(t("common.close")) + '">' + icon("x") + '</button></div><div class="modal-scroll" id="kid-dlg-body"></div></div>';
    document.body.appendChild(dlg);
    dlg.addEventListener("click", function (e) {
      if (e.target.closest("[data-close]")) { dlg.close(); return; }
      if (e.target === dlg) {
        var r = dlg.getBoundingClientRect();
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dlg.close();
      }
    });
    return dlg;
  }
  function openDlg(title, html) {
    var dlg = dialog();
    $("kid-dlg-h").textContent = title;
    $("kid-dlg-body").innerHTML = html;
    if (!dlg.open) { if (SS.openDialog) SS.openDialog(dlg); else dlg.showModal(); }
    // Start in the first field — but never pull focus away from a field someone is already typing in.
    var first = dlg.querySelector("input, select, button:not([data-close])");
    if (first) {
      first.focus();
      setTimeout(function () {
        var a = document.activeElement;
        if (dlg.open && (!a || !dlg.contains(a) || a.hasAttribute("data-close"))) first.focus();
      }, 30);
    }
    return dlg;
  }
  function pinFields(id, twice) {
    return '<div class="field"><label for="' + id + '">' + esc(t("kids.pin")) + "</label>" +
      '<input class="input pin-input" id="' + id + '" type="password" inputmode="numeric" autocomplete="off" maxlength="8" aria-describedby="' + id + '-err" /></div>' +
      (twice ? '<div class="field mt-1"><label for="' + id + '2">' + esc(t("kids.pinAgain")) + '</label><input class="input pin-input" id="' + id + '2" type="password" inputmode="numeric" autocomplete="off" maxlength="8" aria-describedby="' + id + '-err" /></div>' : "") +
      '<p class="field-error" id="' + id + '-err" role="alert"></p>';
  }
  /** Read and validate a new PIN from pinFields(id, true); returns the PIN or null (with an error shown). */
  function readNewPin(id) {
    var a = $(id).value, b = $(id + "2").value, err = $(id + "-err");
    [$(id), $(id + "2")].forEach(function (x) { x.removeAttribute("aria-invalid"); });
    if (!validPin(a)) { err.textContent = t("kids.pinRule"); $(id).setAttribute("aria-invalid", "true"); $(id).focus(); return null; }
    if (a !== b) { err.textContent = t("kids.pinMismatch"); $(id + "2").setAttribute("aria-invalid", "true"); $(id + "2").focus(); return null; }
    err.textContent = "";
    return a;
  }

  /* ═══════════════════════════════════════════════════════════════
     FAMILY (#/family) — for the signed-in parent
     ═══════════════════════════════════════════════════════════════ */
  var famGen = 0, famParams = [];
  function family(el, params) {
    famParams = params || [];
    var my = ++famGen;
    el.onclick = null; el.onsubmit = null; el.onchange = null;
    if (!SS.account || !SS.account.configured()) {
      el.innerHTML = '<div class="card">' + stateHtml("users", t("family.notAvailable")) + "</div>";
      return;
    }
    SS.account.restore();
    if (!SS.account.signedIn()) {
      if (SS.account.hasStoredSession() && navigator.onLine !== false && !famWaited) {
        famWaited = true;
        el.innerHTML = '<div aria-busy="true">' + SS.ui.skeletons(2, 120) + "</div>";
        setTimeout(function () { if (my === famGen && SS.currentView() === "family") family(el, famParams); }, 4000);
        return;
      }
      return signedOut(el);
    }
    var sub = famParams[0];
    if (sub === "add") return childForm(el, null);
    if (sub && famParams[1] === "edit") return loadChild(el, sub, my, childForm);
    if (sub) return loadChild(el, sub, my, childDetail);
    familyList(el, my);
  }
  var famWaited = false;
  function stateHtml(ic, text, extra) {
    return '<div class="state"><span class="s-ic">' + icon(ic) + "</span><p>" + esc(text) + "</p>" + (extra || "") + "</div>";
  }

  function signedOut(el) {
    el.innerHTML = '<div class="stack">' +
      '<article class="card"><h2 class="h-sm">' + esc(t("family.parentsTitle")) + "</h2><p>" + esc(t("family.parentsText")) + "</p>" +
      '<button class="btn mt-1" type="button" id="fam-signin">' + icon("user") + "<span>" + esc(t("family.signIn")) + "</span></button></article>" +
      '<article class="card" aria-labelledby="fam-pair-h"><h2 class="h-sm" id="fam-pair-h">' + esc(t("family.childDevice")) + "</h2><p>" + esc(t("family.childDeviceText")) + "</p>" +
      '<form id="fam-pair" class="mt-1" novalidate><div class="field"><label for="fam-code">' + esc(t("kids.code")) + "</label>" +
      '<input class="input pair-code" id="fam-code" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="9" aria-describedby="fam-code-err" /></div>' +
      '<p class="field-error" id="fam-code-err" role="alert"></p><button class="btn mt-1" type="submit">' + esc(t("kids.connect")) + "</button></form></article>" +
      privacyCard() + "</div>";
    $("fam-signin").onclick = function () { SS.account.openSignIn(); };
    $("fam-pair").onsubmit = function (e) { e.preventDefault(); pairWithCode($("fam-code"), $("fam-code-err"), this.querySelector("[type=submit]")); };
  }
  function privacyCard() {
    return '<article class="card guide-text"><h2 class="h-sm">' + esc(t("family.privacyTitle")) + "</h2><ul>" +
      ["family.privacy1", "family.privacy2", "family.privacy3", "family.privacy4"].map(function (k) { return "<li>" + esc(t(k)) + "</li>"; }).join("") + "</ul></article>";
  }

  /** Redeem a pairing code on this device (no account needed). */
  function pairWithCode(input, err, btn) {
    var code = input.value.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    input.removeAttribute("aria-invalid");
    if (code.length !== 8) { err.textContent = t("kids.codeRule"); input.setAttribute("aria-invalid", "true"); input.focus(); return; }
    if (!cryptoOk()) { err.textContent = t("kids.needsSecure"); return; }
    err.textContent = "";
    btn.disabled = true;
    rpc("kid_pair", { p_code: code, p_label: deviceLabel() }).then(function (res) {
      var hasLock = !!SS.store.get("kids:lock");
      if (hasLock) { addProfile(res.token, res.child, true); afterStart(res.child); return; }
      // A grown-up sets the PIN that leaves Kids Mode on this device.
      openDlg(t("kids.setPinTitle"), '<form id="kid-newpin" novalidate><p>' + esc(f("kids.setPinText", { n: res.child.name })) + "</p>" + pinFields("kid-np", true) +
        '<div class="modal-actions mt-2"><button class="btn" type="submit">' + esc(t("kids.startKids")) + "</button></div></form>");
      $("kid-newpin").onsubmit = function (e) {
        e.preventDefault();
        var pin = readNewPin("kid-np");
        if (!pin) return;
        setPin(pin).then(function () { addProfile(res.token, res.child, true); dialog().close(); afterStart(res.child); });
      };
      // Closing the PIN dialog without a PIN must not leave a token behind.
      dialog().addEventListener("close", function onClose() {
        dialog().removeEventListener("close", onClose);
        if (!M.kidDevice() || !devStore().profiles[res.child.id]) rpc("kid_unpair", { p_token: res.token }).catch(function () {});
      });
    }).catch(function (e) {
      err.textContent = errText(e);
      input.setAttribute("aria-invalid", "true");
    }).finally(function () { btn.disabled = false; });
  }
  function afterStart(child) {
    SS.toast(f("kids.welcome", { n: child.name }));
    location.hash = "#/kids";
  }

  function familyList(el, my) {
    el.innerHTML = '<div aria-busy="true">' + SS.ui.skeletons(2, 120) + "</div>";
    rpc("family_children_list").then(function (kids) {
      if (my !== famGen) return;
      var html = '<div class="stack"><div class="row-between"><h2 class="h-sm">' + esc(f("family.childrenN", { n: kids.length })) + "</h2>" +
        (kids.length < 10 ? '<a class="btn" href="#/family/add">' + icon("plus") + "<span>" + esc(t("family.addKid")) + "</span></a>" : "") + "</div>";
      if (!kids.length) html += '<div class="card">' + stateHtml("users", t("family.empty"), '<a class="btn" href="#/family/add">' + icon("plus") + "<span>" + esc(t("family.addKid")) + "</span></a>") + "</div>";
      kids.forEach(function (c) {
        html += '<article class="card fam-child" aria-labelledby="fc-' + c.id + '"><div class="fam-top"><span class="kid-av" aria-hidden="true">' + (AVATARS[c.avatar] || "⭐") + "</span>" +
          '<div class="w-body"><h3 class="h-sm" id="fc-' + c.id + '">' + esc(c.name) + '</h3><p class="tiny">' + esc(f("family.ageRange", { a: c.age_range })) + " · " +
          esc(f("family.summary", { d: c.done, a: c.achievements })) + " · " + esc(f("family.devicesN", { n: c.devices })) + "</p></div></div>" +
          '<div class="fam-acts"><a class="btn btn-sm" href="#/family/' + c.id + '">' + esc(t("family.viewProgress")) + "</a>" +
          '<a class="btn btn-outline btn-sm" href="#/family/' + c.id + '/edit">' + icon("edit") + "<span>" + esc(t("family.edit")) + "</span></a>" +
          '<button class="btn btn-outline btn-sm" type="button" data-pair="' + c.id + '" data-name="' + esc(c.name) + '">' + icon("link") + "<span>" + esc(t("family.pairDevice")) + "</span></button>" +
          '<button class="btn btn-outline btn-sm" type="button" data-here="' + c.id + '">' + icon("phone") + "<span>" + esc(t("family.useHere")) + "</span></button></div></article>";
      });
      html += privacyCard() + "</div>";
      el.innerHTML = html;
      el.onclick = function (e) {
        var p = e.target.closest("[data-pair]"), h = e.target.closest("[data-here]");
        if (p) pairCode(p.getAttribute("data-pair"), p.getAttribute("data-name"));
        if (h) useHere(kids, h.getAttribute("data-here"));
      };
    }).catch(function (e) {
      if (my !== famGen) return;
      el.innerHTML = '<div class="card">' + stateHtml(isOffline(e) ? "wifi-off" : "x", errText(e), '<button class="btn btn-outline btn-sm" type="button" id="fam-retry">' + icon("refresh") + "<span>" + esc(t("common.retry")) + "</span></button>") + "</div>";
      $("fam-retry").onclick = function () { family(el, famParams); };
    });
  }

  function pairCode(id, name) {
    openDlg(f("family.pairTitle", { n: name }), '<div aria-busy="true" id="kid-code-box">' + SS.ui.skeletons(1, 60) + "</div>");
    rpc("family_pair_code", { p_child: id }).then(function (r) {
      var code = r.code.slice(0, 4) + "-" + r.code.slice(4);
      var until = new Date(r.expires_at);
      $("kid-dlg-body").innerHTML = '<p class="pair-code" aria-label="' + esc(r.code.split("").join(" ")) + '">' + esc(code) + "</p>" +
        '<p class="tiny center">' + esc(f("family.codeExpires", { t: SS.formatTime(("0" + until.getHours()).slice(-2) + ":" + ("0" + until.getMinutes()).slice(-2)) })) + "</p>" +
        '<ol class="kid-steps mt-2"><li>' + esc(t("family.pairStep1")) + "</li><li>" + esc(t("family.pairStep2")) + "</li><li>" + esc(t("family.pairStep3")) + "</li></ol>" +
        '<div class="modal-actions mt-2"><button class="btn btn-outline btn-sm" type="button" id="kid-newcode">' + icon("refresh") + "<span>" + esc(t("family.newCode")) + "</span></button></div>";
      $("kid-newcode").onclick = function () { pairCode(id, name); };
    }).catch(function (e) { $("kid-dlg-body").innerHTML = stateHtml("x", errText(e)); });
  }

  /** Start Kids Mode on this (the parent's) device for one or more children. */
  function useHere(kids, firstId) {
    if (!cryptoOk()) { SS.toast(t("kids.needsSecure")); return; }
    openDlg(t("family.useHereTitle"), '<form id="kid-here" novalidate>' +
      '<fieldset class="field"><legend class="field-l"><b>' + esc(t("family.whichKids")) + '</b></legend><div class="check-row">' +
      kids.map(function (c) { return '<label><input type="checkbox" name="kid" value="' + c.id + '"' + (c.id === firstId ? " checked" : "") + " /> " + (AVATARS[c.avatar] || "") + " " + esc(c.name) + "</label>"; }).join("") +
      '</div><p class="field-error" id="kid-here-kids-err" role="alert"></p></fieldset>' +
      '<p class="note mt-1">' + esc(t("family.useHereNote")) + "</p>" +
      '<p class="mt-1"><b>' + esc(t("kids.setPinTitle")) + "</b></p>" + pinFields("kid-hp", true) +
      '<div class="modal-actions mt-2"><button class="btn btn-ghost" type="button" data-close>' + esc(t("common.cancel")) + '</button><button class="btn" type="submit">' + esc(t("kids.startKids")) + "</button></div></form>");
    $("kid-here").onsubmit = function (e) {
      e.preventDefault();
      var ids = Array.prototype.map.call(this.querySelectorAll('[name="kid"]:checked'), function (x) { return x.value; });
      if (!ids.length) { $("kid-here-kids-err").textContent = t("family.pickKid"); return; }
      $("kid-here-kids-err").textContent = "";
      var pin = readNewPin("kid-hp");
      if (!pin) return;
      var btn = this.querySelector("[type=submit]");
      btn.disabled = true;
      var got = [];
      ids.reduce(function (p, id) {
        return p.then(function () { return rpc("family_device_token", { p_child: id, p_label: deviceLabel() }).then(function (r) { got.push(r); }); });
      }, Promise.resolve()).then(function () {
        return setPin(pin);
      }).then(function () {
        // Sign the parent out of this device so the child never has their session.
        var keep = SS.store.settings(), carry = { locale: keep.locale, theme: keep.theme, method: keep.method, school: keep.school };
        return SS.account.signOut(false).then(function () {
          SS.store.saveSettings(carry);
          got.forEach(function (r, i) { addProfile(r.token, r.child, i === 0); });
          dialog().close();
          afterStart(got[0].child);
        });
      }).catch(function (err) {
        btn.disabled = false;
        // Tokens already made for this device are useless without the switch: revoke them.
        got.forEach(function (r) { rpc("kid_unpair", { p_token: r.token }).catch(function () {}); });
        $("kid-hp-err").textContent = errText(err);
      });
    };
  }

  function loadChild(el, id, my, draw) {
    el.innerHTML = '<div aria-busy="true">' + SS.ui.skeletons(3, 100) + "</div>";
    rpc("family_child_detail", { p_child: id }).then(function (c) {
      if (my === famGen) draw(el, c);
    }).catch(function (e) {
      if (my !== famGen) return;
      el.innerHTML = '<a class="back-link" href="#/family">' + icon("chev-l", "flip") + "<span>" + esc(t("family.title")) + "</span></a>" +
        '<div class="card">' + stateHtml(isOffline(e) ? "wifi-off" : "x", errText(e), '<button class="btn btn-outline btn-sm" type="button" id="fam-retry">' + icon("refresh") + "<span>" + esc(t("common.retry")) + "</span></button>") + "</div>";
      $("fam-retry").onclick = function () { family(el, famParams); };
    });
  }

  function childForm(el, c) {
    var editing = !!c;
    c = c || { name: "", age_range: "7-9", avatar: "star", sections: SECTIONS.slice(), show_progress: true, allow_audio: true };
    el.innerHTML = '<a class="back-link" href="#/family' + (editing ? "/" + c.id : "") + '">' + icon("chev-l", "flip") + "<span>" + esc(editing ? c.name : t("family.title")) + "</span></a>" +
      '<form class="card stack" id="kid-form" novalidate aria-labelledby="kid-form-h"><h2 class="h-sm" id="kid-form-h">' + esc(editing ? f("family.editTitle", { n: c.name }) : t("family.addKid")) + "</h2>" +
      '<div class="field"><label for="kf-name">' + esc(t("family.name")) + '</label><input class="input" id="kf-name" maxlength="24" autocomplete="off" value="' + esc(c.name) + '" aria-describedby="kf-name-help kf-name-err" required />' +
      '<p class="tiny" id="kf-name-help">' + esc(t("family.nameHelp")) + '</p><p class="field-error" id="kf-name-err" role="alert"></p></div>' +
      '<div class="field"><label for="kf-age">' + esc(t("family.age")) + '</label><select class="input" id="kf-age">' +
      AGES.map(function (a) { return '<option value="' + a + '"' + (a === c.age_range ? " selected" : "") + ">" + esc(f("family.ageRange", { a: a })) + "</option>"; }).join("") + "</select></div>" +
      '<fieldset class="field"><legend class="field-l"><b>' + esc(t("family.avatar")) + '</b></legend><div class="av-pick">' +
      Object.keys(AVATARS).map(function (k) { return '<label><input type="radio" name="kf-av" value="' + k + '"' + (k === c.avatar ? " checked" : "") + ' aria-label="' + esc(t("family.av_" + k)) + '" /><span aria-hidden="true">' + AVATARS[k] + "</span></label>"; }).join("") + "</div></fieldset>" +
      '<fieldset class="field"><legend class="field-l"><b>' + esc(t("family.sections")) + '</b></legend><p class="tiny">' + esc(t("family.sectionsHelp")) + '</p><div class="check-row">' +
      SECTIONS.map(function (s) { return '<label><input type="checkbox" name="kf-sec" value="' + s + '"' + ((c.sections || []).indexOf(s) > -1 ? " checked" : "") + " />" + esc(t("kids.sec_" + s)) + "</label>"; }).join("") +
      '</div><p class="field-error" id="kf-sec-err" role="alert"></p></fieldset>' +
      '<div class="set-row"><span id="kf-prog-l">' + esc(t("family.showProgress")) + '</span><label class="switch"><input type="checkbox" id="kf-prog" aria-labelledby="kf-prog-l"' + (c.show_progress !== false ? " checked" : "") + ' /><span class="trk"></span><span class="th"></span></label></div>' +
      '<div class="set-row"><span id="kf-audio-l">' + esc(t("family.allowAudio")) + '</span><label class="switch"><input type="checkbox" id="kf-audio" aria-labelledby="kf-audio-l"' + (c.allow_audio !== false ? " checked" : "") + ' /><span class="trk"></span><span class="th"></span></label></div>' +
      '<p class="tiny">' + esc(t("family.safetyNote")) + "</p>" +
      (editing ? "" : '<label class="check-row"><span><input type="checkbox" id="kf-consent" aria-describedby="kf-consent-err" /> ' + esc(t("family.consent")) + '</span></label><p class="field-error" id="kf-consent-err" role="alert"></p>') +
      '<p class="field-error" id="kf-err" role="alert"></p>' +
      '<div class="form-row"><button class="btn" type="submit">' + esc(t(editing ? "family.saveChanges" : "family.addKid")) + '</button><a class="btn btn-ghost" href="#/family' + (editing ? "/" + c.id : "") + '">' + esc(t("common.cancel")) + "</a></div></form>" +
      (editing ? "" : privacyCard());
    $("kid-form").onsubmit = function (e) {
      e.preventDefault();
      var name = $("kf-name").value.trim(), secs = Array.prototype.map.call(document.querySelectorAll('[name="kf-sec"]:checked'), function (x) { return x.value; });
      var bad = null;
      ["kf-name-err", "kf-sec-err", "kf-err"].concat(editing ? [] : ["kf-consent-err"]).forEach(function (id) { $(id).textContent = ""; });
      $("kf-name").removeAttribute("aria-invalid");
      if (!name || name.length > 24) { $("kf-name-err").textContent = t("family.nameRule"); $("kf-name").setAttribute("aria-invalid", "true"); bad = bad || $("kf-name"); }
      if (!secs.length) { $("kf-sec-err").textContent = t("family.sectionsRule"); bad = bad || document.querySelector('[name="kf-sec"]'); }
      if (!editing && !$("kf-consent").checked) { $("kf-consent-err").textContent = t("family.consentRule"); bad = bad || $("kf-consent"); }
      if (bad) { bad.focus(); return; }
      var av = document.querySelector('[name="kf-av"]:checked');
      var body = { name: name, age_range: $("kf-age").value, avatar: av ? av.value : "star", sections: secs, show_progress: $("kf-prog").checked, allow_audio: $("kf-audio").checked };
      if (editing) body.id = c.id;
      var btn = this.querySelector("[type=submit]");
      btn.disabled = true;
      rpc("family_child_save", { p_child: body }).then(function (saved) {
        SS.toast(t(editing ? "settings.saved" : "family.added"));
        location.hash = "#/family/" + saved.id;
      }).catch(function (err) { $("kf-err").textContent = errText(err); btn.disabled = false; });
    };
  }

  function achHtml(earned, show) {
    var at = {}; (earned || []).forEach(function (a) { at[a.code] = a.at; });
    return '<div class="ach-list">' + ACH.map(function (a) {
      var got = !!at[a.code];
      return '<div class="ach' + (got ? "" : " locked") + '"><span class="a-emoji" aria-hidden="true">' + a.emoji + "</span><span>" + esc(t("kids.ach_" + a.code)) + "</span>" +
        "<small>" + esc(got ? (show ? dateText(at[a.code]) : t("kids.earned")) : t("kids.notYet")) + "</small></div>";
    }).join("") + "</div>";
  }
  function sectionBars(items, age, sections) {
    var done = {};
    items.forEach(function (p) { if (p.status === "done") { var s = p.item.split(":")[0]; done[s] = (done[s] || 0) + 1; } });
    return SECTIONS.map(function (s) {
      var total = sectionTotal(s, age), n = Math.min(done[s] || 0, total), off = sections && sections.indexOf(s) === -1;
      return '<div class="acct-progress mt-1"><div class="row-between"><span>' + esc(t("kids.sec_" + s)) + (off ? ' <span class="badge badge-net">' + esc(t("family.off")) + "</span>" : "") + "</span><b>" + n + " / " + total + "</b></div>" +
        '<div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="' + total + '" aria-valuenow="' + n + '" aria-label="' + esc(t("kids.sec_" + s)) + '"><span style="inline-size:' + Math.round(n / total * 100) + '%"></span></div></div>';
    }).join("");
  }

  function childDetail(el, c) {
    var recent = (c.progress || []).slice().sort(function (a, b) { return String(b.at).localeCompare(String(a.at)); }).slice(0, 10);
    var quizzes = (c.progress || []).filter(function (p) { return p.item.indexOf("quiz:") === 0 && p.score != null; });
    el.innerHTML = '<a class="back-link" href="#/family">' + icon("chev-l", "flip") + "<span>" + esc(t("family.title")) + "</span></a>" +
      '<div class="kid-hello"><span class="kid-av" aria-hidden="true">' + (AVATARS[c.avatar] || "⭐") + '</span><div><h2 id="fam-child-h">' + esc(c.name) + '</h2><p class="tiny">' + esc(f("family.ageRange", { a: c.age_range })) + "</p></div>" +
      '<a class="btn btn-outline btn-sm kid-exit" href="#/family/' + c.id + '/edit">' + icon("edit") + "<span>" + esc(t("family.edit")) + "</span></a></div>" +
      '<div class="mode-grid"><div class="stack">' +
      '<article class="card"><h3 class="h-sm">' + esc(t("family.learning")) + "</h3>" + sectionBars(c.progress || [], c.age_range, c.sections) +
      (quizzes.length ? '<p class="tiny mt-1">' + esc(t("family.quizScores")) + " " + quizzes.map(function (q) { return esc(itemTitle(q.item)) + " " + q.score + "%"; }).join(" · ") + "</p>" : "") + "</article>" +
      '<article class="card"><h3 class="h-sm">' + esc(t("kids.achievements")) + "</h3>" + achHtml(c.achievements, true) + "</article>" +
      '<article class="card"><h3 class="h-sm">' + esc(t("family.recent")) + "</h3>" + (recent.length ? '<ul class="today-list">' + recent.map(function (p) {
        return '<li class="row-between"><span>' + esc(t("kids.sec_" + p.item.split(":")[0])) + ": " + esc(itemTitle(p.item)) + "</span><span class=\"tiny\">" + esc(p.status === "done" ? t("family.done") : t("family.started")) + " · " + esc(dateText(p.at)) + "</span></li>";
      }).join("") + "</ul>" : '<p class="muted">' + esc(t("family.noActivity")) + "</p>") + "</article>" +
      '</div><div class="stack">' +
      '<article class="card"><h3 class="h-sm">' + esc(t("family.devices")) + '</h3><p class="tiny">' + esc(t("family.devicesHelp")) + "</p>" +
      (c.devices.length ? '<div class="stack mt-1">' + c.devices.map(function (d) {
        return '<div class="row-between"><span><b>' + esc(d.label || t("family.unnamedDevice")) + '</b><br><span class="tiny">' + esc(f("family.deviceSeen", { a: dateText(d.created_at), s: dateText(d.last_seen_at) })) + "</span></span>" +
          '<button class="btn btn-danger btn-sm" type="button" data-revoke="' + d.id + '">' + esc(t("family.revoke")) + "</button></div>";
      }).join("") + "</div>" : '<p class="muted mt-1">' + esc(t("family.noDevices")) + "</p>") +
      '<div class="fam-acts mt-1"><button class="btn btn-outline btn-sm" type="button" id="fam-pair1">' + icon("link") + "<span>" + esc(t("family.pairDevice")) + "</span></button>" +
      '<button class="btn btn-outline btn-sm" type="button" id="fam-here1">' + icon("phone") + "<span>" + esc(t("family.useHere")) + "</span></button></div></article>" +
      '<article class="card"><h3 class="h-sm">' + esc(t("family.controls")) + '</h3><ul class="today-list">' +
      SECTIONS.map(function (s) { var on = c.sections.indexOf(s) > -1; return '<li class="row-between"><span>' + esc(t("kids.sec_" + s)) + '</span><span class="badge ' + (on ? "badge-ok" : "badge-net") + '">' + icon(on ? "check" : "x") + "<span>" + esc(t(on ? "family.on" : "family.off")) + "</span></span></li>"; }).join("") +
      '<li class="row-between"><span>' + esc(t("family.showProgress")) + '</span><span class="badge">' + esc(t(c.show_progress ? "family.on" : "family.off")) + "</span></li>" +
      '<li class="row-between"><span>' + esc(t("family.allowAudio")) + '</span><span class="badge">' + esc(t(c.allow_audio ? "family.on" : "family.off")) + "</span></li></ul>" +
      '<p class="tiny mt-1">' + esc(t("family.safetyNote")) + "</p></article>" +
      '<article class="card"><h3 class="h-sm">' + esc(t("family.manage")) + "</h3>" +
      '<div class="fam-acts mt-1"><button class="btn btn-outline btn-sm" type="button" id="fam-reset">' + icon("refresh") + "<span>" + esc(t("family.resetProgress")) + "</span></button>" +
      '<button class="btn btn-danger btn-sm" type="button" id="fam-remove">' + icon("trash") + "<span>" + esc(t("family.remove")) + "</span></button></div>" +
      '<p class="tiny mt-1">' + esc(t("family.removeHelp")) + "</p></article></div></div>";
    $("fam-pair1").onclick = function () { pairCode(c.id, c.name); };
    $("fam-here1").onclick = function () { useHere([c], c.id); };
    el.onclick = function (e) {
      var r = e.target.closest("[data-revoke]");
      if (!r) return;
      if (!window.confirm(t("family.revokeConfirm"))) return;
      r.disabled = true;
      rpc("family_device_revoke", { p_device: r.getAttribute("data-revoke") }).then(function () { SS.toast(t("family.revoked")); family(el, famParams); })
        .catch(function (err) { r.disabled = false; SS.toast(errText(err)); });
    };
    $("fam-reset").onclick = function () {
      if (!window.confirm(f("family.resetConfirm", { n: c.name }))) return;
      rpc("family_child_reset", { p_child: c.id }).then(function () { SS.toast(t("family.resetDone")); family(el, famParams); }).catch(function (err) { SS.toast(errText(err)); });
    };
    $("fam-remove").onclick = function () {
      if (!window.confirm(f("family.removeConfirm", { n: c.name }))) return;
      rpc("family_child_delete", { p_child: c.id }).then(function () { SS.toast(f("family.removed", { n: c.name })); location.hash = "#/family"; })
        .catch(function (err) { SS.toast(errText(err)); });
    };
  }

  /* ═══════════════════════════════════════════════════════════════
     KIDS (#/kids) — the child's own space
     ═══════════════════════════════════════════════════════════════ */
  var lastParams = [], kidGen = 0, refreshedAt = 0, storyOpen = null;
  function kidsRender(params) {
    lastParams = params || [];
    var el = $("kids-root"), c = cur();
    if (!el) return;
    kidGen++;
    el.onclick = null;
    var noAudio = !!(c && c.child.allow_audio === false);
    document.body.classList.toggle("kids-noaudio", noAudio);
    if (noAudio && SS.audio) SS.audio.stop();
    if (!c) return kidsLanding(el);
    if (Date.now() - refreshedAt > 60000) { refreshedAt = Date.now(); refresh(c.id).then(function () { if (SS.currentView() === "kids" && cur() && cur().id === c.id) drawKids(el, lastParams, true); }); }
    if (storyOpen && lastParams[0] === "stories") finishStory();
    drawKids(el, lastParams);
  }
  function drawKids(el, params, quiet) {
    var c = cur();
    if (!c) return kidsLanding(el);
    var sub = params[0] || "", sec = { prayer: "prayer", quran: "quran", duas: "duas", stories: "stories", learn: "learn", quiz: "quiz" }[sub];
    if (quiet && sub && sub !== "progress") return; // don't redraw an activity under the child
    var focusKeep = quiet ? document.activeElement : null;
    if (sec && !allowed(sec)) {
      el.innerHTML = head(t("kids.sec_" + sec), true) + '<div class="card kid-card">' + stateHtml("lock", t("kids.sectionOff"), '<a class="btn kid-big" href="#/kids">' + esc(t("kids.backHome")) + "</a>") + "</div>";
      return;
    }
    ({ "": kidHome, prayer: kidPrayer, quran: kidQuran, duas: kidDuas, stories: kidStories, learn: kidLearn, quiz: kidQuiz, progress: kidProgress, today: kidToday }[sub] || kidHome)(el, params.slice(1), c);
    wireExit();
    if (focusKeep && focusKeep.id && $(focusKeep.id)) $(focusKeep.id).focus();
  }
  function head(title, back) {
    var c = cur();
    return '<div class="kid-hello">' + (back ? '<a class="btn btn-outline btn-sm" href="#/kids">' + icon("chev-l", "flip") + "<span>" + esc(t("kids.backHome")) + "</span></a>" : "") +
      '<span class="kid-av sm" aria-hidden="true">' + (AVATARS[c.child.avatar] || "⭐") + '</span><h1 id="kids-h" tabindex="-1">' + esc(title) + "</h1>" +
      '<button class="btn btn-ghost btn-sm kid-exit" type="button" id="kid-grownups">' + icon("lock") + "<span>" + esc(t("kids.grownups")) + "</span></button></div>";
  }
  function wireExit() { if ($("kid-grownups")) $("kid-grownups").onclick = grownups; }

  function kidsLanding(el) {
    el.innerHTML = '<div class="kid-hello"><span class="kid-av" aria-hidden="true">🧒</span><h1 id="kids-h" tabindex="-1">' + esc(t("kids.title")) + "</h1></div>" +
      '<div class="stack"><article class="card kid-card"><p>' + esc(t("kids.landing")) + "</p>" +
      '<a class="btn kid-big mt-1" href="#/family">' + esc(t("kids.parentsSetup")) + "</a></article>" +
      '<article class="card kid-card"><h2 class="h-sm">' + esc(t("family.childDevice")) + "</h2><p>" + esc(t("family.childDeviceText")) + "</p>" +
      '<form id="kid-pair" class="mt-1" novalidate><div class="field"><label for="kid-code">' + esc(t("kids.code")) + '</label><input class="input pair-code" id="kid-code" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="9" aria-describedby="kid-code-err" /></div>' +
      '<p class="field-error" id="kid-code-err" role="alert"></p><button class="btn kid-big mt-1" type="submit">' + esc(t("kids.connect")) + "</button></form></article></div>";
    $("kid-pair").onsubmit = function (e) { e.preventDefault(); pairWithCode($("kid-code"), $("kid-code-err"), this.querySelector("[type=submit]")); };
  }

  function kidHome(el, p, c) {
    var tiles = [
      ["prayer", "🕌", "kids.tileLearn", "kids.tileLearnSub", "#/kids/prayer"],
      ["quran", "📖", "kids.tileRead", "kids.tileReadSub", "#/kids/quran"],
      ["stories", "🎧", "kids.tileListen", "kids.tileListenSub", "#/kids/stories"],
      ["quiz", "🧩", "kids.tilePractice", "kids.tilePracticeSub", "#/kids/quiz"],
      ["learn", "🔭", "kids.tileExplore", "kids.tileExploreSub", "#/kids/learn"],
      ["duas", "🤲", "kids.tileDuas", "kids.tileDuasSub", "#/kids/duas"],
    ].filter(function (x) { return allowed(x[0]); });
    var others = c.ids.length > 1 ? '<p class="tiny mt-1">' + esc(t("kids.switchHint")) + "</p>" : "";
    el.innerHTML = head(f("kids.hello", { n: c.child.name })) +
      '<a class="card widget kid-card" href="#/kids/today"><span class="w-ic gold" aria-hidden="true">☀️</span><span class="w-body"><span class="w-title">' + esc(t("kids.today")) + '</span><span class="w-sub">' + esc(t("kids.todaySub")) + "</span></span>" + icon("chev-r", "chev") + "</a>" +
      '<nav class="kid-grid mt-2" aria-label="' + esc(t("kids.title")) + '">' + tiles.map(function (x) {
        return '<a class="kid-tile" href="' + x[4] + '"><span class="k-emoji" aria-hidden="true">' + x[1] + "</span><span>" + esc(t(x[2])) + "</span><small>" + esc(t(x[3])) + "</small></a>";
      }).join("") +
      (c.child.show_progress !== false ? '<a class="kid-tile" href="#/kids/progress"><span class="k-emoji" aria-hidden="true">🏅</span><span>' + esc(t("kids.tileProgress")) + "</span><small>" + esc(t("kids.tileProgressSub")) + "</small></a>" : "") +
      "</nav>" + (tiles.length ? "" : '<div class="card kid-card mt-2">' + stateHtml("lock", t("kids.nothingOn")) + "</div>") + others +
      (queue(c.id).length ? '<p class="tiny mt-2">' + icon("wifi-off") + " " + esc(t("kids.pendingSave")) + "</p>" : "");
  }

  function doneBadge(item) { return isDone(item) ? '<span class="kid-done">' + icon("check") + "<span>" + esc(t("kids.learned")) + "</span></span>" : ""; }
  function learnedBtn(item, label) {
    var d = isDone(item);
    return '<button class="btn kid-big mt-2' + (d ? " btn-outline" : "") + '" type="button" data-learned="' + item + '" aria-pressed="' + d + '">' + icon("check") + "<span>" + esc(d ? t("kids.learned") : label || t("kids.iLearned")) + "</span></button>";
  }
  function wireLearned(el, again) {
    el.onclick = function (e) {
      var b = e.target.closest("[data-learned]");
      if (!b || isDone(b.getAttribute("data-learned"))) return;
      record(b.getAttribute("data-learned"), "done");
      SS.toast(t("kids.wellDone"));
      again();
    };
  }
  function listRow(href, emoji, title, item) {
    return '<a class="card widget kid-card" href="' + href + '"><span class="w-ic" aria-hidden="true">' + emoji + '</span><span class="w-body"><span class="w-title">' + esc(title) + '</span><span class="w-sub">' + (item && isDone(item) ? esc(t("kids.learned")) + " ✓" : "") + "</span></span>" + icon("chev-r", "chev") + "</a>";
  }

  /* ── Learn: prayer & wudu ── */
  function kidPrayer(el, p) {
    var l = LESSONS.filter(function (x) { return x.id === p[0]; })[0];
    if (!l) {
      el.innerHTML = head(t("kids.tileLearn"), true) + '<div class="stack">' + LESSONS.map(function (x) { return listRow("#/kids/prayer/" + x.id, x.emoji, L(x.title), "prayer:" + x.id); }).join("") + "</div>";
      return;
    }
    var item = "prayer:" + l.id;
    if (!isDone(item)) record(item, "started");
    var html = head(L(l.title), true) + '<article class="card kid-card guide-text"><p>' + esc(L(l.intro)) + "</p>";
    if (l.points) html += '<ul class="kid-steps">' + l.points.map(function (x) { return "<li>" + esc(L(x)) + "</li>"; }).join("") + "</ul>";
    if (l.steps) html += '<div id="kid-order"></div>';
    if (l.after) html += "<p>" + esc(L(l.after)) + "</p>";
    html += '<p class="tiny guide-src"><span class="badge badge-src">' + esc(t("modes.source")) + "</span> " + esc(L(l.src)) + "</p>" + doneBadge(item) + "</article>" +
      (l.steps ? "" : learnedBtn(item)) + '<div id="kid-after"></div>';
    el.innerHTML = html;
    if (l.steps) orderActivity($("kid-order"), l, item);
    wireLearned(el, function () { kidPrayer(el, p); });
  }
  /** Put the steps in order: tap the next step; a gentle nudge on a wrong tap. */
  function orderActivity(box, l, item) {
    var order = l.steps.map(function (s, i) { return i; }), placed = [];
    var shuffled = order.slice().sort(function (a, b) { return ((a * 7919 + 13) % 17) - ((b * 7919 + 13) % 17); });
    function draw(msg) {
      var done = placed.length === l.steps.length;
      box.innerHTML = '<h2 class="h-sm mt-1">' + esc(t("kids.putInOrder")) + "</h2>" +
        (placed.length ? '<ol class="kid-steps mt-1">' + placed.map(function (i) { return "<li>" + esc(L(l.steps[i])) + "</li>"; }).join("") + "</ol>" : "") +
        (done ? '<p class="kid-done mt-1">' + icon("check") + "<span>" + esc(t("kids.allInOrder")) + "</span></p>" + learnedBtn(item)
          : '<p class="tiny mt-1" aria-live="polite">' + esc(msg || f("kids.pickStep", { n: placed.length + 1 })) + '</p><div class="qz-opts kid-quiz mt-1">' +
            shuffled.filter(function (i) { return placed.indexOf(i) === -1; }).map(function (i) { return '<button class="btn btn-outline" type="button" data-step="' + i + '">' + esc(L(l.steps[i])) + "</button>"; }).join("") + "</div>");
      if (done) wireLearned(box, function () { draw(); });
    }
    box.addEventListener("click", function (e) {
      var b = e.target.closest("[data-step]");
      if (!b) return;
      var i = +b.getAttribute("data-step");
      if (i === placed.length) { placed.push(i); draw(); var nb = box.querySelector("[data-step]"); if (nb) nb.focus(); }
      else draw(t("kids.tryAnother"));
    });
    draw();
  }

  /* ── Read: short surahs (text from the app's Qur'an source) ── */
  function kidQuran(el, p) {
    var n = +p[0];
    if (SURAHS_K.indexOf(n) === -1) {
      el.innerHTML = head(t("kids.tileRead"), true) + '<div class="stack">' + SURAHS_K.map(function (k) {
        var s = SS.SURAHS[k - 1];
        return listRow("#/kids/quran/" + k, "📖", SS.ui.surahName(s) + (isAr() ? "" : " · " + s.ar), "quran:" + k);
      }).join("") + "</div>";
      return;
    }
    var s = SS.SURAHS[n - 1], item = "quran:" + n, my = kidGen, audio = cur().child.allow_audio !== false;
    if (!isDone(item)) record(item, "started");
    el.innerHTML = head(SS.ui.surahName(s), true) +
      (audio ? '<button class="btn kid-big" type="button" id="kq-play" data-kaudio>' + icon("play") + "<span>" + esc(t("kids.listenAll")) + "</span></button>" : "") +
      '<div class="stack mt-2" id="kq-list" aria-busy="true">' + SS.ui.skeletons(3, 90) + "</div>" + learnedBtn(item, t("kids.finishedReading")) +
      '<p class="tiny mt-1">' + esc(t("kids.quranSource")) + "</p>";
    SS.api.surahText(n).then(function (r) {
      if (my !== kidGen || !$("kq-list")) return;
      $("kq-list").removeAttribute("aria-busy");
      $("kq-list").innerHTML = r.arabic.map(function (a, i) {
        var ar = a.text;
        if (i === 0 && n !== 1 && n !== 9) ar = SS.ui.stripBasmala(ar);
        return '<article class="card kid-card"><div class="row-between"><span class="badge">' + (i + 1) + "</span>" +
          (audio ? '<button class="icon-btn bordered" type="button" data-ayah="' + (i + 1) + '" data-kaudio aria-label="' + esc(f("kids.playAyah", { n: i + 1 })) + '">' + icon("play") + "</button>" : "") + "</div>" +
          '<p class="arabic-dua" lang="ar" dir="rtl">' + esc(ar) + "</p>" +
          (isAr() ? "" : '<p class="transliteration">' + esc(r.transliteration[i].text) + '</p><p class="translation"' + SS.ui.trAttrs() + ">" + esc(r.translation[i].text) + "</p>") + "</article>";
      }).join("");
    }).catch(function () {
      if (my === kidGen && $("kq-list")) SS.ui.renderState($("kq-list"), { kind: "error", retry: function () { kidQuran(el, p); } });
    });
    el.onclick = function (e) {
      var a = e.target.closest("[data-ayah]");
      if (a && audio) { SS.audio.start(n, +a.getAttribute("data-ayah"), s, false, { single: true }); return; }
      if (e.target.closest("#kq-play") && audio) { SS.audio.start(n, 1, s); return; }
      var b = e.target.closest("[data-learned]");
      if (b && !isDone(item)) { record(item, "done"); SS.toast(t("kids.wellDone")); kidQuran(el, p); }
    };
  }

  /* ── Duas: read → listen → practise → learned ── */
  function arVoice() { try { return (window.speechSynthesis && speechSynthesis.getVoices().filter(function (v) { return /^ar/i.test(v.lang); })[0]) || null; } catch (e) { return null; } }
  function kidDuas(el, p) {
    var id = p[0], d = DUA_IDS.indexOf(id) > -1 ? M.libraryDua(id) : null;
    if (!d) {
      el.innerHTML = head(t("kids.tileDuas"), true) + '<div class="stack">' + DUA_IDS.map(function (k) { return listRow("#/kids/duas/" + k, "🤲", L(DUA_TITLES[k]), "duas:" + k); }).join("") + "</div>";
      return;
    }
    var item = "duas:" + id, voice = cur().child.allow_audio !== false && arVoice(), hidden = false;
    if (!isDone(item)) record(item, "started");
    function draw() {
      el.innerHTML = head(L(DUA_TITLES[id]), true) +
        '<ol class="kid-steps"><li>' + esc(t("kids.duaStep1")) + "</li><li>" + esc(t(voice ? "kids.duaStep2" : "kids.duaStep2b")) + "</li><li>" + esc(t("kids.duaStep3")) + "</li><li>" + esc(t("kids.duaStep4")) + "</li></ol>" +
        '<article class="card kid-card mt-1 dua-card"><p class="arabic-dua" lang="ar" dir="rtl"' + (hidden ? ' style="filter:blur(9px)" aria-hidden="true"' : "") + ">" + esc(d.arabic) + "</p>" +
        '<p class="transliteration"' + (hidden ? ' style="filter:blur(7px)" aria-hidden="true"' : "") + ">" + esc(d.transliteration) + "</p>" +
        (isAr() ? "" : '<p class="translation">' + esc(d.translationEn) + "</p>") +
        '<p class="tiny"><span class="badge badge-src">' + esc(t("modes.source")) + "</span> " + esc(d.source) + "</p>" + doneBadge(item) + "</article>" +
        '<div class="form-row mt-1">' + (voice ? '<button class="btn btn-outline kid-big" type="button" id="kd-listen" data-kaudio>' + icon("play") + "<span>" + esc(t("kids.listen")) + "</span></button>" : "") +
        '<button class="btn btn-outline kid-big" type="button" id="kd-hide" aria-pressed="' + hidden + '">' + esc(t(hidden ? "kids.showWords" : "kids.hideWords")) + "</button></div>" +
        learnedBtn(item) + (voice ? '<p class="tiny mt-1">' + esc(t("kids.deviceVoice")) + "</p>" : "");
      if ($("kd-listen")) $("kd-listen").onclick = function () {
        try { speechSynthesis.cancel(); var u = new SpeechSynthesisUtterance(d.arabic); u.lang = voice.lang; u.voice = voice; u.rate = 0.8; speechSynthesis.speak(u); } catch (e) { /* no voice */ }
      };
      $("kd-hide").onclick = function () { hidden = !hidden; draw(); $("kd-hide").focus(); };
    }
    draw();
    wireLearned(el, function () { draw(); });
  }

  /* ── Listen: stories (the app's Qur'an/hadith stories, chosen by age) ── */
  function kidStories(el) {
    var list = storiesFor(cur().child.age_range);
    el.innerHTML = head(t("kids.tileListen"), true) + '<p class="tiny mb-1">' + esc(t("kids.storiesNote")) + '</p><div class="stack">' + list.map(function (s) {
      return '<button class="card widget kid-card" type="button" data-story="' + s.id + '"><span class="w-ic" aria-hidden="true">🌙</span><span class="w-body"><span class="w-title">' + esc(L(s)) + '</span><span class="w-sub">' + esc(L(s.sub)) + (isDone("stories:" + s.id) ? " · " + esc(t("kids.heard")) + " ✓" : "") + "</span></span>" + icon("chev-r", "chev") + "</button>";
    }).join("") + "</div>";
    el.onclick = function (e) {
      var b = e.target.closest("[data-story]");
      if (!b || !SS.storiesUI) return;
      var id = b.getAttribute("data-story"), sp = SS.store.get("stories:progress", {}) || {};
      // The viewer's own progress is per device; reset this story so we know whether this child finished it.
      sp[id] = { at: 0, done: false };
      SS.store.set("stories:progress", sp);
      storyOpen = { id: id, child: cur().id };
      SS.storiesUI.open(id, 1, "#/kids/stories");
    };
  }
  function finishStory() {
    var s = storyOpen; storyOpen = null;
    var sp = (SS.store.get("stories:progress", {}) || {})[s.id];
    if (sp && sp.done && cur() && cur().id === s.child) { record("stories:" + s.id, "done"); SS.toast(t("kids.wellDone")); }
    else if (sp && sp.at && cur() && cur().id === s.child) record("stories:" + s.id, "started");
  }

  /* ── Explore: names, manners, pillars, iman, history ── */
  function kidLearn(el, p) {
    var topic = LEARN.filter(function (x) { return x.id === p[0]; })[0];
    if (!topic) {
      el.innerHTML = head(t("kids.tileExplore"), true) + '<div class="stack">' + LEARN.map(function (x) { return listRow("#/kids/learn/" + x.id, x.emoji, L(x.title), "learn:" + x.id); }).join("") + "</div>";
      return;
    }
    var item = "learn:" + topic.id;
    if (!isDone(item)) record(item, "started");
    if (topic.kind === "names") return flashcards(el, item, topic);
    var items = topic.kind === "knowledge" ? SS.KNOWLEDGE.foundations.filter(function (k) { return k.id === topic.k; })[0] : null;
    var html = head(L(topic.title), true) + '<article class="card kid-card guide-text"><ul class="kid-steps">';
    if (items) html += items.items.map(function (x) { return "<li>" + esc(L(x)) + "</li>"; }).join("") + "</ul>" + '<p class="tiny guide-src"><span class="badge badge-src">' + esc(t("modes.source")) + "</span> " + esc(items.src) + "</p>";
    else html += topic.items.map(function (x) { return "<li><span>" + esc(L(x)) + ' <span class="tiny">(' + esc(L(x.src)) + ")</span></span></li>"; }).join("") + "</ul>";
    el.innerHTML = html + doneBadge(item) + "</article>" + learnedBtn(item);
    wireLearned(el, function () { kidLearn(el, p); });
  }
  function flashcards(el, item, topic) {
    var names = (SS.NAMES || []).slice(0, 20), i = 0, flipped = false;
    function draw() {
      var n = names[i];
      el.innerHTML = head(L(topic.title), true) + '<p class="tiny">' + esc(t("kids.flashHelp")) + "</p>" +
        '<button class="kid-flash mt-1" type="button" id="kf-card" aria-live="polite">' +
        (flipped ? '<span><b class="h-sm">' + esc(n.tr) + "</b><br>" + esc(isAr() ? n.ar : n.en) + "</span>" : '<span class="nm-ar" lang="ar">' + esc(n.ar) + "</span>") + "</button>" +
        '<div class="row-between mt-1"><button class="btn btn-outline" type="button" id="kf-prev"' + (i ? "" : " disabled") + ">" + icon("chev-l", "flip") + "<span>" + esc(t("hajj.prev")) + "</span></button>" +
        '<span class="tiny">' + (i + 1) + " / " + names.length + "</span>" +
        '<button class="btn btn-outline" type="button" id="kf-next"' + (i < names.length - 1 ? "" : " disabled") + "><span>" + esc(t("hajj.next")) + "</span>" + icon("chev-r", "flip") + "</button></div>" +
        '<p class="tiny mt-1">' + esc(t("names.note")) + "</p>" + learnedBtn(item);
      $("kf-card").onclick = function () { flipped = !flipped; draw(); $("kf-card").focus(); };
      $("kf-prev").onclick = function () { i--; flipped = false; draw(); $("kf-prev").focus(); };
      $("kf-next").onclick = function () { i++; flipped = false; draw(); ($("kf-next").disabled ? $("kf-prev") : $("kf-next")).focus(); };
    }
    draw();
    wireLearned(el, draw);
  }

  /* ── Practice: quizzes ── */
  function kidQuiz(el, p) {
    var qz = QUIZZES.filter(function (x) { return x.id === p[0]; })[0];
    if (!qz) {
      el.innerHTML = head(t("kids.tilePractice"), true) + '<div class="stack">' + QUIZZES.map(function (x) {
        var b = bestScore("quiz:" + x.id);
        return '<a class="card widget kid-card" href="#/kids/quiz/' + x.id + '"><span class="w-ic" aria-hidden="true">' + x.emoji + '</span><span class="w-body"><span class="w-title">' + esc(L(x.title)) + '</span><span class="w-sub">' +
          esc(b != null ? f("kids.bestScore", { n: b }) : f("kids.questionsN", { n: questions(x).length })) + "</span></span>" + icon("chev-r", "chev") + "</a>";
      }).join("") + "</div>";
      return;
    }
    var qs = questions(qz), i = 0, right = 0, answered = null;
    function draw() {
      if (i >= qs.length) {
        var pct = Math.round(right / qs.length * 100);
        record("quiz:" + qz.id, "done", pct);
        el.innerHTML = head(L(qz.title), true) + '<article class="card kid-card center"><p class="k-emoji" style="font-size:3rem" aria-hidden="true">🌟</p>' +
          '<h2 class="h-sm">' + esc(f("kids.quizScore", { n: right, total: qs.length })) + "</h2><p>" + esc(t(right === qs.length ? "kids.quizPerfect" : "kids.quizGood")) + "</p>" +
          '<div class="form-row mt-2" style="justify-content:center"><a class="btn kid-big" href="#/kids/quiz">' + esc(t("kids.moreQuizzes")) + '</a><button class="btn btn-outline kid-big" type="button" id="kz-again">' + esc(t("kids.tryAgain")) + "</button></div></article>";
        $("kz-again").onclick = function () { i = 0; right = 0; answered = null; draw(); };
        $("kids-h").focus();
        return;
      }
      var q = qs[i];
      el.innerHTML = head(L(qz.title), true) + '<article class="card kid-card kid-quiz quiz-card"><p class="tiny">' + esc(f("kids.questionOf", { n: i + 1, total: qs.length })) + "</p>" +
        '<h2 class="h-sm" id="kz-q">' + esc(L(q.q)) + '</h2><div class="qz-opts mt-1" role="group" aria-labelledby="kz-q">' + q.a.map(function (a, k) {
          var cls = answered === null ? "" : k === q.c ? " right" : k === answered ? " wrong" : "";
          return '<button class="btn btn-outline' + cls + '" type="button" data-a="' + k + '"' + (answered !== null ? " disabled" : "") + ">" + esc(L(a)) +
            (answered !== null && k === q.c ? ' <span class="visually-hidden">(' + esc(t("kids.rightAnswer")) + ")</span>" : "") + "</button>";
        }).join("") + "</div>" +
        (answered !== null ? '<p class="mt-1" role="status"><b>' + esc(answered === q.c ? t("kids.correct") : f("kids.notQuite", { a: L(q.a[q.c]) })) + "</b></p>" +
          '<button class="btn kid-big mt-1" type="button" id="kz-next">' + esc(t(i === qs.length - 1 ? "kids.seeScore" : "hajj.next")) + "</button>" : "") + "</article>";
      if ($("kz-next")) { $("kz-next").onclick = function () { i++; answered = null; draw(); var b = el.querySelector("[data-a]"); if (b) b.focus(); }; $("kz-next").focus(); }
    }
    el.onclick = function (e) {
      var b = e.target.closest("[data-a]");
      if (!b || answered !== null) return;
      answered = +b.getAttribute("data-a");
      if (answered === qs[i].c) right++;
      draw();
    };
    draw();
  }
  function questions(qz) { var c = cur(); return c && c.child.age_range === "4-6" ? qz.qs.slice(0, 3) : qz.qs; }

  /* ── Today: one dua, one Name, and what to learn next ── */
  function kidToday(el) {
    var day = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
    var html = head(t("kids.today"), true) + '<div class="stack">';
    if (allowed("duas")) {
      var did = DUA_IDS[day % DUA_IDS.length], d = M.libraryDua(did);
      if (d) html += '<article class="card kid-card"><h2 class="h-sm">' + esc(t("kids.duaOfDay")) + ": " + esc(L(DUA_TITLES[did])) + '</h2><p class="arabic-dua" lang="ar" dir="rtl">' + esc(d.arabic) + "</p>" +
        '<p class="transliteration">' + esc(d.transliteration) + '</p><a class="btn btn-outline kid-big mt-1" href="#/kids/duas/' + did + '">' + esc(t("kids.learnIt")) + "</a></article>";
    }
    if (allowed("learn") && SS.NAMES && SS.NAMES.length) {
      var n = SS.NAMES[day % 20];
      html += '<article class="card kid-card"><h2 class="h-sm">' + esc(t("kids.nameOfDay")) + '</h2><p class="kid-flash" style="min-block-size:auto;cursor:default"><span><span class="nm-ar" lang="ar">' + esc(n.ar) + "</span><br><b>" + esc(n.tr) + "</b> — " + esc(isAr() ? n.ar : n.en) + "</span></p></article>";
    }
    var next = null;
    LESSONS.some(function (l) { if (allowed("prayer") && !isDone("prayer:" + l.id)) { next = ["#/kids/prayer/" + l.id, L(l.title)]; return true; } return false; });
    if (!next) SURAHS_K.some(function (k) { if (allowed("quran") && !isDone("quran:" + k)) { next = ["#/kids/quran/" + k, SS.ui.surahName(SS.SURAHS[k - 1])]; return true; } return false; });
    if (next) html += '<a class="card widget kid-card" href="' + next[0] + '"><span class="w-ic" aria-hidden="true">🚀</span><span class="w-body"><span class="w-title">' + esc(t("kids.nextUp")) + '</span><span class="w-sub">' + esc(next[1]) + "</span></span>" + icon("chev-r", "chev") + "</a>";
    el.innerHTML = html + "</div>";
  }

  /* ── Progress and achievements (when the parent shows them) ── */
  function kidProgress(el, p, c) {
    if (c.child.show_progress === false) {
      el.innerHTML = head(t("kids.tileProgress"), true) + '<div class="card kid-card">' + stateHtml("sparkle", t("kids.progressHidden")) + "</div>";
      return;
    }
    var pc = cache(c.id), items = Object.keys(pc.items).map(function (k) { return { item: k, status: pc.items[k].status }; });
    el.innerHTML = head(t("kids.tileProgress"), true) + '<article class="card kid-card">' + sectionBars(items, c.child.age_range, c.child.sections) + "</article>" +
      '<h2 class="group-label mt-2">' + esc(t("kids.achievements")) + "</h2>" + achHtml(pc.ach, false) +
      '<p class="tiny mt-1">' + esc(t("kids.achNote")) + "</p>";
  }

  /* ── Grown-ups: PIN → switch child, add a child, or leave Kids Mode ── */
  function grownups() {
    var lk = SS.store.get("kids:lock");
    if (!lk) return grownMenu();
    openDlg(t("kids.grownups"), '<form id="kid-pinform" novalidate><p>' + esc(t("kids.enterPin")) + "</p>" + pinFields("kid-pin", false) +
      '<div class="modal-actions mt-2"><button class="btn btn-ghost" type="button" id="kid-forgot">' + esc(t("kids.forgotPin")) + '</button><button class="btn" type="submit">' + esc(t("kids.unlock")) + "</button></div></form>");
    $("kid-pinform").onsubmit = function (e) {
      e.preventDefault();
      var pin = $("kid-pin").value, err = $("kid-pin-err"), btn = this.querySelector("[type=submit]");
      if (!validPin(pin)) { err.textContent = t("kids.pinRule"); $("kid-pin").setAttribute("aria-invalid", "true"); return; }
      btn.disabled = true;
      checkPin(pin).then(function (ok) {
        btn.disabled = false;
        if (ok) return grownMenu();
        err.textContent = t("kids.pinWrong"); $("kid-pin").value = ""; $("kid-pin").setAttribute("aria-invalid", "true"); $("kid-pin").focus();
      }, function (x) { btn.disabled = false; err.textContent = f("kids.pinWait", { n: x && x.wait || 60 }); });
    };
    $("kid-forgot").onclick = forgotPin;
  }
  function grownMenu() {
    var d = devStore(), c = cur();
    var kids = Object.keys(d.profiles).map(function (id) { return d.profiles[id].child; });
    openDlg(t("kids.grownups"), '<div class="stack">' +
      (kids.length > 1 ? '<section><h3 class="h-sm">' + esc(t("kids.switchChild")) + '</h3><div class="stack mt-1">' + kids.map(function (k) {
        return '<button class="btn ' + (k.id === c.id ? "" : "btn-outline ") + 'kid-big" type="button" data-switch="' + k.id + '"' + (k.id === c.id ? ' aria-pressed="true"' : "") + ">" + (AVATARS[k.avatar] || "⭐") + " " + esc(k.name) + "</button>";
      }).join("") + "</div></section>" : "") +
      '<section><h3 class="h-sm">' + esc(t("kids.addChild")) + '</h3><p class="tiny">' + esc(t("kids.addChildText")) + "</p>" +
      '<form id="kid-add" class="mt-1" novalidate><label class="visually-hidden" for="kid-add-code">' + esc(t("kids.code")) + '</label><div class="form-row"><input class="input" id="kid-add-code" autocomplete="off" autocapitalize="characters" maxlength="9" placeholder="ABCD-EFGH" aria-describedby="kid-add-err" />' +
      '<button class="btn btn-outline" type="submit">' + esc(t("kids.connect")) + '</button></div><p class="field-error" id="kid-add-err" role="alert"></p></form></section>' +
      '<section><h3 class="h-sm">' + esc(t("kids.leave")) + '</h3><p class="tiny">' + esc(t("kids.leaveText")) + "</p>" +
      '<button class="btn btn-danger mt-1" type="button" id="kid-leave">' + icon("logout") + "<span>" + esc(t("kids.leave")) + "</span></button></section></div>");
    $("kid-dlg-body").onclick = function (e) {
      var s = e.target.closest("[data-switch]");
      if (!s) return;
      var dd = devStore(); dd.active = s.getAttribute("data-switch"); saveDev(dd);
      dialog().close();
      refreshedAt = 0;
      location.hash = "#/kids";
      kidsRender([]);
    };
    $("kid-add").onsubmit = function (e) { e.preventDefault(); pairWithCode($("kid-add-code"), $("kid-add-err"), this.querySelector("[type=submit]")); };
    $("kid-leave").onclick = function () { leaveKids(false); };
  }
  /** Turn Kids Mode off on this device: save what's waiting, forget the tokens, unlock. */
  function leaveKids(force) {
    var d = devStore(), ids = Object.keys(d.profiles);
    var pending = ids.reduce(function (n, id) { return n + queue(id).length; }, 0);
    var flushAll = Promise.all(ids.map(function (id) { return flush(id).catch(function () {}); }));
    var timeout = new Promise(function (r) { setTimeout(r, 5000); });
    return Promise.race([flushAll, timeout]).then(function () {
      var left = ids.reduce(function (n, id) { return n + queue(id).length; }, 0);
      if (left && !force && !window.confirm(f("kids.unsavedConfirm", { n: left }))) return;
      ids.forEach(function (id) {
        rpc("kid_unpair", { p_token: d.profiles[id].token }).catch(function () { /* the parent can remove the device later */ });
        SS.store.remove("kids:progress:" + id);
        SS.store.remove("kids:queue:" + id);
      });
      SS.store.remove("kids:device");
      SS.store.remove("kids:lock");
      document.body.classList.remove("kids-noaudio");
      M.apply();
      if (dialog().open) dialog().close();
      SS.toast(t("kids.left"));
      location.hash = "#/family";
      return pending;
    });
  }
  /** Forgot the PIN: the parent proves who they are by signing in to their account. */
  function forgotPin() {
    if (!SS.account || !SS.account.configured()) return;
    openDlg(t("kids.forgotPin"), "<p>" + esc(t("kids.forgotText")) + '</p><div class="modal-actions mt-2"><button class="btn btn-ghost" type="button" data-close>' + esc(t("common.cancel")) + '</button><button class="btn" type="button" id="kid-forgot-go">' + esc(t("family.signIn")) + "</button></div>");
    $("kid-forgot-go").onclick = function () {
      dialog().close();
      awaitingParent = true;
      SS.account.openSignIn();
    };
  }
  var awaitingParent = false;
  document.addEventListener("ss:auth", function (e) {
    if (SS.currentView() === "family") family($("fam-root"), famParams);
    if (!awaitingParent || !e.detail.signedIn || !M.kidLocked()) return;
    awaitingParent = false;
    // Only the parent who owns these profiles may turn Kids Mode off this way.
    var mine = Object.keys(devStore().profiles);
    rpc("family_children_list").then(function (kids) {
      var own = kids.map(function (k) { return k.id; });
      if (mine.some(function (id) { return own.indexOf(id) > -1; })) return leaveKids(true);
      SS.toast(t("kids.notParent"));
      return SS.account.signOut(false);
    }).catch(function (err) { SS.toast(errText(err)); });
  });
  window.addEventListener("online", function () {
    Object.keys(devStore().profiles).forEach(function (id) { flush(id); });
  });

  SS.modeModules.kids = {
    family: family, kids: kidsRender, home: function () {}, page: function () {},
    LESSONS: LESSONS, QUIZZES: QUIZZES, LEARN: LEARN, SURAHS: SURAHS_K, DUAS: DUA_IDS, ACH: ACH,
    _test: { record: record, flush: flush, cache: cache, queue: queue, checkPin: checkPin, setPin: setPin, leave: leaveKids },
  };
})();
