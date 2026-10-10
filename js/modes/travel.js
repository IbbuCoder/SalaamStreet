/* SalaamStreet — modes/travel.js (classic script, loaded on demand)
   2.10 Travel Mode: local prayer times and Qibla wherever you are, a
   destination, saved places, travel duas, a checklist, and general guidance
   on prayer while travelling.

   Location: uses the app's own location flow (SS.geo). Nothing here asks for
   permission by itself — only the "Use my location" button does — and when
   permission is refused, searching for a place by name works the same.
   Places stay on this device ("travel:places"), like your location always has.
   Guidance: every point cites its source; where the schools differ it says so
   instead of picking one. */
(function () {
  "use strict";
  var M = SS.modes, L = M.L;
  var $ = function (id) { return document.getElementById(id); };
  function t(k) { return SS.i18n.t(k); }
  function f(k, v) { return SS.ui.f(k, v); }
  function esc(s) { return SS.esc(s); }
  function icon(n, c) { return SS.ui.icon(n, c); }
  var FIVE = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];

  /* ═══════════ Content ═══════════ */
  var GUIDE = [
    { id: "qasr", title: { en: "Shortening the prayer (qasr)", ar: "قصر الصلاة" },
      body: { en: ["While travelling, the four-rak'ah prayers — Dhuhr, Asr and Isha — may be prayed as two rak'ahs. Fajr and Maghrib are never shortened.",
        "Allah says: “When you travel through the land, there is no blame on you for shortening the prayer…” (Qur'an 4:101). When asked why this still applied in times of safety, the Prophet ﷺ said: “It is a charity that Allah has given you, so accept His charity.” (Sahih Muslim 686)"],
      ar: ["يجوز للمسافر أن يصلي الصلوات الرباعية — الظهر والعصر والعشاء — ركعتين. ولا تُقصر الفجر ولا المغرب.",
        "قال الله تعالى: ﴿وَإِذَا ضَرَبْتُمْ فِي الْأَرْضِ فَلَيْسَ عَلَيْكُمْ جُنَاحٌ أَنْ تَقْصُرُوا مِنَ الصَّلَاةِ﴾ (النساء: ١٠١). ولما سُئل النبي ﷺ عن القصر مع الأمن قال: «صدقة تصدق الله بها عليكم، فاقبلوا صدقته» (صحيح مسلم ٦٨٦)."] },
      diff: { en: "The Maliki, Shafi'i and Hanbali schools treat shortening as a recommended concession; the Hanafi school holds that a traveller must pray two rak'ahs.",
        ar: "يرى المالكية والشافعية والحنابلة أن القصر رخصة مستحبة، ويرى الحنفية أنه واجب على المسافر." },
      src: { en: "Qur'an 4:101 · Sahih Muslim 686", ar: "النساء ١٠١ · صحيح مسلم ٦٨٦" } },
    { id: "who", title: { en: "Who counts as a traveller?", ar: "من هو المسافر؟" },
      body: { en: ["You begin shortening once you have left the built-up area of your town; Anas reported that the Prophet ﷺ prayed Dhuhr as four in Madinah and Asr as two at Dhul-Hulayfah (Sahih al-Bukhari 1089). Scholars differ on the distance and on how long a stay ends the concession:"],
        ar: ["يبدأ القصر بعد مفارقة عمران البلد؛ قال أنس: صليت الظهر مع النبي ﷺ بالمدينة أربعًا، وبذي الحليفة ركعتين (صحيح البخاري ١٠٨٩). واختلف العلماء في المسافة وفي مدة الإقامة التي ينقطع بها حكم السفر:"] },
      list: { en: ["Distance: the Maliki, Shafi'i and Hanbali schools set it at four barid — roughly 80–89 km by modern estimates. The Hanafi school uses three days' travel, which modern scholars convert to roughly 77–88 km. Others, such as Ibn Taymiyyah, hold that whatever is customarily called a journey counts.",
        "Length of stay: the Maliki, Shafi'i and Hanbali schools treat someone who intends to stay four days or more (counted differently between them) as a resident; the Hanafi school sets fifteen days.",
        "If you don't know how long you will stay and keep expecting to leave, you remain a traveller. The Prophet ﷺ stayed nineteen days shortening his prayers (Sahih al-Bukhari 1080)."],
        ar: ["المسافة: حدّها المالكية والشافعية والحنابلة بأربعة بُرُد، وتقدَّر اليوم بنحو ٨٠–٨٩ كم، وحدّها الحنفية بمسيرة ثلاثة أيام، ويقدّرها المعاصرون بنحو ٧٧–٨٨ كم، ويرى آخرون كابن تيمية أن المرجع إلى ما يسميه الناس سفرًا.",
        "مدة الإقامة: يرى المالكية والشافعية والحنابلة أن من نوى إقامة أربعة أيام فأكثر (على اختلاف بينهم في العدّ) صار مقيمًا، وحدّها الحنفية بخمسة عشر يومًا.",
        "ومن لم يدرِ متى يرحل وبقي ينتظر فهو مسافر، وقد أقام النبي ﷺ تسعة عشر يومًا يقصر الصلاة (صحيح البخاري ١٠٨٠)."] },
      src: { en: "Sahih al-Bukhari 1080, 1089", ar: "صحيح البخاري ١٠٨٠، ١٠٨٩" } },
    { id: "combine", title: { en: "Combining prayers (jam')", ar: "الجمع بين الصلاتين" },
      body: { en: ["Dhuhr and Asr, and Maghrib and Isha, may be prayed together, in the time of the first or of the second. Ibn 'Abbas reported that the Prophet ﷺ combined Dhuhr with Asr, and Maghrib with Isha, when he was on a journey (Sahih al-Bukhari 1107); Mu'adh reported the same during the journey to Tabuk (Sahih Muslim 706). Fajr is never combined, and Asr is not combined with Maghrib."],
        ar: ["يجوز الجمع بين الظهر والعصر، وبين المغرب والعشاء، جمع تقديم أو تأخير. روى ابن عباس أن النبي ﷺ كان يجمع بين الظهر والعصر إذا كان على ظهر سير، ويجمع بين المغرب والعشاء (صحيح البخاري ١١٠٧)، وروى معاذ مثله في غزوة تبوك (صحيح مسلم ٧٠٦). ولا تُجمع الفجر، ولا تُجمع العصر مع المغرب."] },
      diff: { en: "Most scholars allow combining because of travel. The Hanafi school allows true combining only at Arafah and Muzdalifah during Hajj; elsewhere it permits praying the first prayer at the end of its time and the second at the start of its own. Many scholars say it is better to combine only when there is a need, such as while on the road.",
        ar: "أجاز جمهور العلماء الجمع للسفر، ولا يجيز الحنفية الجمع الحقيقي إلا بعرفة ومزدلفة في الحج، ويجيزون الجمع الصوري: صلاة الأولى آخر وقتها والثانية أول وقتها. ويرى كثير من العلماء أن الأفضل ألا يجمع إلا عند الحاجة كأن يكون سائرًا." },
      src: { en: "Sahih al-Bukhari 1107 · Sahih Muslim 706", ar: "صحيح البخاري ١١٠٧ · صحيح مسلم ٧٠٦" } },
    { id: "imam", title: { en: "Praying behind a resident imam", ar: "الصلاة خلف إمام مقيم" },
      body: { en: ["If you join a congregation whose imam prays the full prayer, pray it in full with him. Ibn 'Umar prayed four rak'ahs at Mina when praying with the imam, and two when praying alone (Sahih Muslim 694)."],
        ar: ["إذا صليت خلف إمام يُتم الصلاة فأتمّها معه، فقد كان ابن عمر إذا صلى مع الإمام بمنى صلى أربعًا، وإذا صلى وحده صلى ركعتين (صحيح مسلم ٦٩٤)."] },
      src: { en: "Sahih Muslim 694", ar: "صحيح مسلم ٦٩٤" } },
    { id: "jumuah", title: { en: "Friday (Jumu'ah) while travelling", ar: "الجمعة في السفر" },
      body: { en: ["Most scholars hold that Jumu'ah is not obligatory for a traveller, who prays Dhuhr instead; at Arafah, which fell on a Friday, the Prophet ﷺ prayed Dhuhr and Asr (Sahih Muslim 1218). If a traveller does attend Jumu'ah, it is valid and replaces Dhuhr."],
        ar: ["يرى أكثر العلماء أن الجمعة لا تجب على المسافر، فيصلي ظهرًا؛ وقد صلى النبي ﷺ بعرفة — وكان يوم جمعة — الظهر والعصر (صحيح مسلم ١٢١٨). وإن حضرها المسافر صحّت منه وأجزأته عن الظهر."] },
      src: { en: "Sahih Muslim 1218", ar: "صحيح مسلم ١٢١٨" } },
    { id: "sunnah", title: { en: "Voluntary prayers on a journey", ar: "النوافل في السفر" },
      body: { en: ["Ibn 'Umar reported that on journeys the Prophet ﷺ did not pray the regular sunnah prayers before and after the obligatory ones (Sahih Muslim 689), yet he kept praying voluntary prayers and witr on his mount, facing wherever it was heading (Sahih al-Bukhari 1000). 'A'ishah said he was more regular in the two rak'ahs before Fajr than in any other voluntary prayer (Sahih al-Bukhari 1169)."],
        ar: ["روى ابن عمر أن النبي ﷺ كان في السفر لا يصلي السنن الرواتب قبل الفرائض وبعدها (صحيح مسلم ٦٨٩)، وكان يصلي النافلة والوتر على راحلته حيث توجهت به (صحيح البخاري ١٠٠٠). وقالت عائشة: لم يكن النبي ﷺ على شيء من النوافل أشد تعاهدًا منه على ركعتي الفجر (صحيح البخاري ١١٦٩)."] },
      src: { en: "Sahih Muslim 689 · Sahih al-Bukhari 1000, 1169", ar: "صحيح مسلم ٦٨٩ · صحيح البخاري ١٠٠٠، ١١٦٩" } },
    { id: "transport", title: { en: "Obligatory prayers on a plane, train or bus", ar: "الفريضة في الطائرة والقطار والحافلة" },
      body: { en: ["If you can, pray before boarding or after arriving — combining can help. If the time would run out during the journey, pray on board: face the Qibla and stand if you are able; otherwise pray as you can. The Prophet ﷺ said: “Pray standing; if you cannot, then sitting; and if you cannot, then lying on your side.” (Sahih al-Bukhari 1117). “Allah does not burden a soul beyond what it can bear.” (Qur'an 2:286)"],
        ar: ["إن استطعت فصلِّ قبل الصعود أو بعد الوصول، وقد يعين الجمع على ذلك. فإن خشيت خروج الوقت فصلِّ في وسيلة النقل، واستقبل القبلة وقم إن استطعت، وإلا فصلِّ على قدر استطاعتك؛ قال النبي ﷺ: «صلِّ قائمًا، فإن لم تستطع فقاعدًا، فإن لم تستطع فعلى جنب» (صحيح البخاري ١١١٧)، و﴿لَا يُكَلِّفُ اللَّهُ نَفْسًا إِلَّا وُسْعَهَا﴾ (البقرة: ٢٨٦)."] },
      diff: { en: "Scholars differ on details, for example whether a prayer prayed seated on a plane because standing wasn't possible should be repeated later.",
        ar: "يختلف العلماء في التفاصيل، كإعادة الصلاة التي صُليت جلوسًا في الطائرة لتعذّر القيام." },
      src: { en: "Sahih al-Bukhari 1117 · Qur'an 2:286", ar: "صحيح البخاري ١١١٧ · البقرة ٢٨٦" } },
    { id: "wudu", title: { en: "Wiping over footwear", ar: "المسح على الخفين" },
      body: { en: ["A traveller may wipe over leather socks (khuffs) put on in a state of wudu for three days and nights; a resident for one day and night (Sahih Muslim 276)."],
        ar: ["يمسح المسافر على الخفين إذا لبسهما على طهارة ثلاثة أيام بلياليهن، والمقيم يومًا وليلة (صحيح مسلم ٢٧٦)."] },
      diff: { en: "Scholars differ on wiping over ordinary cloth socks: many allow it, others limit it to leather or thick socks.",
        ar: "اختلف العلماء في المسح على الجوارب العادية، فأجازه كثير منهم، وقصره آخرون على الخفاف أو الجوارب الثخينة." },
      src: { en: "Sahih Muslim 276", ar: "صحيح مسلم ٢٧٦" } },
    { id: "fasting", title: { en: "Fasting while travelling", ar: "الصيام في السفر" },
      body: { en: ["A traveller may leave the Ramadan fast and make it up later (Qur'an 2:184–185). The Prophet ﷺ told Hamzah al-Aslami: “Fast if you wish, and break your fast if you wish.” (Sahih al-Bukhari 1943)"],
        ar: ["يجوز للمسافر الفطر في رمضان ويقضي بعد ذلك (البقرة ١٨٤–١٨٥)، وقال النبي ﷺ لحمزة الأسلمي: «إن شئت فصم، وإن شئت فأفطر» (صحيح البخاري ١٩٤٣)."] },
      src: { en: "Qur'an 2:184–185 · Sahih al-Bukhari 1943", ar: "البقرة ١٨٤–١٨٥ · صحيح البخاري ١٩٤٣" } },
  ];

  var DUAS = [
    { title: { en: "The travel dua (when setting off)", ar: "دعاء السفر" },
      arabic: "اللَّهُ أَكْبَرُ، اللَّهُ أَكْبَرُ، اللَّهُ أَكْبَرُ، سُبْحَانَ الَّذِي سَخَّرَ لَنَا هَذَا وَمَا كُنَّا لَهُ مُقْرِنِينَ، وَإِنَّا إِلَى رَبِّنَا لَمُنْقَلِبُونَ، اللَّهُمَّ إِنَّا نَسْأَلُكَ فِي سَفَرِنَا هَذَا الْبِرَّ وَالتَّقْوَى، وَمِنَ الْعَمَلِ مَا تَرْضَى، اللَّهُمَّ هَوِّنْ عَلَيْنَا سَفَرَنَا هَذَا وَاطْوِ عَنَّا بُعْدَهُ، اللَّهُمَّ أَنْتَ الصَّاحِبُ فِي السَّفَرِ، وَالْخَلِيفَةُ فِي الْأَهْلِ، اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنْ وَعْثَاءِ السَّفَرِ، وَكَآبَةِ الْمَنْظَرِ، وَسُوءِ الْمُنْقَلَبِ فِي الْمَالِ وَالْأَهْلِ",
      transliteration: "Allahu akbar, Allahu akbar, Allahu akbar. Subhanal-ladhi sakhkhara lana hadha wa ma kunna lahu muqrinin, wa inna ila Rabbina lamunqalibun. Allahumma inna nas'aluka fi safarina hadhal-birra wat-taqwa, wa minal-'amali ma tarda. Allahumma hawwin 'alayna safarana hadha watwi 'anna bu'dah. Allahumma antas-sahibu fis-safar, wal-khalifatu fil-ahl. Allahumma inni a'udhu bika min wa'tha'is-safar, wa ka'abatil-manzar, wa su'il-munqalabi fil-mali wal-ahl.",
      meaning: { en: "Allah is the Greatest (three times). Glory be to the One who has subjected this to us, for we could never have done it ourselves, and to our Lord we will surely return. O Allah, we ask You on this journey of ours for righteousness and piety, and for deeds that please You. O Allah, make this journey easy for us and shorten its distance. O Allah, You are the Companion on the journey and the Guardian of the family. O Allah, I seek refuge in You from the hardship of travel, from a distressing sight, and from an unhappy return to my wealth and family.", ar: "" },
      source: { en: "Sahih Muslim 1342", ar: "صحيح مسلم ١٣٤٢" } },
    { title: { en: "On returning (add to the travel dua)", ar: "عند الرجوع من السفر" },
      arabic: "آيِبُونَ تَائِبُونَ عَابِدُونَ لِرَبِّنَا حَامِدُونَ",
      transliteration: "Ayibuna, ta'ibuna, 'abiduna, li Rabbina hamidun.",
      meaning: { en: "We return, repentant, worshipping, and praising our Lord.", ar: "" },
      source: { en: "Sahih Muslim 1342", ar: "صحيح مسلم ١٣٤٢" } },
    { title: { en: "When stopping at a place", ar: "عند نزول منزل" },
      arabic: "أَعُوذُ بِكَلِمَاتِ اللَّهِ التَّامَّاتِ مِنْ شَرِّ مَا خَلَقَ",
      transliteration: "A'udhu bikalimatil-lahit-tammati min sharri ma khalaq.",
      meaning: { en: "I seek refuge in the perfect words of Allah from the evil of what He has created. (Whoever says this when stopping at a place, nothing will harm him until he leaves it.)", ar: "" },
      source: { en: "Sahih Muslim 2708", ar: "صحيح مسلم ٢٧٠٨" } },
    { title: { en: "Farewell to a traveller", ar: "توديع المسافر" },
      arabic: "أَسْتَوْدِعُ اللَّهَ دِينَكَ، وَأَمَانَتَكَ، وَخَوَاتِيمَ عَمَلِكَ",
      transliteration: "Astawdi'ullaha dinaka, wa amanataka, wa khawatima 'amalik.",
      meaning: { en: "I entrust to Allah your religion, your trust, and the last of your deeds.", ar: "" },
      source: { en: "Abu Dawud 2600; At-Tirmidhi 3443 — graded sahih", ar: "أبو داود ٢٦٠٠، الترمذي ٣٤٤٣ — صحيح" } },
    { title: { en: "Going up and coming down", ar: "عند الصعود والنزول" },
      arabic: "اللَّهُ أَكْبَرُ … سُبْحَانَ اللَّهِ",
      transliteration: "Allahu akbar (going up) … Subhanallah (coming down).",
      meaning: { en: "Jabir said: “When we went up we said Allahu akbar, and when we went down we said Subhanallah.”", ar: "" },
      source: { en: "Sahih al-Bukhari 2993", ar: "صحيح البخاري ٢٩٩٣" } },
  ];

  var CHECKLIST = [
    { id: "before", title: { en: "Before leaving", ar: "قبل السفر" }, items: [
      { id: "docs", t: { en: "Passport or ID, tickets and bookings", ar: "جواز السفر أو الهوية والتذاكر والحجوزات" } },
      { id: "copies", t: { en: "Copies of important documents, kept separately", ar: "نسخ من الوثائق المهمة في مكان منفصل" } },
      { id: "family", t: { en: "Tell family your plans and say goodbye", ar: "أخبر أهلك بخطتك وودّعهم" } },
      { id: "dest", t: { en: "Add your destination in Travel Mode", ar: "أضف وجهتك في وضع السفر" } },
      { id: "offline", t: { en: "Download the Qur'an for offline reading (Settings → Offline Qur'an)", ar: "نزّل القرآن للقراءة دون اتصال (الإعدادات ← القرآن دون اتصال)" } },
      { id: "mat", t: { en: "Prayer mat, and a small bottle for wudu", ar: "سجادة صلاة وقارورة صغيرة للوضوء" } },
      { id: "meds", t: { en: "Medicines, chargers and adaptors", ar: "الأدوية والشواحن والمحوّلات" } },
    ] },
    { id: "during", title: { en: "During the journey", ar: "أثناء السفر" }, items: [
      { id: "dua", t: { en: "Say the travel dua when setting off", ar: "قل دعاء السفر عند الانطلاق" } },
      { id: "plan", t: { en: "Plan each prayer around the journey (shorten or combine if needed)", ar: "خطط لكل صلاة حسب الرحلة (قصرًا أو جمعًا عند الحاجة)" } },
      { id: "zones", t: { en: "Watch for time-zone changes when checking prayer times", ar: "انتبه لتغير المنطقة الزمنية عند مراجعة أوقات الصلاة" } },
      { id: "ask", t: { en: "Make dua — the traveller's dua is answered (Abu Dawud 1536, graded hasan)", ar: "ادعُ — فدعوة المسافر مستجابة (أبو داود ١٥٣٦، حسن)" } },
    ] },
    { id: "there", title: { en: "At your destination", ar: "عند الوصول" }, items: [
      { id: "stop", t: { en: "Say the dua for stopping at a place", ar: "قل دعاء نزول المنزل" } },
      { id: "times", t: { en: "Use your destination for prayer times", ar: "اعتمد وجهتك لأوقات الصلاة" } },
      { id: "qibla", t: { en: "Check the Qibla where you are staying", ar: "تحقق من القبلة في مكان إقامتك" } },
      { id: "mosque", t: { en: "Find the nearest mosque", ar: "ابحث عن أقرب مسجد" } },
    ] },
    { id: "return", title: { en: "Returning home", ar: "العودة إلى البيت" }, items: [
      { id: "returndua", t: { en: "Say the dua for returning", ar: "قل دعاء الرجوع" } },
      { id: "masjid", t: { en: "Pray two rak'ahs in the mosque on arrival, as the Prophet ﷺ did (Sahih Muslim 716)", ar: "صلِّ ركعتين في المسجد عند القدوم كما كان النبي ﷺ يفعل (صحيح مسلم ٧١٦)" } },
      { id: "home", t: { en: "Switch prayer times back to home", ar: "أعد أوقات الصلاة إلى مدينتك" } },
    ] },
  ];

  /* ═══════════ Places (on this device only) ═══════════ */
  function places() {
    var p = SS.store.get("travel:places");
    p = p && typeof p === "object" ? p : {};
    if (!Array.isArray(p.saved)) p.saved = [];
    p.saved = p.saved.filter(validPlace).slice(0, 20);
    if (p.dest && !validPlace(p.dest)) p.dest = null;
    if (p.home && !validPlace(p.home)) p.home = null;
    return p;
  }
  function validPlace(x) { return x && typeof x.lat === "number" && typeof x.lng === "number" && Math.abs(x.lat) <= 90 && Math.abs(x.lng) <= 180 && typeof x.label === "string"; }
  function savePlaces(p) { SS.store.set("travel:places", p); }
  function samePlace(a, b) { return a && b && a.lat === b.lat && a.lng === b.lng; }
  function placeOf(loc) { return { label: String(loc.label || "").slice(0, 80), lat: +loc.lat, lng: +loc.lng }; }

  function distKm(a, b, c, d) {
    var R = 6371, r = Math.PI / 180;
    var x = Math.sin((c - a) * r / 2), y = Math.sin((d - b) * r / 2);
    var h = x * x + Math.cos(a * r) * Math.cos(c * r) * y * y;
    return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  }
  function qiblaText(loc) {
    var b = Math.round(SS.qiblaBearing(loc.lat, loc.lng));
    return f("travel.qiblaDeg", { d: b }) + " · " + f("travel.toMakkah", { d: SS.formatDistance(distKm(loc.lat, loc.lng, SS.KAABA.lat, SS.KAABA.lng), true) });
  }
  function times(loc) {
    var s = SS.store.settings();
    return SS.api.prayerTimes({ lat: loc.lat, lng: loc.lng, method: s.method, school: s.school });
  }
  function timesList(tm) {
    return '<ul class="times-list mode-times">' + FIVE.map(function (k) {
      return '<li class="time-row"><span>' + esc(t("prayer." + k)) + "</span><b>" + esc(SS.formatTime(tm[k])) + "</b></li>";
    }).join("") + "</ul>";
  }
  function sourceNote(r) {
    return r.onDevice ? t("travel.calcOnDevice") : r.stale ? t("travel.savedTimes") : "";
  }

  /* ═══════════ How to pray while travelling (2.11.5) ═══════════ */
  // The one question Travel Mode answers. Rak'ahs: normal → while travelling.
  var RAKAH = [["Fajr", 2, 2], ["Dhuhr", 4, 2], ["Asr", 4, 2], ["Maghrib", 3, 3], ["Isha", 4, 2]];
  function rakahStrip(cls) {
    return '<ul class="' + cls + '" aria-label="' + esc(t("travel.rakahLabel")) + '">' + RAKAH.map(function (r) {
      var short = r[2] < r[1];
      return '<li' + (short ? ' class="short"' : "") + "><span>" + esc(t("prayer." + r[0])) + "</span><b>" + r[2] + "</b>" +
        '<span class="visually-hidden">' + esc(short ? f("travel.rakahShort", { n: r[1] }) : t("travel.rakahSame")) + "</span></li>";
    }).join("") + "</ul>";
  }

  /* ═══════════ The trip: when you're coming home (this device only) ═══════════ */
  function trip() {
    var v = SS.store.get("travel:trip");
    return v && typeof v === "object" && /^\d{4}-\d{2}-\d{2}$/.test(v.end || "") ? v : { end: "" };
  }
  function tripOver() {
    var e = trip().end;
    return !!e && SS.localDate(new Date()) > e;
  }
  function tripLabel(ymd) {
    var p = ymd.split("-"), d = new Date(+p[0], +p[1] - 1, +p[2]);
    try { return d.toLocaleDateString(SS.i18n.dateLocale(), { weekday: "short", day: "numeric", month: "short" }); } catch (e) { return ymd; }
  }
  /** Back home: Normal Mode, and prayer times for home again if a trip changed them. */
  function comeHome() {
    var pp = places();
    SS.store.remove("travel:trip");
    if (pp.home) { usePlace(pp.home); pp = places(); pp.home = null; savePlaces(pp); }
    M.set("normal");
    if (SS.currentView() === "home") SS.navigate(true); else location.hash = "#/home";
  }

  /* ═══════════ Home: inside the prayer card ═══════════ */
  var gen = 0, timer = null;
  function stopTimer() { clearInterval(timer); timer = null; }
  function home(el) {
    ++gen;
    var tr = trip();
    var html = "";
    if (tripOver()) {
      html += '<div class="hm-ask" role="group" aria-labelledby="tv-h-back"><p id="tv-h-back"><b>' + esc(t("travel.backHome")) + "</b> " + esc(f("travel.tripEnded", { d: tripLabel(tr.end) })) + "</p>" +
        '<div class="hm-acts"><button class="hm-btn gold" type="button" id="tv-h-home">' + esc(t("travel.imHome")) + "</button>" +
        '<button class="hm-btn" type="button" id="tv-h-still">' + esc(t("travel.stillAway")) + "</button></div></div>";
    }
    html += '<p class="hm-lead">' + esc(t("travel.shortenLead")) + "</p>" + rakahStrip("hm-rakah") +
      '<p class="hm-note">' + esc(t("travel.combineShort")) + ' <a href="#/mode/travel/guide">' + esc(t("travel.whyLink")) + "</a></p>" +
      '<div class="hm-acts"><a class="hm-btn" href="#/mode/travel">' + esc(t("travel.openTravel")) + "</a>" +
      (tr.end && !tripOver() ? '<span class="hm-meta">' + icon("calendar") + "<span>" + esc(f("travel.homeOn", { d: tripLabel(tr.end) })) + "</span></span>" : "") + "</div>";
    el.innerHTML = html;
    if ($("tv-h-home")) {
      $("tv-h-home").onclick = comeHome;
      $("tv-h-still").onclick = function () { SS.store.remove("travel:trip"); SS.toast(t("travel.stillAwayToast")); home(el); };
    }
  }

  /* ═══════════ Full page ═══════════ */
  var TABS = ["today", "places", "guide", "duas", "checklist"];
  function page(el, params) {
    stopTimer(); gen++;
    el.onclick = null;
    var tab = TABS.indexOf(params[0]) > -1 ? params[0] : "today";
    el.innerHTML = '<div class="segmented mode-tabs" id="tv-tabs" aria-label="' + esc(t("modes.sections")) + '"></div><div id="tv-body" role="tabpanel" aria-labelledby="mt-' + tab + '"></div>';
    M.tabs($("tv-tabs"), [["today", t("travel.tabToday")], ["places", t("travel.tabPlaces")], ["guide", t("travel.guidance")], ["duas", t("travel.tabDuas")], ["checklist", t("travel.checklist")]],
      tab, function (k) { location.hash = "#/mode/travel" + (k === "today" ? "" : "/" + k); });
    var body = $("tv-body");
    ({ today: today, places: placesTab, guide: guide, duas: duas, checklist: checklistTab })[tab](body);
  }

  function today(el) {
    var my = gen, p = places();
    var tr = trip();
    el.innerHTML = '<div class="mode-grid"><div class="stack">' +
      '<article class="card pray-card" aria-labelledby="tv-pray-h"><div class="card-title"><h2 id="tv-pray-h">' + esc(t("travel.howToPray")) + "</h2>" + M.offlineBadge(true) + "</div>" +
      rakahStrip("rakah-table") +
      '<p class="mt-1">' + esc(t("travel.combineShort")) + "</p>" +
      '<p class="tiny guide-src"><span class="badge badge-src">' + esc(t("modes.source")) + "</span> " + esc(t("travel.praySrc")) + "</p>" +
      '<a class="btn btn-ghost btn-sm" href="#/mode/travel/guide">' + esc(t("travel.whyLink")) + "</a></article>" +
      '<article class="card" aria-labelledby="tv-trip-h"><div class="card-title"><h2 id="tv-trip-h">' + esc(t("travel.trip")) + "</h2></div>" +
      '<form id="tv-trip" class="form-row" novalidate><label class="visually-hidden" for="tv-trip-end">' + esc(t("travel.comingHome")) + "</label>" +
      '<span class="tiny tv-trip-l" aria-hidden="true">' + esc(t("travel.comingHome")) + "</span>" +
      '<input class="input" id="tv-trip-end" type="date" value="' + esc(tr.end) + '" min="' + SS.localDate(new Date()) + '" aria-describedby="tv-trip-help" />' +
      '<button class="btn btn-sm" type="submit">' + esc(t("travel.save")) + "</button></form>" +
      '<p class="tiny" id="tv-trip-help">' + esc(t("travel.tripHelp")) + "</p>" +
      '<button class="btn btn-outline btn-sm mt-1" type="button" id="tv-im-home">' + icon("home") + "<span>" + esc(t("travel.imHome")) + "</span></button></article>" +
      '<article class="card" aria-labelledby="tv-here-h"><div class="card-title"><h2 id="tv-here-h">' + esc(t("travel.youAre")) + "</h2>" + M.offlineBadge(false) + "</div>" +
      '<p class="h-sm" id="tv-loc">…</p><p class="tiny" id="tv-loc-note"></p>' +
      '<div class="form-row mt-1"><button class="btn btn-outline btn-sm" type="button" id="tv-use-loc">' + icon("pin") + "<span>" + esc(t("travel.useLocation")) + "</span></button>" +
      '<a class="btn btn-ghost btn-sm" href="#/mode/travel/places">' + icon("search") + "<span>" + esc(t("travel.searchPlace")) + "</span></a></div></article>" +
      '<article class="card hero-lite" aria-labelledby="tv-np-h"><div class="card-title"><h2 id="tv-np-h">' + esc(t("dash.nextPrayer")) + '</h2><span class="tiny" id="tv-hijri"></span></div>' +
      '<div class="row-between"><p class="np-name" id="tv-np">…</p><p class="countdown" id="tv-cd" aria-live="off"></p></div>' +
      '<div id="tv-times" aria-busy="true">' + SS.ui.skeletons(1, 160) + '</div><p class="tiny" id="tv-src"></p></article>' +
      "</div><div class=\"stack\">" +
      '<article class="card" aria-labelledby="tv-q-h"><div class="card-title"><h2 id="tv-q-h">' + esc(t("nav.qibla")) + "</h2>" + M.offlineBadge(true) + '</div><p class="h-sm" id="tv-qibla">—</p>' +
      '<a class="btn btn-sm mt-1" href="#/qibla">' + icon("compass") + "<span>" + esc(t("travel.openCompass")) + "</span></a></article>" +
      '<article class="card" aria-labelledby="tv-d-h"><div class="card-title"><h2 id="tv-d-h">' + esc(t("travel.destination")) + '</h2></div><div id="tv-dest"></div></article>' +
      '<article class="card"><div class="card-title"><h2>' + esc(t("travel.checklist")) + '</h2></div><p id="tv-cl"></p><a class="btn btn-outline btn-sm mt-1" href="#/mode/travel/checklist">' + esc(t("travel.openChecklist")) + "</a></article>" +
      '<p class="tiny">' + esc(t("travel.offlineNote")) + "</p></div></div>";
    var c = M.checklistCount("travel:checklist", CHECKLIST);
    $("tv-cl").textContent = f("modes.doneOf", { n: c.n, total: c.total });
    $("tv-trip").onsubmit = function (e) {
      e.preventDefault();
      var v = $("tv-trip-end").value;
      if (v && /^\d{4}-\d{2}-\d{2}$/.test(v)) { SS.store.set("travel:trip", { end: v }); SS.toast(f("travel.homeOn", { d: tripLabel(v) })); }
      else { SS.store.remove("travel:trip"); SS.toast(t("settings.saved")); }
    };
    $("tv-im-home").onclick = comeHome;
    $("tv-use-loc").onclick = function () {
      SS.geo.request().then(function (loc) {
        if (!loc) SS.toast(t("travel.locDenied"));
        if (SS.currentView() === "mode") today(el);
      });
    };
    drawDest($("tv-dest"), p);
    SS.geo.resolve().then(function (loc) {
      if (my !== gen) return;
      $("tv-loc").textContent = loc.isFallback ? t("travel.noLocation") : SS.ui.locLabel(loc);
      $("tv-loc-note").textContent = loc.isFallback ? t("travel.noLocationNote") : SS.ui.locNote(loc);
      $("tv-qibla").textContent = loc.isFallback ? t("travel.noLocationQibla") : qiblaText(loc);
      return times(loc).then(function (r) {
        if (my !== gen) return;
        $("tv-times").innerHTML = timesList(r.timings);
        $("tv-times").removeAttribute("aria-busy");
        $("tv-hijri").textContent = SS.hijriLabel(r.hijri);
        $("tv-src").textContent = [loc.isFallback ? t("loc.fallbackNote") : "", sourceNote(r)].filter(Boolean).join(" ");
        countdown(r.timings, my);
      });
    }).catch(function () {
      if (my !== gen || !$("tv-times")) return;
      SS.ui.renderState($("tv-times"), { kind: "error", retry: function () { today(el); } });
    });
  }
  function countdown(tm, my) {
    stopTimer();
    function tick() {
      if (my !== gen || !$("tv-np")) return stopTimer();
      var k = SS.ui.nextPrayerKey(tm), target;
      if (k) target = SS.ui.parseTime(tm[k]);
      else { k = "Fajr"; target = SS.ui.parseTime(tm.Fajr); target.setDate(target.getDate() + 1); }
      var ms = Math.max(0, target - Date.now()), h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60;
      $("tv-np").textContent = t("prayer." + k) + " · " + SS.formatTime(tm[k]);
      $("tv-cd").textContent = (h < 10 ? "0" : "") + h + ":" + (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s;
    }
    tick();
    timer = setInterval(tick, 1000);
  }

  function drawDest(el, p) {
    if (!p.dest) {
      el.innerHTML = '<p class="muted">' + esc(t("travel.noDest")) + "</p>" + searchForm("tv-dest-form", t("travel.setDest"));
      wireSearch("tv-dest-form", function (loc) {
        var pp = places(); pp.dest = placeOf(loc); savePlaces(pp);
        SS.toast(f("travel.destSet", { p: loc.label }));
        drawDest(el, pp);
      });
      return;
    }
    var d = p.dest, cur = SS.geo.stored(), using = samePlace(cur, d);
    el.innerHTML = '<p class="h-sm">' + esc(d.label) + '</p><p class="tiny">' + esc(qiblaText(d)) + "</p>" +
      '<div id="tv-dest-times" class="mt-1" aria-busy="true">' + SS.ui.skeletons(1, 120) + "</div>" +
      '<p class="tiny" id="tv-dest-src"></p>' +
      '<div class="form-row mt-1">' + (using ? '<span class="badge">' + icon("check") + "<span>" + esc(t("travel.usingDest")) + "</span></span>"
        : '<button class="btn btn-sm" type="button" id="tv-dest-use">' + esc(t("travel.useDest")) + "</button>") +
      '<button class="btn btn-ghost btn-sm" type="button" id="tv-dest-clear">' + esc(t("travel.removeDest")) + "</button></div>";
    times(d).then(function (r) {
      if (!$("tv-dest-times")) return;
      $("tv-dest-times").innerHTML = '<p class="tiny">' + esc(t("travel.localTimeThere")) + "</p>" + timesList(r.timings);
      $("tv-dest-times").removeAttribute("aria-busy");
      $("tv-dest-src").textContent = sourceNote(r);
    }).catch(function () {
      if ($("tv-dest-times")) SS.ui.renderState($("tv-dest-times"), { kind: "error", inline: true });
    });
    if ($("tv-dest-use")) $("tv-dest-use").onclick = function () { usePlace(d); if (SS.currentView() === "mode") page($("mode-root"), []); };
    $("tv-dest-clear").onclick = function () { var pp = places(); pp.dest = null; savePlaces(pp); drawDest(el, pp); };
  }

  /** Make a place the app-wide prayer location (Home, Prayer Times, Qibla, reminders), remembering home. */
  function usePlace(pl) {
    var pp = places(), cur = SS.geo.stored();
    if (cur && !pp.home && !samePlace(cur, pl)) { pp.home = placeOf(cur); savePlaces(pp); }
    SS.store.saveSettings({ location: { lat: pl.lat, lng: pl.lng, label: pl.label, consent: "manual" } });
    try { sessionStorage.removeItem("salaamstreet:once-location"); } catch (e) { /* noop */ }
    if (SS.reminders && SS.reminders.schedule) { try { SS.reminders.schedule(); } catch (e) { /* noop */ } }
    SS.toast(f("travel.nowUsing", { p: pl.label }));
  }

  function searchForm(id, label) {
    return '<form class="mt-1" id="' + id + '" novalidate><label class="visually-hidden" for="' + id + '-q">' + esc(t("travel.placeName")) + "</label>" +
      '<div class="form-row"><input class="input" id="' + id + '-q" type="search" autocomplete="off" maxlength="80" placeholder="' + esc(t("travel.placePh")) + '" aria-describedby="' + id + '-err" />' +
      '<button class="btn btn-sm" type="submit">' + esc(label) + "</button></div>" +
      '<p class="field-error" id="' + id + '-err" role="alert"></p></form>';
  }
  function wireSearch(id, done) {
    var form = $(id);
    form.onsubmit = function (e) {
      e.preventDefault();
      var q = $(id + "-q").value.trim(), err = $(id + "-err"), btn = form.querySelector("[type=submit]");
      err.textContent = "";
      $(id + "-q").removeAttribute("aria-invalid");
      if (q.length < 2) { err.textContent = t("travel.placeTooShort"); $(id + "-q").setAttribute("aria-invalid", "true"); $(id + "-q").focus(); return; }
      btn.disabled = true;
      SS.api.geocodeCity(q).then(function (loc) { done(loc); }).catch(function () {
        err.textContent = navigator.onLine === false ? t("travel.searchOffline") : t("loc.notFound");
        $(id + "-q").setAttribute("aria-invalid", "true");
      }).finally(function () { btn.disabled = false; });
    };
  }

  function placesTab(el) {
    var p = places(), cur = SS.geo.stored();
    var row = function (pl, i, kind) {
      var using = samePlace(cur, pl);
      return '<article class="card place-row"><span class="w-ic">' + icon(kind === "home" ? "home" : "pin") + "</span>" +
        '<div class="w-body"><b class="w-title">' + esc(pl.label) + '</b><span class="w-sub">' + esc(qiblaText(pl)) + "</span></div>" +
        '<div class="place-acts">' + (using ? '<span class="badge">' + icon("check") + "<span>" + esc(t("travel.inUse")) + "</span></span>"
          : '<button class="btn btn-outline btn-sm" type="button" data-use="' + kind + ":" + i + '">' + esc(t("travel.useHere")) + "</button>") +
        (kind === "saved" ? '<button class="icon-btn" type="button" data-del="' + i + '" aria-label="' + esc(f("travel.removePlace", { p: pl.label })) + '">' + icon("trash") + "</button>" : "") +
        "</div></article>";
    };
    var html = '<div class="stack">';
    if (p.home) html += '<h2 class="group-label">' + esc(t("travel.home")) + "</h2>" + row(p.home, 0, "home");
    if (p.dest) html += '<h2 class="group-label">' + esc(t("travel.destination")) + "</h2>" + row(p.dest, 0, "dest");
    html += '<h2 class="group-label">' + esc(t("travel.saved")) + "</h2>";
    html += p.saved.length ? p.saved.map(function (pl, i) { return row(pl, i, "saved"); }).join("") : '<p class="muted">' + esc(t("travel.noSaved")) + "</p>";
    html += '<article class="card"><h2 class="h-sm">' + esc(t("travel.addPlace")) + '</h2><p class="tiny">' + esc(t("travel.addPlaceSub")) + "</p>" + searchForm("tv-add", t("travel.save")) + "</article>";
    html += '<p class="tiny">' + esc(t("travel.placesPrivacy")) + "</p></div>";
    el.innerHTML = html;
    wireSearch("tv-add", function (loc) {
      var pp = places();
      if (!pp.saved.some(function (x) { return samePlace(x, loc); })) pp.saved.unshift(placeOf(loc));
      pp.saved = pp.saved.slice(0, 20);
      savePlaces(pp);
      SS.toast(f("travel.placeSaved", { p: loc.label }));
      placesTab(el);
    });
    el.onclick = function (e) {
      var u = e.target.closest("[data-use]"), d = e.target.closest("[data-del]"), pp = places();
      if (u) {
        var parts = u.getAttribute("data-use").split(":"), pl = parts[0] === "home" ? pp.home : parts[0] === "dest" ? pp.dest : pp.saved[+parts[1]];
        if (!pl) return;
        usePlace(pl);
        if (parts[0] === "home") { pp = places(); pp.home = null; savePlaces(pp); }
        placesTab(el);
      } else if (d) {
        pp.saved.splice(+d.getAttribute("data-del"), 1);
        savePlaces(pp);
        placesTab(el);
      }
    };
  }

  function guide(el) {
    var html = '<p class="note">' + esc(t("travel.guideIntro")) + "</p>";
    GUIDE.forEach(function (g) {
      html += '<article class="card mode-section guide-text" id="tg-' + g.id + '"><h2 class="h-sm">' + esc(L(g.title)) + "</h2>";
      (g.body[SS.i18n.isAr() ? "ar" : "en"] || g.body.en).forEach(function (p) { html += "<p>" + esc(p) + "</p>"; });
      if (g.list) html += "<ul>" + (g.list[SS.i18n.isAr() ? "ar" : "en"] || g.list.en).map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>";
      if (g.diff) html += '<div class="diff"><b>' + esc(t("modes.differences")) + "</b>" + esc(L(g.diff)) + "</div>";
      html += '<p class="tiny guide-src"><span class="badge badge-src">' + esc(t("modes.source")) + "</span> " + esc(L(g.src)) + "</p></article>";
    });
    html += '<p class="consult mt-2">' + esc(t("modes.consult")) + "</p>";
    el.innerHTML = html;
  }

  function duas(el) {
    var html = '<div class="stack">';
    var lib = M.libraryDua("leaving-home");
    if (lib) html += M.duaHtml(lib);
    DUAS.forEach(function (d) { html += M.duaHtml(d); });
    html += '<a class="btn btn-outline btn-sm" href="#/duas/travel">' + esc(t("travel.moreDuas")) + "</a></div>";
    el.innerHTML = html;
  }

  function checklistTab(el) {
    el.innerHTML = '<article class="card"><div id="tv-checklist"></div></article><p class="tiny mt-1">' + esc(t("modes.checklistSync")) + "</p>";
    M.checklist($("tv-checklist"), "travel:checklist", CHECKLIST);
  }

  SS.modeModules.travel = {
    home: home, page: page, leave: function () { stopTimer(); gen++; },
    GUIDE: GUIDE, CHECKLIST: CHECKLIST, DUAS: DUAS,
  };
  // Leaving Home stops the panel's work too.
  var prevLeave = SS.leave.home;
  SS.leave.home = function () { if (prevLeave) prevLeave(); gen++; };
})();
