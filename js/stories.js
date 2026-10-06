/* SalaamStreet — stories.js (classic script)
   2.9 SalaamStreet Stories: stories of the Prophets, told only from the
   Qur'an (and, where noted, authentic hadith). Each story is a short set of
   tap-through slides.

   Slide fields:
     t   – a short narration in our own words (en / ar), kept close to the source
     q   – [surah, ayah] or [surah, firstAyah, lastAyah]: the Qur'an itself is
           shown under the narration — Arabic and translation are loaded from
           the app's Qur'an source (never typed here), with a play button
     src – a source to show when there is no q (e.g. a hadith reference)

   Nothing here adds details the sources don't give (no Isra'iliyyat).
   Every q reference was checked against Saheeh International. */
(function () {
  "use strict";
  window.SS = window.SS || {};

  SS.STORIES = [
    {
      id: "adam", en: "Adam", ar: "آدم", hue: 150,
      sub: { en: "The first human, and the first repentance", ar: "أول إنسان، وأول توبة" },
      slides: [
        { t: { en: "Before Adam was created, Allah told the angels He would place a successor on the earth.", ar: "قبل أن يُخلق آدم، أخبر الله الملائكة أنه جاعل في الأرض خليفة." }, q: [2, 30] },
        { t: { en: "Allah taught Adam the names of all things. The angels, who had not been taught them, said:", ar: "وعلّم الله آدم الأسماء كلها، فقالت الملائكة التي لم تُعلَّمها:" }, q: [2, 32] },
        { t: { en: "Allah commanded the angels to prostrate to Adam. They all did — except Iblees, who refused out of pride.", ar: "وأمر الله الملائكة بالسجود لآدم فسجدوا جميعًا إلا إبليس، أبى واستكبر." }, q: [2, 34] },
        { t: { en: "Iblees explained his pride: he thought being made from fire made him better.", ar: "وبيّن إبليس سبب كبره: ظنّ أن خلقه من نار يجعله خيرًا من آدم." }, q: [7, 12] },
        { t: { en: "Adam and his wife lived in Paradise, free to eat from anything — except one tree.", ar: "وسكن آدم وزوجه الجنة يأكلان منها حيث شاءا، إلا شجرة واحدة." }, q: [2, 35] },
        { t: { en: "But Shaytan made them slip, and they ate from the tree.", ar: "لكن الشيطان أزلّهما، فأكلا من الشجرة." }, q: [2, 36] },
        { t: { en: "They did not make excuses. They turned straight back to Allah with this du'a:", ar: "لم يلتمسا الأعذار، بل رجعا إلى الله فورًا بهذا الدعاء:" }, q: [7, 23] },
        { t: { en: "And Allah accepted Adam's repentance.", ar: "فتاب الله على آدم." }, q: [2, 37] },
        { lesson: true, t: { en: "Everyone makes mistakes. What matters is coming back to Allah quickly and sincerely — He is the Accepting of repentance, the Merciful.", ar: "كل إنسان يخطئ، والمهم أن يرجع إلى الله سريعًا وبصدق — فهو التواب الرحيم." } },
      ],
    },
    {
      id: "nuh", en: "Nuh", ar: "نوح", hue: 200,
      sub: { en: "Patience that lasted 950 years", ar: "صبر دام ٩٥٠ عامًا" },
      slides: [
        { t: { en: "Nuh called his people to worship Allah alone — night and day.", ar: "دعا نوح قومه إلى عبادة الله وحده، ليلًا ونهارًا." }, q: [71, 5] },
        { t: { en: "But every time he called them, they covered their ears and turned away in arrogance.", ar: "وكلما دعاهم جعلوا أصابعهم في آذانهم وأعرضوا مستكبرين." }, q: [71, 7] },
        { t: { en: "He kept calling them for a very long time.", ar: "واستمر في دعوتهم زمنًا طويلًا جدًا." }, q: [29, 14] },
        { t: { en: "Allah told Nuh to build a ship. As he worked, the leaders of his people walked past and mocked him.", ar: "وأمره الله أن يصنع السفينة، فكان الملأ من قومه يمرّون به ويسخرون منه." }, q: [11, 37, 38] },
        { t: { en: "When Allah's command came, the believers boarded with him — and they were only a few.", ar: "فلما جاء أمر الله ركب معه المؤمنون، وما آمن معه إلا قليل." }, q: [11, 40] },
        { t: { en: "Through waves like mountains, Nuh called to his son to come aboard. His son refused.", ar: "وبين موج كالجبال نادى نوح ابنه أن يركب معهم، فأبى." }, q: [11, 42, 43] },
        { t: { en: "Then the water went down, and the ship came to rest on Mount Judi.", ar: "ثم غيض الماء، واستوت السفينة على الجودي." }, q: [11, 44] },
        { t: { en: "Nuh's du'a for himself, his parents and the believers:", ar: "ومن دعاء نوح لنفسه ولوالديه وللمؤمنين:" }, q: [71, 28] },
        { lesson: true, t: { en: "Keep doing what is right even when people laugh at you. Nuh never gave up — and Allah saved those who believed.", ar: "استمر على الحق ولو سخر منك الناس. لم ييأس نوح أبدًا — ونجّى الله المؤمنين." } },
      ],
    },
    {
      id: "ibrahim", en: "Ibrahim", ar: "إبراهيم", hue: 35,
      sub: { en: "Searching for the truth, and standing by it", ar: "البحث عن الحق والثبات عليه" },
      slides: [
        { t: { en: "Ibrahim's own father and people worshipped idols. Ibrahim asked his father why.", ar: "كان أبو إبراهيم وقومه يعبدون الأصنام، فسأل إبراهيم أباه عن ذلك." }, q: [6, 74] },
        { t: { en: "He showed his people that a star, the moon and the sun all set — so none of them can be God.", ar: "وبيّن لقومه أن الكوكب والقمر والشمس كلها تغيب، فلا يكون شيء منها إلهًا." }, q: [6, 76] },
        { t: { en: "He turned to the One who created them all.", ar: "وتوجّه إلى الذي خلقها جميعًا." }, q: [6, 79] },
        { t: { en: "While his people were away, he broke their idols — all except the biggest one.", ar: "وحين غاب قومه، جعل أصنامهم جذاذًا إلا كبيرًا لهم." }, q: [21, 58] },
        { t: { en: "When they asked who did it, he told them to ask the idols — if they could speak.", ar: "ولما سألوه قال: فاسألوهم إن كانوا ينطقون." }, q: [21, 63] },
        { t: { en: "Angry, they threw him into a fire. But Allah commanded the fire:", ar: "فغضبوا وألقوه في النار، فقال الله للنار:" }, q: [21, 69] },
        { t: { en: "Later, Ibrahim saw in a dream that he must sacrifice his son, and told him. His son's answer:", ar: "ثم رأى إبراهيم في المنام أنه يذبح ابنه، فأخبره، فكان جواب الابن:" }, q: [37, 102] },
        { t: { en: "Both submitted to Allah — and Allah ransomed the son with a great sacrifice. Eid al-Adha remembers this.", ar: "فأسلما لله جميعًا، ففداه الله بذبح عظيم. وعيد الأضحى يذكّرنا بذلك." }, q: [37, 107] },
        { t: { en: "Ibrahim and his son Isma'il raised the foundations of the Ka'bah, praying:", ar: "ورفع إبراهيم وابنه إسماعيل القواعد من البيت وهما يدعوان:" }, q: [2, 127] },
        { lesson: true, t: { en: "Think for yourself, stand firm on the truth, and trust Allah completely — even when it is hard.", ar: "تفكّر بنفسك، واثبت على الحق، وتوكّل على الله تمامًا — حتى في الصعاب." } },
      ],
    },
    {
      id: "yusuf", en: "Yusuf", ar: "يوسف", hue: 280,
      sub: { en: "From the well to the palace", ar: "من البئر إلى القصر" },
      slides: [
        { t: { en: "Young Yusuf had a dream and told his father, the prophet Ya'qub.", ar: "رأى يوسف وهو صغير رؤيا فأخبر بها أباه النبي يعقوب." }, q: [12, 4] },
        { t: { en: "Ya'qub warned him not to tell his brothers, who were jealous of him.", ar: "فحذّره يعقوب أن يقصّها على إخوته الذين كانوا يحسدونه." }, q: [12, 5] },
        { t: { en: "His brothers threw him into a well. But Allah told Yusuf that one day he would remind them of this.", ar: "فألقاه إخوته في البئر، وأوحى الله إلى يوسف أنه سيخبرهم بأمرهم هذا يومًا." }, q: [12, 15] },
        { t: { en: "They brought back his shirt with false blood on it. Ya'qub answered with patience:", ar: "وجاؤوا على قميصه بدم كذب، فقال يعقوب صابرًا:" }, q: [12, 18] },
        { t: { en: "In Egypt, a powerful man's wife tried to tempt Yusuf. He said:", ar: "وفي مصر راودته امرأة العزيز عن نفسه، فقال:" }, q: [12, 23] },
        { t: { en: "Even in prison, Yusuf called his companions to worship the One God.", ar: "وحتى في السجن دعا يوسف صاحبيه إلى عبادة الله الواحد." }, q: [12, 39] },
        { t: { en: "The king had a dream no one could explain. Yusuf explained it: seven good years, then seven hard ones — and how to prepare.", ar: "ورأى الملك رؤيا عجز الناس عن تأويلها، فأوّلها يوسف: سبع سنين خصبة ثم سبع شداد — وكيف يستعدّون لها." }, q: [12, 43, 47] },
        { t: { en: "Years later his brothers stood before him, now in charge of Egypt's stores. He forgave them:", ar: "وبعد سنين وقف إخوته أمامه وقد صار على خزائن مصر، فعفا عنهم:" }, q: [12, 92] },
        { t: { en: "His family came to Egypt, and his childhood dream came true.", ar: "وجاء أهله إلى مصر، وتحققت رؤياه." }, q: [12, 100] },
        { lesson: true, t: { en: "Be patient in hard times, stay pure when tempted, and forgive. Allah is Subtle — He brings good out of what looks bad.", ar: "اصبر في الشدة، وتعفّف عند الفتنة، واعفُ. إن الله لطيف — يُخرج الخير مما يبدو شرًا." } },
      ],
    },
    {
      id: "musa", en: "Musa", ar: "موسى", hue: 15,
      sub: { en: "Courage in front of Pharaoh", ar: "الشجاعة أمام فرعون" },
      slides: [
        { t: { en: "Pharaoh was killing the baby boys of the Children of Israel. Allah inspired Musa's mother:", ar: "كان فرعون يقتل أبناء بني إسرائيل، فأوحى الله إلى أم موسى:" }, q: [28, 7] },
        { t: { en: "Baby Musa would not feed from any nurse — so Allah returned him to his own mother, just as He promised.", ar: "ولم يقبل موسى الرضاعة من أي مرضعة، فردّه الله إلى أمه كما وعد." }, q: [28, 13] },
        { t: { en: "Years later, at the valley of Tuwa, Allah spoke to Musa:", ar: "وبعد سنين، في الوادي المقدّس طوى، كلّم الله موسى:" }, q: [20, 12, 14] },
        { t: { en: "Allah gave him signs and sent him to Pharaoh. Musa asked for help with this du'a:", ar: "وآتاه الله الآيات وأرسله إلى فرعون، فدعا موسى:" }, q: [20, 25, 28] },
        { t: { en: "Pharaoh's magicians saw the truth — and believed, in front of Pharaoh himself.", ar: "ورأى سحرة فرعون الحق فآمنوا، أمام فرعون نفسه." }, q: [20, 70] },
        { t: { en: "Pharaoh's army chased the believers to the sea. His people were afraid. Musa said:", ar: "وطارد جيش فرعون المؤمنين حتى البحر، فخاف أصحاب موسى، فقال:" }, q: [26, 61, 62] },
        { t: { en: "Allah told him to strike the sea with his staff — and it split in two.", ar: "فأوحى الله إليه أن اضرب بعصاك البحر، فانفلق." }, q: [26, 63] },
        { lesson: true, t: { en: "When something feels too big, ask Allah for help and trust Him: “Indeed, with me is my Lord; He will guide me.”", ar: "إذا بدا الأمر أكبر منك، فاستعن بالله وتوكّل عليه كما توكّل موسى عند البحر." } },
      ],
    },
    {
      id: "yunus", en: "Yunus", ar: "يونس", hue: 190,
      sub: { en: "A du'a from the belly of the whale", ar: "دعاء من بطن الحوت" },
      slides: [
        { t: { en: "Yunus was one of the messengers.", ar: "كان يونس من المرسلين." }, q: [37, 139] },
        { t: { en: "He left his people in anger and boarded a full ship.", ar: "وخرج من قومه مغاضبًا، وركب الفلك المشحون." }, q: [37, 140] },
        { t: { en: "Lots were drawn, and Yunus was thrown into the sea — where a great fish swallowed him.", ar: "فساهم فكان من المدحضين، فالتقمه الحوت." }, q: [37, 141, 142] },
        { t: { en: "In the darkness, he called out to Allah:", ar: "فنادى في الظلمات:" }, q: [21, 87] },
        { t: { en: "Allah answered him and saved him — and promises to save the believers the same way.", ar: "فاستجاب الله له ونجّاه، وكذلك ينجي المؤمنين." }, q: [21, 88] },
        { t: { en: "He was cast onto the shore, weak, and Allah grew a gourd plant over him.", ar: "فنُبذ بالعراء وهو سقيم، وأنبت الله عليه شجرة من يقطين." }, q: [37, 145, 146] },
        { t: { en: "He was sent back to a hundred thousand people or more — and they believed.", ar: "وأُرسل إلى مئة ألف أو يزيدون، فآمنوا." }, q: [37, 147, 148] },
        { t: { en: "The Prophet ﷺ said that no Muslim calls upon Allah with this du'a of Yunus for anything, except that Allah answers him.", ar: "وقال النبي ﷺ إنه لم يدعُ بدعوة يونس رجل مسلم في شيء قط إلا استجاب الله له." }, src: "Jami' at-Tirmidhi 3505" },
        { lesson: true, t: { en: "No darkness is too deep for Allah to hear you. Admit your mistake, praise Him, and call on Him.", ar: "لا ظلمة أعمق من أن يسمعك الله فيها. اعترف بخطئك، وسبّحه، وادعه." } },
      ],
    },
  ];
})();
