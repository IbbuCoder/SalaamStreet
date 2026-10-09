/* SalaamStreet — modes/hajj.js (classic script, loaded on demand)
   3.0 Hajj & Umrah Mode: step-by-step guides, the pilgrim's duas, a
   checklist and your progress.

   Content: the rites follow the Prophet's ﷺ Hajj as narrated by Jabir
   (Sahih Muslim 1218) and other cited reports. Each step names its sources,
   and where the schools differ (type of Hajj, Muzdalifah, the order of the
   rites on the 10th, the release from ihram, the nights in Mina, the
   farewell tawaf) the step says so instead of choosing one view.
   Storage (synced when signed in): "hajj:state" {type, step},
   "hajj:progress:<type>" {stepId: 1}, "hajj:checklist" {itemId: 1}. */
(function () {
  "use strict";
  var M = SS.modes, L = M.L;
  var $ = function (id) { return document.getElementById(id); };
  function t(k) { return SS.i18n.t(k); }
  function f(k, v) { return SS.ui.f(k, v); }
  function esc(s) { return SS.esc(s); }
  function icon(n, c) { return SS.ui.icon(n, c); }
  function lang() { return SS.i18n.isAr() ? "ar" : "en"; }

  /* ═══════════ Duas used in the guides ═══════════ */
  var DUAS = {
    talbiyah: { title: { en: "The talbiyah", ar: "التلبية" },
      arabic: "لَبَّيْكَ اللَّهُمَّ لَبَّيْكَ، لَبَّيْكَ لَا شَرِيكَ لَكَ لَبَّيْكَ، إِنَّ الْحَمْدَ وَالنِّعْمَةَ لَكَ وَالْمُلْكَ، لَا شَرِيكَ لَكَ",
      transliteration: "Labbayk Allahumma labbayk, labbayka la sharika laka labbayk, innal-hamda wan-ni'mata laka wal-mulk, la sharika lak.",
      meaning: { en: "Here I am, O Allah, here I am. Here I am — You have no partner — here I am. Indeed all praise, blessing and sovereignty are Yours. You have no partner.", ar: "" },
      source: { en: "Sahih al-Bukhari 1549; Sahih Muslim 1184", ar: "صحيح البخاري ١٥٤٩، صحيح مسلم ١١٨٤" } },
    blackstone: { title: { en: "At the Black Stone", ar: "عند الحجر الأسود" },
      arabic: "اللَّهُ أَكْبَرُ",
      transliteration: "Allahu akbar.",
      meaning: { en: "Allah is the Greatest — said each time you reach the Black Stone, touching it or pointing to it.", ar: "" },
      source: { en: "Sahih al-Bukhari 1613", ar: "صحيح البخاري ١٦١٣" } },
    yemeni: { title: { en: "Between the Yemeni Corner and the Black Stone", ar: "بين الركن اليماني والحجر الأسود" },
      arabic: "رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الْآخِرَةِ حَسَنَةً وَقِنَا عَذَابَ النَّارِ",
      transliteration: "Rabbana atina fid-dunya hasanatan wa fil-akhirati hasanatan wa qina 'adhaban-nar.",
      meaning: { en: "Our Lord, give us good in this world and good in the Hereafter, and protect us from the punishment of the Fire.", ar: "" },
      source: { en: "Qur'an 2:201; Abu Dawud 1892 — graded hasan", ar: "البقرة ٢٠١، أبو داود ١٨٩٢ — حسن" } },
    maqam: { title: { en: "At the Station of Ibrahim", ar: "عند مقام إبراهيم" },
      arabic: "وَاتَّخِذُوا مِنْ مَقَامِ إِبْرَاهِيمَ مُصَلًّى",
      transliteration: "Wattakhidhu min maqami Ibrahima musalla.",
      meaning: { en: "“And take the Station of Ibrahim as a place of prayer.” The Prophet ﷺ recited this before praying the two rak'ahs after tawaf.", ar: "" },
      source: { en: "Qur'an 2:125; Sahih Muslim 1218", ar: "البقرة ١٢٥، صحيح مسلم ١٢١٨" } },
    safa: { title: { en: "On Safa and Marwah", ar: "على الصفا والمروة" },
      arabic: "إِنَّ الصَّفَا وَالْمَرْوَةَ مِنْ شَعَائِرِ اللَّهِ — أَبْدَأُ بِمَا بَدَأَ اللَّهُ بِهِ\nلَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ، وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ، لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ، أَنْجَزَ وَعْدَهُ، وَنَصَرَ عَبْدَهُ، وَهَزَمَ الْأَحْزَابَ وَحْدَهُ",
      transliteration: "Innas-Safa wal-Marwata min sha'a'irillah — abda'u bima bada'allahu bih. La ilaha illallahu wahdahu la sharika lah, lahul-mulku wa lahul-hamd, wa huwa 'ala kulli shay'in qadir. La ilaha illallahu wahdah, anjaza wa'dah, wa nasara 'abdah, wa hazamal-ahzaba wahdah.",
      meaning: { en: "On approaching Safa the first time: “Indeed, as-Safa and al-Marwah are among the symbols of Allah” — “I begin with what Allah began with.” Then, facing the Ka'bah, three times with dua in between: There is no god but Allah alone, without partner; His is the dominion and His is the praise, and He is over all things capable. There is no god but Allah alone; He fulfilled His promise, gave victory to His servant, and alone defeated the confederates.", ar: "" },
      source: { en: "Qur'an 2:158; Sahih Muslim 1218", ar: "البقرة ١٥٨، صحيح مسلم ١٢١٨" } },
    arafah: { title: { en: "The best dua on the Day of Arafah", ar: "خير الدعاء يوم عرفة" },
      arabic: "لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ، وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ",
      transliteration: "La ilaha illallahu wahdahu la sharika lah, lahul-mulku wa lahul-hamd, wa huwa 'ala kulli shay'in qadir.",
      meaning: { en: "There is no god but Allah alone, without partner; His is the dominion and His is the praise, and He is over all things capable. (“The best dua is the dua of the Day of Arafah, and the best thing that I and the prophets before me have said is…”)", ar: "" },
      source: { en: "At-Tirmidhi 3585 — graded hasan", ar: "الترمذي ٣٥٨٥ — حسن" } },
    jamarat: { title: { en: "With each pebble", ar: "مع كل حصاة" },
      arabic: "اللَّهُ أَكْبَرُ",
      transliteration: "Allahu akbar.",
      meaning: { en: "Allah is the Greatest — said with each of the seven pebbles.", ar: "" },
      source: { en: "Sahih Muslim 1218; Sahih al-Bukhari 1751", ar: "صحيح مسلم ١٢١٨، صحيح البخاري ١٧٥١" } },
  };

  /* ═══════════ The guides ═══════════
     id, title, when (optional), body [paragraphs], duas [keys], diff (optional), src */
  var UMRAH = [
    { id: "u-prep", title: { en: "Preparation", ar: "الاستعداد" },
      body: { en: ["Make your intention sincerely for Allah alone, learn the rites before you travel, and settle what you owe others. Umrah can be performed at any time of the year.",
        "The Prophet ﷺ said: “One Umrah to the next is an expiation for what is between them, and an accepted Hajj has no reward but Paradise.” (Sahih al-Bukhari 1773)",
        "Check the current visa, permit and health requirements with official sources, such as Saudi Arabia's Ministry of Hajj and Umrah — they change, and SalaamStreet cannot confirm them for you."],
        ar: ["أخلص النية لله وحده، وتعلّم المناسك قبل السفر، وأدِّ ما عليك من حقوق للناس. والعمرة مشروعة في كل أيام السنة.",
        "قال النبي ﷺ: «العمرة إلى العمرة كفارة لما بينهما، والحج المبرور ليس له جزاء إلا الجنة» (صحيح البخاري ١٧٧٣).",
        "تحقّق من متطلبات التأشيرة والتصاريح والصحة من المصادر الرسمية كوزارة الحج والعمرة السعودية، فهي تتغير، ولا يستطيع سلام ستريت تأكيدها لك."] },
      src: { en: "Sahih al-Bukhari 1773", ar: "صحيح البخاري ١٧٧٣" } },
    { id: "u-ihram", title: { en: "Ihram", ar: "الإحرام" },
      body: { en: ["Ihram is the sacred state you enter with the intention of Umrah. Before it, it is Sunnah to bathe (ghusl) and, for men, to put perfume on the body but not on the ihram clothes (Sahih al-Bukhari 1539).",
        "Men wear two plain, unstitched sheets — one around the waist and one over the shoulders — and sandals, with the head uncovered. Women wear their normal modest clothing, without a face veil (niqab) or gloves (Sahih al-Bukhari 1838).",
        "While in ihram, avoid: perfume, cutting hair or nails, hunting, marital relations, and marriage contracts; men also avoid stitched clothing shaped to the body and covering the head (Sahih al-Bukhari 1542; Sahih Muslim 1409; Qur'an 2:197; 5:95)."],
        ar: ["الإحرام نية الدخول في النسك. ويُسن قبله الاغتسال، وللرجل أن يتطيب في بدنه لا في ثياب الإحرام (صحيح البخاري ١٥٣٩).",
        "يلبس الرجل إزارًا ورداءً أبيضين غير مخيطين ونعلين، ويكشف رأسه، وتلبس المرأة ثيابها المعتادة الساترة دون نقاب ولا قفازين (صحيح البخاري ١٨٣٨).",
        "ويجتنب المحرم: الطيب، وأخذ الشعر والأظفار، والصيد، والجماع، وعقد النكاح، ويجتنب الرجل المخيط الذي يُفصّل على البدن وتغطية الرأس (صحيح البخاري ١٥٤٢، صحيح مسلم ١٤٠٩، البقرة ١٩٧، المائدة ٩٥)."] },
      diff: { en: "Many scholars recommend praying two rak'ahs before entering ihram; others say there is no prayer specific to ihram and recommend entering it after an obligatory prayer.",
        ar: "يستحب كثير من العلماء صلاة ركعتين قبل الإحرام، ويرى آخرون أنه لا صلاة تخصه، ويستحبون الإحرام عقب صلاة فريضة." },
      src: { en: "Sahih al-Bukhari 1539, 1542, 1838 · Sahih Muslim 1409 · Qur'an 2:197, 5:95", ar: "صحيح البخاري ١٥٣٩، ١٥٤٢، ١٨٣٨ · صحيح مسلم ١٤٠٩ · البقرة ١٩٧ · المائدة ٩٥" } },
    { id: "u-miqat", title: { en: "The Miqat", ar: "الميقات" },
      body: { en: ["The miqat is the boundary at which pilgrims must be in ihram. The Prophet ﷺ set Dhul-Hulayfah for the people of Madinah, al-Juhfah for the people of Syria, Qarn al-Manazil for the people of Najd and Yalamlam for the people of Yemen — “for them and for whoever passes through them” (Sahih al-Bukhari 1524). Dhat 'Irq is the miqat for those coming from Iraq and the east (Sahih Muslim 1183; Sahih al-Bukhari 1531 reports that 'Umar set it).",
        "Flying in? Enter ihram before the plane passes over or level with your miqat. Many pilgrims change into ihram clothes before boarding and make the intention when the miqat is announced.",
        "The intention for Umrah: “Labbayka 'umrah” — Here I am, O Allah, for Umrah."],
        ar: ["الميقات هو الحد الذي لا يتجاوزه الحاج أو المعتمر إلا محرمًا. وقّت النبي ﷺ لأهل المدينة ذا الحليفة، ولأهل الشام الجحفة، ولأهل نجد قرن المنازل، ولأهل اليمن يلملم، «هن لهن ولمن أتى عليهن من غير أهلهن» (صحيح البخاري ١٥٢٤)، وذات عرق لأهل العراق والمشرق (صحيح مسلم ١١٨٣، وفي صحيح البخاري ١٥٣١ أن عمر وقّتها).",
        "إن كنت مسافرًا بالطائرة فأحرم قبل أن تحاذي الميقات أو تمر فوقه، ويلبس كثير من الحجاج ثياب الإحرام قبل الصعود ثم ينوون عند الإعلان عن الميقات.",
        "ونية العمرة: «لبيك عمرة»."] },
      src: { en: "Sahih al-Bukhari 1524, 1531 · Sahih Muslim 1183", ar: "صحيح البخاري ١٥٢٤، ١٥٣١ · صحيح مسلم ١١٨٣" } },
    { id: "u-talbiyah", title: { en: "The Talbiyah", ar: "التلبية" },
      body: { en: ["Once in ihram, recite the talbiyah often — men aloud (Abu Dawud 1814, graded sahih), women quietly — until you begin tawaf."],
        ar: ["بعد الإحرام أكثر من التلبية، يرفع الرجل بها صوته (أبو داود ١٨١٤، صحيح) وتُسرّ بها المرأة، حتى تبدأ الطواف."] },
      duas: ["talbiyah"],
      diff: { en: "Most scholars say a pilgrim performing Umrah stops the talbiyah on starting tawaf; some say on reaching the boundary of the Haram.",
        ar: "يرى أكثر العلماء أن المعتمر يقطع التلبية إذا شرع في الطواف، وقال بعضهم: إذا دخل الحرم." },
      src: { en: "Sahih al-Bukhari 1549 · Sahih Muslim 1184 · Abu Dawud 1814", ar: "صحيح البخاري ١٥٤٩ · صحيح مسلم ١١٨٤ · أبو داود ١٨١٤" } },
    { id: "u-tawaf", title: { en: "Tawaf", ar: "الطواف" },
      body: { en: ["Enter al-Masjid al-Haram with your right foot, say the dua for entering the mosque, and be in a state of wudu.",
        "Start at the Black Stone: touch or kiss it if you can easily, otherwise point to it, saying “Allahu akbar” (Sahih al-Bukhari 1613). Walk around the Ka'bah seven times, anticlockwise, keeping it on your left; each circuit begins and ends at the Black Stone.",
        "During this tawaf men uncover the right shoulder (idtiba' — Abu Dawud 1883) and walk briskly in the first three circuits (raml — Sahih Muslim 1218).",
        "There is no fixed dua for each circuit: make dua and dhikr in any language. Between the Yemeni Corner and the Black Stone say “Rabbana atina…”.",
        "After the seventh circuit, cover your shoulder and pray two rak'ahs behind the Station of Ibrahim if you can — anywhere in the mosque is fine — reciting al-Kafirun and al-Ikhlas, then drink Zamzam (Sahih Muslim 1218)."],
        ar: ["ادخل المسجد الحرام برجلك اليمنى، وقل دعاء دخول المسجد، وكن على طهارة.",
        "ابدأ من الحجر الأسود: استلمه أو قبّله إن تيسر وإلا فأشر إليه مكبّرًا (صحيح البخاري ١٦١٣)، وطف بالكعبة سبعة أشواط جاعلًا إياها عن يسارك، يبدأ كل شوط وينتهي عند الحجر الأسود.",
        "ويضطبع الرجل في هذا الطواف — يكشف كتفه الأيمن — (أبو داود ١٨٨٣)، ويرمل في الأشواط الثلاثة الأولى (صحيح مسلم ١٢١٨).",
        "ليس لكل شوط دعاء مخصوص، فادعُ واذكر الله بما شئت وبأي لغة، وقل بين الركن اليماني والحجر الأسود: «ربنا آتنا…».",
        "فإذا أتممت السابع فغطِّ كتفك وصلِّ ركعتين خلف مقام إبراهيم إن تيسر، وإلا ففي أي مكان من المسجد، تقرأ فيهما الكافرون والإخلاص، ثم اشرب من زمزم (صحيح مسلم ١٢١٨)."] },
      duas: ["blackstone", "yemeni", "maqam"],
      diff: { en: "Most scholars hold that wudu is a condition of tawaf; the Hanafi school treats it as obligatory but not a condition of validity, and some scholars, including Ibn Taymiyyah, did not require it. A woman who is menstruating does everything a pilgrim does except tawaf until she is pure (Sahih al-Bukhari 305).",
        ar: "يرى جمهور العلماء أن الطهارة شرط لصحة الطواف، ويراها الحنفية واجبة لا شرطًا، ولم يشترطها بعض العلماء كابن تيمية. والحائض تفعل ما يفعل الحاج غير ألا تطوف بالبيت حتى تطهر (صحيح البخاري ٣٠٥)." },
      src: { en: "Sahih al-Bukhari 305, 1613 · Sahih Muslim 1218 · Abu Dawud 1883", ar: "صحيح البخاري ٣٠٥، ١٦١٣ · صحيح مسلم ١٢١٨ · أبو داود ١٨٨٣" } },
    { id: "u-sai", title: { en: "Sa'i between Safa and Marwah", ar: "السعي بين الصفا والمروة" },
      body: { en: ["Go to Safa. As you approach it the first time, recite “Indeed, as-Safa and al-Marwah are among the symbols of Allah” and say “I begin with what Allah began with.” Climb it, face the Ka'bah, and say the dhikr below three times, making dua in between (Sahih Muslim 1218).",
        "Walk to Marwah — men hurry between the green markers — and do the same on Marwah. Safa to Marwah is one lap and Marwah back to Safa the second; the seventh lap ends at Marwah."],
        ar: ["توجّه إلى الصفا، فإذا دنوت منه أول مرة فاقرأ ﴿إِنَّ الصَّفَا وَالْمَرْوَةَ مِنْ شَعَائِرِ اللَّهِ﴾ وقل: «أبدأ بما بدأ الله به»، ثم اصعد واستقبل الكعبة وقل الذكر الآتي ثلاثًا وادعُ بين ذلك (صحيح مسلم ١٢١٨).",
        "ثم امشِ إلى المروة — ويسعى الرجل بين العلمين الأخضرين — وافعل على المروة كما فعلت على الصفا. من الصفا إلى المروة شوط، ورجوعك إلى الصفا شوط ثانٍ، وينتهي السابع بالمروة."] },
      duas: ["safa"],
      diff: { en: "Most scholars count sa'i as a pillar of Umrah and Hajj; the Hanafi school counts it as obligatory (wajib). Wudu is recommended for sa'i but not required.",
        ar: "السعي ركن في العمرة والحج عند الجمهور، وواجب عند الحنفية. وتستحب له الطهارة ولا تشترط." },
      src: { en: "Qur'an 2:158 · Sahih Muslim 1218", ar: "البقرة ١٥٨ · صحيح مسلم ١٢١٨" } },
    { id: "u-done", title: { en: "Shaving or shortening — completion", ar: "الحلق أو التقصير — التحلل" },
      body: { en: ["Men shave the head or shorten the hair from all over it; shaving is better — the Prophet ﷺ prayed three times for those who shave and then for those who shorten (Sahih al-Bukhari 1727). Women only shorten, never shave (Abu Dawud 1985); scholars commonly say about a fingertip's length from the ends.",
        "With this your Umrah is complete, and everything ihram forbade is permitted again. May Allah accept it from you."],
        ar: ["يحلق الرجل رأسه أو يقصّر من جميعه، والحلق أفضل؛ فقد دعا النبي ﷺ للمحلّقين ثلاثًا ثم للمقصّرين (صحيح البخاري ١٧٢٧). والمرأة تقصّر ولا تحلق (أبو داود ١٩٨٥)، ويذكر العلماء أنها تأخذ قدر أنملة من أطراف شعرها.",
        "وبهذا تمت عمرتك، وحلّ لك كل ما حرم بالإحرام. تقبّل الله منك."] },
      src: { en: "Sahih al-Bukhari 1727 · Abu Dawud 1985", ar: "صحيح البخاري ١٧٢٧ · أبو داود ١٩٨٥" } },
  ];

  var HAJJ = [
    { id: "h-prep", title: { en: "Preparation and the three types of Hajj", ar: "الاستعداد وأنواع النسك" },
      body: { en: ["Hajj is a pillar of Islam, due once in a lifetime from every adult Muslim who is able (Qur'an 3:97). Its rites take place on 8–13 Dhul-Hijjah.",
        "There are three ways to perform it (Sahih Muslim 1211). Tamattu': Umrah in the months of Hajj, leave ihram, then a new ihram for Hajj on the 8th — a sacrifice is due. Qiran: Umrah and Hajj together in one ihram — a sacrifice is due. Ifrad: Hajj alone — no sacrifice is due. This guide follows Tamattu', the most common today, and notes where the others differ.",
        "Check the current permit, visa and health requirements with official sources, such as Saudi Arabia's Ministry of Hajj and Umrah, and follow your group's instructions on times and routes."],
        ar: ["الحج ركن من أركان الإسلام، يجب مرة في العمر على كل مسلم بالغ مستطيع (آل عمران ٩٧)، وتؤدى مناسكه من الثامن إلى الثالث عشر من ذي الحجة.",
        "وأنساكه ثلاثة (صحيح مسلم ١٢١١): التمتع: عمرة في أشهر الحج ثم التحلل ثم الإحرام بالحج يوم الثامن، وعليه هدي. والقران: الإحرام بالعمرة والحج معًا، وعليه هدي. والإفراد: الإحرام بالحج وحده، ولا هدي عليه. يتبع هذا الدليل التمتع لأنه الأكثر اليوم، ويبيّن مواضع الاختلاف.",
        "تحقّق من متطلبات التصاريح والتأشيرة والصحة من المصادر الرسمية كوزارة الحج والعمرة السعودية، واتبع تعليمات حملتك في المواعيد والطرق."] },
      diff: { en: "Scholars differ on which type is best: the Hanbali school prefers Tamattu', the Hanafi school Qiran, and the Maliki and Shafi'i schools Ifrad.",
        ar: "اختلف العلماء في الأفضل: فالتمتع أفضل عند الحنابلة، والقران عند الحنفية، والإفراد عند المالكية والشافعية." },
      src: { en: "Qur'an 3:97 · Sahih Muslim 1211", ar: "آل عمران ٩٧ · صحيح مسلم ١٢١١" } },
    { id: "h-arrive", title: { en: "Arriving in Makkah", ar: "القدوم إلى مكة" },
      body: { en: ["Tamattu': enter ihram for Umrah at the miqat and perform it — tawaf, sa'i, then shortening the hair (many shorten so that they can shave at the end of Hajj). Then leave ihram until the 8th. The Umrah guide walks through each step.",
        "Qiran or Ifrad: enter ihram for Hajj (and Umrah, for Qiran) at the miqat, perform the arrival tawaf (tawaf al-qudum), and stay in ihram until the 10th. You may do the sa'i of Hajj now, after this tawaf, instead of after Tawaf al-Ifadah."],
        ar: ["المتمتع: يحرم بالعمرة من الميقات ويؤديها — طوافًا وسعيًا ثم تقصيرًا (ويقصّر كثيرون ليحلقوا في آخر الحج) — ثم يتحلل إلى يوم الثامن. وفي دليل العمرة تفصيل كل خطوة.",
        "القارن والمفرد: يحرم بالحج (وبالعمرة معه للقارن) من الميقات، ويطوف طواف القدوم، ويبقى محرمًا إلى يوم النحر، وله أن يسعى سعي الحج بعد هذا الطواف بدلًا من سعيه بعد طواف الإفاضة."] },
      duas: ["talbiyah"],
      src: { en: "Sahih Muslim 1211, 1218", ar: "صحيح مسلم ١٢١١، ١٢١٨" } },
    { id: "h-mina", title: { en: "Ihram for Hajj and Mina", ar: "الإحرام بالحج والتوجه إلى منى" }, when: { en: "8 Dhul-Hijjah — the Day of Tarwiyah", ar: "الثامن من ذي الحجة — يوم التروية" },
      body: { en: ["Pilgrims performing Tamattu' enter ihram for Hajj from where they are staying, as the Companions did, and begin the talbiyah: “Labbayka hajj.”",
        "Go to Mina and pray Dhuhr, Asr, Maghrib, Isha and the next morning's Fajr there, each in its own time, shortening the four-rak'ah prayers without combining them (Sahih Muslim 1218)."],
        ar: ["يحرم المتمتع بالحج من مكانه الذي هو فيه كما فعل الصحابة، ويبدأ التلبية: «لبيك حجًّا».",
        "ثم يتوجه إلى منى فيصلي بها الظهر والعصر والمغرب والعشاء وفجر اليوم التالي، كل صلاة في وقتها، قصرًا بلا جمع (صحيح مسلم ١٢١٨)."] },
      duas: ["talbiyah"],
      diff: { en: "According to the majority of scholars, staying in Mina on the 8th is a Sunnah, not a requirement.",
        ar: "المبيت بمنى ليلة التاسع سنة لا واجب عند جمهور العلماء." },
      src: { en: "Sahih Muslim 1218", ar: "صحيح مسلم ١٢١٨" } },
    { id: "h-arafah", title: { en: "Standing at Arafah", ar: "الوقوف بعرفة" }, when: { en: "9 Dhul-Hijjah — the Day of Arafah", ar: "التاسع من ذي الحجة — يوم عرفة" },
      body: { en: ["After sunrise, go to Arafah. Pray Dhuhr and Asr there, shortened and combined at the time of Dhuhr (Sahih Muslim 1218).",
        "Then spend the afternoon facing the Qibla in dua and remembrance until sunset, making sure you are inside the boundaries of Arafah. Standing at Arafah is the heart of Hajj: the Prophet ﷺ said, “Hajj is Arafah.” (At-Tirmidhi 889, graded sahih)",
        "After sunset, leave calmly for Muzdalifah."],
        ar: ["بعد طلوع الشمس توجّه إلى عرفة، وصلِّ بها الظهر والعصر قصرًا وجمع تقديم (صحيح مسلم ١٢١٨).",
        "ثم تفرّغ للدعاء والذكر مستقبلًا القبلة حتى غروب الشمس، وتأكد أنك داخل حدود عرفة؛ فالوقوف بعرفة ركن الحج الأعظم، قال النبي ﷺ: «الحج عرفة» (الترمذي ٨٨٩، صحيح).",
        "وبعد الغروب انصرف إلى مزدلفة بسكينة."] },
      duas: ["arafah", "talbiyah"],
      diff: { en: "Scholars differ on when the time of standing begins (the majority: after midday on the 9th; the Hanbali school: from dawn) and on what is owed by someone who leaves Arafah before sunset.",
        ar: "اختلف العلماء في بداية وقت الوقوف (فعند الجمهور من الزوال، وعند الحنابلة من فجر التاسع)، وفيما يلزم من انصرف قبل الغروب." },
      src: { en: "Sahih Muslim 1218 · At-Tirmidhi 889, 3585", ar: "صحيح مسلم ١٢١٨ · الترمذي ٨٨٩، ٣٥٨٥" } },
    { id: "h-muzdalifah", title: { en: "The night at Muzdalifah", ar: "المبيت بمزدلفة" }, when: { en: "The night before 10 Dhul-Hijjah", ar: "ليلة العاشر من ذي الحجة" },
      body: { en: ["At Muzdalifah, pray Maghrib and Isha together, with Isha shortened. Rest, pray Fajr early, then remember Allah and make dua at al-Mash'ar al-Haram until the sky is quite bright (Qur'an 2:198; Sahih Muslim 1218).",
        "Pick up small pebbles for the stoning — they may be gathered here or in Mina."],
        ar: ["في مزدلفة صلِّ المغرب والعشاء جمعًا مع قصر العشاء، ثم نم، وصلِّ الفجر في أول وقتها، ثم اذكر الله وادعه عند المشعر الحرام حتى يسفر جدًّا (البقرة ١٩٨، صحيح مسلم ١٢١٨).",
        "والتقط حصى الجمار الصغيرة، ويجوز التقاطها من مزدلفة أو من منى."] },
      diff: { en: "Scholars differ on how long one must stay at Muzdalifah — some require most of the night, others a shorter stop. The Prophet ﷺ allowed the weak, and those looking after them, to leave after the middle of the night (Sahih al-Bukhari 1676–1681).",
        ar: "اختلف العلماء في القدر الواجب من المبيت بمزدلفة، فمنهم من أوجب أكثر الليل، ومنهم من اكتفى بأقل من ذلك. وقد أذن النبي ﷺ للضعفة ومن معهم في الدفع بعد منتصف الليل (صحيح البخاري ١٦٧٦–١٦٨١)." },
      src: { en: "Qur'an 2:198 · Sahih Muslim 1218 · Sahih al-Bukhari 1676–1681", ar: "البقرة ١٩٨ · صحيح مسلم ١٢١٨ · صحيح البخاري ١٦٧٦–١٦٨١" } },
    { id: "h-aqabah", title: { en: "Stoning Jamrat al-Aqabah", ar: "رمي جمرة العقبة" }, when: { en: "10 Dhul-Hijjah — the Day of Sacrifice", ar: "العاشر من ذي الحجة — يوم النحر" },
      body: { en: ["Before sunrise, set off for Mina. Throw seven small pebbles, one at a time, at Jamrat al-Aqabah (the large pillar nearest Makkah), saying “Allahu akbar” with each (Sahih Muslim 1218). The talbiyah stops when you begin throwing (Sahih Muslim 1281)."],
        ar: ["ادفع إلى منى قبل طلوع الشمس، وارمِ جمرة العقبة (وهي الأقرب إلى مكة) بسبع حصيات متعاقبات، تكبّر مع كل حصاة (صحيح مسلم ١٢١٨)، وتقطع التلبية عند بدء الرمي (صحيح مسلم ١٢٨١)."] },
      duas: ["jamarat"],
      src: { en: "Sahih Muslim 1218, 1281", ar: "صحيح مسلم ١٢١٨، ١٢٨١" } },
    { id: "h-sacrifice", title: { en: "The sacrifice (hady)", ar: "ذبح الهدي" }, when: { en: "10 Dhul-Hijjah, or the days after", ar: "يوم النحر أو أيام التشريق" },
      body: { en: ["Pilgrims performing Tamattu' or Qiran offer a sacrifice — today usually arranged through an official voucher programme. Anyone who cannot afford it fasts three days during Hajj and seven after returning home (Qur'an 2:196)."],
        ar: ["يذبح المتمتع والقارن هديًا، ويُرتَّب ذلك اليوم غالبًا عبر برنامج رسمي للهدي والأضاحي، ومن لم يجد فصيام ثلاثة أيام في الحج وسبعة إذا رجع (البقرة ١٩٦)."] },
      src: { en: "Qur'an 2:196", ar: "البقرة ١٩٦" } },
    { id: "h-halq", title: { en: "Shaving or shortening — the first release", ar: "الحلق أو التقصير — التحلل الأول" }, when: { en: "10 Dhul-Hijjah", ar: "يوم النحر" },
      body: { en: ["Men shave the head (better) or shorten the hair; women shorten a little from the ends, as in Umrah.",
        "After this, everything ihram forbade becomes permitted except marital relations — the first release. 'A'ishah perfumed the Prophet ﷺ “for his release, before he performed tawaf of the House” (Sahih al-Bukhari 1539)."],
        ar: ["يحلق الرجل رأسه — وهو أفضل — أو يقصّر، وتقصّر المرأة من أطراف شعرها كما في العمرة.",
        "وبه يحل للحاج كل شيء إلا النساء، وهو التحلل الأول؛ قالت عائشة: كنت أطيّب رسول الله ﷺ «لحِلّه قبل أن يطوف بالبيت» (صحيح البخاري ١٥٣٩)."] },
      diff: { en: "The Sunnah order on the 10th is stoning, sacrifice, shaving, then tawaf. When people asked the Prophet ﷺ about doing these out of order he said, “Do it — there is no harm” (Sahih al-Bukhari 1736; Sahih Muslim 1306). Scholars differ on whether the first release comes after two of stoning, shaving and tawaf, or after stoning alone.",
        ar: "الترتيب المسنون يوم النحر: الرمي ثم النحر ثم الحلق ثم الطواف، وما سُئل النبي ﷺ يومئذ عن شيء قُدّم أو أُخّر إلا قال: «افعل ولا حرج» (صحيح البخاري ١٧٣٦، صحيح مسلم ١٣٠٦). واختلف العلماء: هل يحصل التحلل الأول بفعل اثنين من الرمي والحلق والطواف، أم بالرمي وحده؟" },
      src: { en: "Sahih al-Bukhari 1539, 1736 · Sahih Muslim 1306", ar: "صحيح البخاري ١٥٣٩، ١٧٣٦ · صحيح مسلم ١٣٠٦" } },
    { id: "h-ifadah", title: { en: "Tawaf al-Ifadah and sa'i", ar: "طواف الإفاضة والسعي" }, when: { en: "10 Dhul-Hijjah or after", ar: "يوم النحر أو بعده" },
      body: { en: ["Go to Makkah and perform Tawaf al-Ifadah — a pillar of Hajj (Qur'an 22:29) — like the Umrah tawaf but without uncovering the shoulder or walking briskly. Then perform sa'i between Safa and Marwah; pilgrims of Qiran or Ifrad who already did sa'i after their arrival tawaf do not repeat it (Sahih Muslim 1218).",
        "After this, every restriction of ihram is lifted — the full release."],
        ar: ["توجّه إلى مكة وطف طواف الإفاضة، وهو ركن الحج (الحج ٢٩)، كطواف العمرة لكن بلا اضطباع ولا رمل، ثم اسعَ بين الصفا والمروة، ومن سعى من القارنين والمفردين بعد طواف القدوم لم يُعِد السعي (صحيح مسلم ١٢١٨).",
        "وبه يحل للحاج كل شيء، وهو التحلل الثاني."] },
      duas: ["blackstone", "yemeni", "safa"],
      diff: { en: "Scholars allow Tawaf al-Ifadah to be delayed past the 10th, and differ on how late it may be left without anything owed.",
        ar: "أجاز العلماء تأخير طواف الإفاضة عن يوم النحر، واختلفوا في آخر وقته الذي لا يلزم بتأخيره شيء." },
      src: { en: "Qur'an 22:29 · Sahih Muslim 1218", ar: "الحج ٢٩ · صحيح مسلم ١٢١٨" } },
    { id: "h-tashreeq", title: { en: "The days in Mina", ar: "أيام التشريق بمنى" }, when: { en: "11–13 Dhul-Hijjah — the Days of Tashreeq", ar: "١١–١٣ ذي الحجة — أيام التشريق" },
      body: { en: ["Spend the nights in Mina. Each day after midday, stone all three jamarat in order — the small one, then the middle one, then Jamrat al-Aqabah — seven pebbles each with “Allahu akbar”. After the first and second, step aside, face the Qibla and make a long dua (Sahih al-Bukhari 1751).",
        "You may leave Mina after stoning on the 12th, before sunset, or stay and stone on the 13th as well: “Whoever hastens in two days, there is no sin upon him; and whoever delays, there is no sin upon him” (Qur'an 2:203)."],
        ar: ["بِت لياليها بمنى، وارمِ كل يوم بعد الزوال الجمرات الثلاث مرتبة: الصغرى ثم الوسطى ثم العقبة، كل واحدة بسبع حصيات تكبّر مع كل حصاة، وقف بعد الأولى والثانية مستقبلًا القبلة تدعو طويلًا (صحيح البخاري ١٧٥١).",
        "ولك أن تتعجل فتخرج من منى بعد رمي اليوم الثاني عشر قبل الغروب، أو تتأخر فترمي يوم الثالث عشر: ﴿فَمَنْ تَعَجَّلَ فِي يَوْمَيْنِ فَلَا إِثْمَ عَلَيْهِ وَمَنْ تَأَخَّرَ فَلَا إِثْمَ عَلَيْهِ﴾ (البقرة ٢٠٣)."] },
      duas: ["jamarat"],
      diff: { en: "Spending the nights in Mina is obligatory according to the majority and a Sunnah according to the Hanafi school. Those with a valid excuse — the ill, those caring for them, or anyone who cannot reach the jamarat — may appoint someone to stone for them.",
        ar: "المبيت بمنى ليالي التشريق واجب عند الجمهور وسنة عند الحنفية، ويجوز لصاحب العذر — كالمريض ومن يقوم عليه ومن لا يستطيع الوصول إلى الجمرات — أن يوكّل من يرمي عنه." },
      src: { en: "Sahih al-Bukhari 1751 · Qur'an 2:203", ar: "صحيح البخاري ١٧٥١ · البقرة ٢٠٣" } },
    { id: "h-farewell", title: { en: "The farewell tawaf", ar: "طواف الوداع" }, when: { en: "Before leaving Makkah", ar: "قبل مغادرة مكة" },
      body: { en: ["Before you leave Makkah, perform a farewell tawaf so that your last moments are at the House; only women who are menstruating are excused (Sahih al-Bukhari 1755). No sa'i follows it.",
        "May Allah accept your Hajj. The Prophet ﷺ said: “Whoever performs Hajj for Allah and does not commit obscenity or sin returns like the day his mother bore him.” (Sahih al-Bukhari 1521)"],
        ar: ["إذا أردت السفر من مكة فطف طواف الوداع ليكون آخر عهدك بالبيت، وقد خُفّف عن الحائض (صحيح البخاري ١٧٥٥)، ولا سعي بعده.",
        "تقبّل الله حجك، قال النبي ﷺ: «من حج لله فلم يرفث ولم يفسق رجع كيوم ولدته أمه» (صحيح البخاري ١٥٢١)."] },
      diff: { en: "Most scholars hold the farewell tawaf to be obligatory; the Maliki school holds it to be a Sunnah.",
        ar: "طواف الوداع واجب عند جمهور العلماء، وسنة عند المالكية." },
      src: { en: "Sahih al-Bukhari 1521, 1755", ar: "صحيح البخاري ١٥٢١، ١٧٥٥" } },
  ];
  var GUIDES = { umrah: UMRAH, hajj: HAJJ };

  var CHECKLIST = [
    { id: "docs", title: { en: "Documents", ar: "الوثائق" }, items: [
      { id: "passport", t: { en: "Passport, visa and any required permit — checked against official requirements", ar: "جواز السفر والتأشيرة والتصاريح المطلوبة — بعد التحقق من المتطلبات الرسمية" } },
      { id: "health", t: { en: "Vaccination and health certificates required for your trip", ar: "شهادات التطعيم والصحة المطلوبة لرحلتك" } },
      { id: "copies", t: { en: "Copies of documents, kept separately", ar: "نسخ من الوثائق في مكان منفصل" } },
      { id: "contacts", t: { en: "Your group's contacts, hotel address and emergency numbers", ar: "أرقام حملتك وعنوان الفندق وأرقام الطوارئ" } },
    ] },
    { id: "gear", title: { en: "Ihram and packing", ar: "الإحرام والأمتعة" }, items: [
      { id: "ihram", t: { en: "Ihram sheets (men) or comfortable modest clothing (women)", ar: "ثياب الإحرام للرجل، وثياب ساترة مريحة للمرأة" } },
      { id: "sandals", t: { en: "Comfortable sandals and a waist pouch", ar: "نعلان مريحان وحقيبة خصر" } },
      { id: "unscented", t: { en: "Unscented soap, deodorant and sunscreen", ar: "صابون ومزيل عرق وواقي شمس بلا رائحة" } },
      { id: "water", t: { en: "A refillable water bottle", ar: "قارورة ماء قابلة لإعادة التعبئة" } },
      { id: "meds", t: { en: "Medicines and prescriptions", ar: "الأدوية والوصفات الطبية" } },
      { id: "pebbles", t: { en: "A small bag for pebbles (Hajj)", ar: "كيس صغير للحصى (للحج)" } },
    ] },
    { id: "heart", title: { en: "Heart and knowledge", ar: "القلب والعلم" }, items: [
      { id: "learn", t: { en: "Learn the steps of your Umrah or Hajj", ar: "تعلّم خطوات عمرتك أو حجك" } },
      { id: "duas", t: { en: "Learn the talbiyah and the key duas", ar: "احفظ التلبية والأدعية الأساسية" } },
      { id: "debts", t: { en: "Settle debts, write down what you owe and are owed, and leave a will", ar: "اقضِ الديون، واكتب ما لك وما عليك، واكتب وصيتك" } },
      { id: "forgive", t: { en: "Seek forgiveness from people you may have wronged", ar: "تحلّل ممن قد تكون ظلمته" } },
    ] },
    { id: "ihramday", title: { en: "Before ihram", ar: "قبل الإحرام" }, items: [
      { id: "nails", t: { en: "Trim nails and remove unwanted hair", ar: "قصّ الأظفار وإزالة الشعر المسنون إزالته" } },
      { id: "ghusl", t: { en: "Bathe (ghusl)", ar: "الاغتسال" } },
      { id: "miqat", t: { en: "Know where your miqat is on your route", ar: "اعرف ميقاتك على طريقك" } },
    ] },
  ];

  /* ═══════════ State ═══════════ */
  function state() {
    var s = SS.store.get("hajj:state");
    s = s && typeof s === "object" ? s : {};
    return { type: s.type === "hajj" || s.type === "umrah" ? s.type : null, step: typeof s.step === "string" ? s.step : null };
  }
  function saveState(patch) {
    var s = state();
    for (var k in patch) s[k] = patch[k];
    s.at = Date.now();
    SS.store.set("hajj:state", s);
  }
  function progress(type) { var p = SS.store.get("hajj:progress:" + type, {}); return p && typeof p === "object" ? p : {}; }
  function setDone(type, id, on) {
    var p = progress(type);
    if (on) p[id] = 1; else delete p[id];
    SS.store.set("hajj:progress:" + type, p);
  }
  function summary(type) {
    var g = GUIDES[type], p = progress(type), n = 0, cur = null, next = null;
    g.forEach(function (s, i) {
      if (p[s.id]) n++;
      else if (!cur) { cur = s; next = g[i + 1] || null; }
    });
    return { n: n, total: g.length, cur: cur, next: next };
  }
  function stepIndex(type, id) { var g = GUIDES[type]; for (var i = 0; i < g.length; i++) if (g[i].id === id) return i; return -1; }
  function typeName(type) { return t(type === "hajj" ? "hajj.hajj" : "hajj.umrah"); }

  /* ═══════════ Home: inside the prayer card ═══════════ */
  function home(el) {
    var s = state();
    if (!s.type) {
      el.innerHTML = '<p class="hm-lead">' + esc(t("hajj.askType")) + "</p>" +
        '<div class="hm-acts"><button class="hm-btn gold" type="button" data-hj-type="umrah">' + esc(t("hajj.umrah")) + "</button>" +
        '<button class="hm-btn gold" type="button" data-hj-type="hajj">' + esc(t("hajj.hajj")) + "</button></div>";
      el.onclick = function (e) {
        var b = e.target.closest("[data-hj-type]");
        if (!b) return;
        saveState({ type: b.getAttribute("data-hj-type"), step: null });
        home(el);
      };
      return;
    }
    el.onclick = null;
    var sm = summary(s.type), i = sm.cur ? stepIndex(s.type, sm.cur.id) : -1;
    el.innerHTML = sm.cur
      ? '<a class="hm-row" href="#/mode/hajj/step/' + sm.cur.id + '"><span class="hm-step" aria-hidden="true">' + (i + 1) + "</span>" +
        '<span class="hm-row-t"><span>' + esc(f("hajj.nextStepOf", { t: typeName(s.type), n: i + 1, total: sm.total })) + "</span><b>" + esc(L(sm.cur.title)) + "</b></span>" + icon("chev-r", "chev flip") + "</a>"
      : '<p class="hm-lead">' + icon("check") + " " + esc(f("hajj.allDoneX", { t: typeName(s.type) })) + "</p>";
    el.innerHTML += '<div class="hm-acts"><a class="hm-btn gold" href="#/mode/hajj/count">' + icon("repeat") + "<span>" + esc(t("hajj.countRounds")) + "</span></a>" +
      '<a class="hm-btn" href="#/mode/hajj">' + esc(t("hajj.openGuide")) + "</a></div>";
  }

  /* ═══════════ Round counter (3.1.5): 7 rounds of tawaf or sa'i ═══════════ */
  // On this device only: you count on the phone in your hand.
  function counter() {
    var c = SS.store.get("hajj:counter");
    c = c && typeof c === "object" ? c : {};
    return { kind: c.kind === "sai" ? "sai" : "tawaf", n: Math.max(0, Math.min(7, c.n | 0)) };
  }
  function saveCounter(c) { SS.store.set("hajj:counter", { kind: c.kind, n: c.n, at: Date.now() }); }
  function roundNote(kind, n) {
    // n = the round about to be walked (1–7).
    if (kind === "sai") return f(n % 2 ? "hajj.saiOdd" : "hajj.saiEven", { n: n });
    return n <= 3 ? f("hajj.tawafFirst", { n: n }) : f("hajj.tawafRest", { n: n });
  }
  function countTab(el) {
    var c = counter();
    function draw() {
      var done = c.n >= 7;
      el.innerHTML = '<article class="card counter-card">' +
        '<div class="segmented counter-kind" role="group" aria-label="' + esc(t("hajj.countWhat")) + '">' +
        ["tawaf", "sai"].map(function (k) { return '<button type="button" data-kind="' + k + '" aria-pressed="' + (c.kind === k) + '">' + esc(t("hajj.count_" + k)) + "</button>"; }).join("") + "</div>" +
        '<button class="round-btn' + (done ? " done" : "") + '" type="button" id="hj-tap"' + (done ? " disabled" : "") + ' aria-describedby="hj-round-note">' +
        '<svg class="round-ring" viewBox="0 0 120 120" aria-hidden="true">' + ringDots(c.n) + "</svg>" +
        '<span class="round-n" aria-live="polite">' + esc(done ? t("hajj.roundsDone") : f("hajj.roundOf", { n: c.n, total: 7 })) + "</span>" +
        '<span class="round-tap">' + esc(done ? "" : t(c.n ? "hajj.tapAfter" : "hajj.tapStart")) + "</span></button>" +
        '<p class="counter-note" id="hj-round-note">' + esc(done ? t(c.kind === "sai" ? "hajj.saiDoneNote" : "hajj.tawafDoneNote") : roundNote(c.kind, c.n + 1)) + "</p>" +
        '<div class="form-row counter-acts"><button class="btn btn-outline btn-sm" type="button" id="hj-undo"' + (c.n ? "" : " disabled") + ">" + icon("undo") + "<span>" + esc(t("hajj.undo")) + "</span></button>" +
        '<button class="btn btn-ghost btn-sm" type="button" id="hj-zero"' + (c.n ? "" : " disabled") + ">" + icon("refresh") + "<span>" + esc(t("hajj.startAgain")) + "</span></button></div>" +
        '<p class="tiny guide-src"><span class="badge badge-src">' + esc(t("modes.source")) + "</span> " + esc(t("hajj.countSrc")) + "</p></article>" +
        '<a class="btn btn-ghost btn-sm mt-1" href="#/mode/hajj/step/' + (c.kind === "sai" ? "u-sai" : "u-tawaf") + '">' + esc(t(c.kind === "sai" ? "hajj.readSai" : "hajj.readTawaf")) + "</a>";
      $("hj-tap").onclick = function () {
        if (c.n >= 7) return;
        c.n++; saveCounter(c);
        if (SS.ui.vibrate) SS.ui.vibrate(c.n === 7 ? [60, 80, 60] : 30);
        draw();
        var b = $("hj-tap"); if (b && !b.disabled) b.focus();
      };
      $("hj-undo").onclick = function () { if (c.n) { c.n--; saveCounter(c); draw(); } };
      $("hj-zero").onclick = function () { c.n = 0; saveCounter(c); draw(); };
      el.querySelector(".counter-kind").onclick = function (e) {
        var b = e.target.closest("[data-kind]");
        if (!b || b.getAttribute("data-kind") === c.kind) return;
        if (c.n && !window.confirm(t("hajj.switchConfirm"))) return;
        c = { kind: b.getAttribute("data-kind"), n: 0 }; saveCounter(c); draw();
      };
    }
    draw();
  }
  function ringDots(n) {
    var out = "";
    for (var i = 0; i < 7; i++) {
      var a = (i / 7) * Math.PI * 2 - Math.PI / 2, x = 60 + 50 * Math.cos(a), y = 60 + 50 * Math.sin(a);
      out += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="7" class="' + (i < n ? "on" : "") + '"/>';
    }
    return out;
  }

  /* ═══════════ Full page ═══════════ */
  function page(el, params) {
    el.onclick = null;
    var s = state();
    if (!s.type || params[0] === "choose") return chooseType(el, s.type);
    if (params[0] === "step" && stepIndex(s.type, params[1]) > -1) return stepView(el, s.type, params[1]);
    var tab = params[0] === "duas" || params[0] === "checklist" || params[0] === "count" ? params[0] : "guide";
    el.innerHTML = '<div class="segmented mode-tabs" id="hj-tabs" aria-label="' + esc(t("modes.sections")) + '"></div><div id="hj-body" role="tabpanel" aria-labelledby="mt-' + tab + '"></div>';
    M.tabs($("hj-tabs"), [["guide", t("hajj.guide")], ["count", t("hajj.counter")], ["duas", t("hajj.duas")], ["checklist", t("hajj.checklist")]], tab,
      function (k) { location.hash = "#/mode/hajj" + (k === "guide" ? "" : "/" + k); });
    ({ guide: overview, count: countTab, duas: duasTab, checklist: checklistTab })[tab]($("hj-body"), s.type);
  }

  function chooseType(el, cur) {
    el.innerHTML = '<article class="card"><h2 class="h-sm" id="hj-ask">' + esc(t("hajj.askType")) + "</h2>" +
      '<p class="tiny">' + esc(t("hajj.askTypeSub")) + "</p>" +
      '<div class="mode-list mt-1" role="group" aria-labelledby="hj-ask">' +
      ["umrah", "hajj"].map(function (k) {
        return '<button class="card mode-card' + (cur === k ? " on" : "") + '" type="button" data-type="' + k + '" aria-pressed="' + (cur === k) + '">' +
          M.icon(k === "hajj" ? "hajj" : "mosque") +
          '<span class="mode-body"><span class="mode-name">' + esc(typeName(k)) + '</span><span class="mode-desc">' + esc(t("hajj.desc_" + k)) + "</span></span>" +
          (cur === k ? '<span class="badge mode-active">' + icon("check") + "<span>" + esc(t("modes.active")) + "</span></span>" : "") + "</button>";
      }).join("") + "</div></article>";
    el.onclick = function (e) {
      var b = e.target.closest("[data-type]");
      if (!b) return;
      saveState({ type: b.getAttribute("data-type"), step: null });
      location.hash = "#/mode/hajj";
      if (location.hash === "#/mode/hajj") page(el, []);
    };
  }

  function overview(el, type) {
    var sm = summary(type), p = progress(type), s = state();
    var resume = s.step && stepIndex(type, s.step) > -1 && !p[s.step] ? s.step : sm.cur && sm.cur.id;
    var pct = Math.round(sm.n / sm.total * 100);
    var html = '<div class="mode-grid"><div class="stack">' +
      '<article class="card"><div class="card-title"><h2>' + esc(f("hajj.yourGuide", { t: typeName(type) })) + '</h2><a class="btn btn-ghost btn-sm" href="#/mode/hajj/choose">' + esc(t("hajj.change")) + "</a></div>" +
      '<div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="' + sm.total + '" aria-valuenow="' + sm.n + '" aria-label="' + esc(t("hajj.progress")) + '"><span style="inline-size:' + pct + '%"></span></div>' +
      '<p class="tiny mt-1">' + esc(f("modes.doneOf", { n: sm.n, total: sm.total })) + "</p>" +
      (sm.cur ? '<p class="mt-1"><b>' + esc(t("hajj.current")) + ":</b> " + esc(L(sm.cur.title)) + "</p>" +
        (sm.next ? '<p class="tiny"><b>' + esc(t("hajj.next")) + ":</b> " + esc(L(sm.next.title)) + "</p>" : "") +
        '<a class="btn mt-1" href="#/mode/hajj/step/' + resume + '">' + esc(t(sm.n || s.step ? "hajj.continue" : "hajj.start")) + "</a>"
        : '<p class="kid-done mt-1">' + icon("check") + "<span>" + esc(t("hajj.allDone")) + "</span></p>") +
      "</article>" +
      '<ol class="steps-list" aria-label="' + esc(t("hajj.steps")) + '">' + GUIDES[type].map(function (st, i) {
        var done = !!p[st.id], isCur = sm.cur && sm.cur.id === st.id;
        return '<li><a class="step-row' + (done ? " done" : "") + '" href="#/mode/hajj/step/' + st.id + '"' + (isCur ? ' aria-current="step"' : "") + ">" +
          '<span class="step-n" aria-hidden="true">' + (done ? icon("check") : i + 1) + "</span>" +
          '<span class="step-t">' + esc(L(st.title)) + (st.when ? '<br><span class="step-s">' + esc(L(st.when)) + "</span>" : "") + "</span>" +
          '<span class="visually-hidden">' + esc(done ? t("hajj.stepDone") : isCur ? t("hajj.current") : "") + "</span>" + icon("chev-r", "chev flip") + "</a></li>";
      }).join("") + "</ol>" +
      '<button class="btn btn-ghost btn-sm" type="button" id="hj-reset">' + icon("refresh") + "<span>" + esc(t("hajj.reset")) + "</span></button>" +
      "</div><div class=\"stack\">" +
      '<a class="card counter-link" href="#/mode/hajj/count">' + icon("repeat") + '<span class="w-body"><span class="w-title">' + esc(t("hajj.countRounds")) + '</span><span class="w-sub">' + esc(t("hajj.countSub")) + "</span></span>" + icon("chev-r", "chev flip") + "</a>" +
      '<article class="card guide-text"><h2 class="h-sm">' + esc(t("hajj.aboutGuide")) + "</h2><p>" + esc(t("hajj.aboutGuideText")) + '</p><p class="consult">' + esc(t("modes.consult")) + "</p></article>" +
      "</div></div>";
    el.innerHTML = html;
    $("hj-reset").onclick = function () {
      if (!window.confirm(f("hajj.resetConfirm", { t: typeName(type) }))) return;
      SS.store.set("hajj:progress:" + type, {});
      SS.store.set("hajj:checklist", {});
      saveState({ step: null });
      SS.toast(t("hajj.resetDone"));
      overview(el, type);
    };
  }

  function stepView(el, type, id) {
    var g = GUIDES[type], i = stepIndex(type, id), st = g[i], p = progress(type);
    saveState({ step: id }); // resume here next time
    var body = st.body[lang()] || st.body.en;
    var html = '<a class="back-link" href="#/mode/hajj">' + icon("chev-l", "flip") + "<span>" + esc(f("hajj.allSteps", { t: typeName(type) })) + "</span></a>" +
      '<article class="card guide-text" aria-labelledby="hj-step-h">' +
      '<p class="tiny">' + esc(f("hajj.stepOf", { n: i + 1, total: g.length })) + "</p>" +
      '<h2 id="hj-step-h" tabindex="-1">' + esc(L(st.title)) + "</h2>" +
      (st.when ? '<p class="badge mt-1">' + esc(L(st.when)) + "</p>" : "") +
      body.map(function (x) { return "<p>" + esc(x) + "</p>"; }).join("") +
      (st.diff ? '<div class="diff"><b>' + esc(t("modes.differences")) + "</b>" + esc(L(st.diff)) + "</div>" : "") +
      '<p class="tiny guide-src"><span class="badge badge-src">' + esc(t("modes.source")) + "</span> " + esc(L(st.src)) + "</p>" +
      '<button class="btn mt-2' + (p[id] ? " btn-outline" : "") + '" type="button" id="hj-done" aria-pressed="' + !!p[id] + '">' + icon("check") +
      "<span>" + esc(t(p[id] ? "hajj.markedDone" : "hajj.markDone")) + "</span></button></article>";
    if (st.duas && st.duas.length) html += '<h3 class="group-label mt-2">' + esc(t("hajj.duasForStep")) + '</h3><div class="stack">' + st.duas.map(function (k) { return M.duaHtml(DUAS[k]); }).join("") + "</div>";
    if (id === "u-tawaf") { var lib = M.libraryDua("entering-mosque"); if (lib) html = html.replace('<div class="stack">', '<div class="stack">' + M.duaHtml(lib)); }
    html += '<nav class="step-nav" aria-label="' + esc(t("hajj.steps")) + '">' +
      (i > 0 ? '<a class="btn btn-outline btn-sm" href="#/mode/hajj/step/' + g[i - 1].id + '">' + icon("chev-l", "flip") + "<span>" + esc(t("hajj.prev")) + "</span></a>" : "<span></span>") +
      (i < g.length - 1 ? '<a class="btn btn-sm" href="#/mode/hajj/step/' + g[i + 1].id + '"><span>' + esc(t("hajj.next")) + "</span>" + icon("chev-r", "flip") + "</a>" : '<a class="btn btn-sm" href="#/mode/hajj">' + esc(t("hajj.backToGuide")) + "</a>") +
      "</nav>";
    el.innerHTML = html;
    $("hj-done").onclick = function () {
      var on = !progress(type)[id];
      setDone(type, id, on);
      SS.toast(t(on ? "hajj.stepSaved" : "hajj.stepUnmarked"));
      stepView(el, type, id);
      var b = $("hj-done"); if (b) b.focus();
    };
  }

  function duasTab(el) {
    el.innerHTML = '<div class="stack">' + ["talbiyah", "blackstone", "yemeni", "maqam", "safa", "arafah", "jamarat"].map(function (k) { return M.duaHtml(DUAS[k]); }).join("") + "</div>";
  }
  function checklistTab(el) {
    el.innerHTML = '<article class="card"><div id="hj-checklist"></div></article><p class="tiny mt-1">' + esc(t("modes.checklistSync")) + "</p>";
    M.checklist($("hj-checklist"), "hajj:checklist", CHECKLIST);
  }

  SS.modeModules.hajj = { home: home, page: page, leave: function () { /* nothing running */ }, GUIDES: GUIDES, DUAS: DUAS, CHECKLIST: CHECKLIST };
})();
