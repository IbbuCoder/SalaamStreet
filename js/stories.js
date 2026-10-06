/* SalaamStreet — stories.js (classic script)
   2.9 SalaamStreet Stories: stories of the Prophets, told only from the
   Qur'an (and, where noted, authentic hadith). Each story is a short set of
   tap-through slides.

   Groups: prophets (default), quran, seerah (the Prophet ﷺ and his
   Companions), hadith (stories the Prophet ﷺ told). Hadith sources are
   Sahih al-Bukhari, or graded hasan/sahih where noted.

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

    /* ══════ Stories from the Qur'an ══════ */
    {
      id: "maryam", group: "quran", en: "Maryam", ar: "مريم", hue: 330,
      sub: { en: "The mother of Isa, chosen above the women of the worlds", ar: "أم عيسى، اصطفاها الله على نساء العالمين" },
      slides: [
        { t: { en: "Maryam grew up in worship, cared for by the prophet Zakariyya. Whenever he visited her, he found she had been given provision.", ar: "نشأت مريم في العبادة، وكفلها النبي زكريا، وكلما دخل عليها وجد عندها رزقًا." }, q: [3, 37] },
        { t: { en: "The angels told her that Allah had chosen her and purified her.", ar: "وقالت لها الملائكة إن الله اصطفاها وطهّرها." }, q: [3, 42] },
        { t: { en: "One day, when she was alone, Allah sent the angel Jibril to her in the form of a man.", ar: "وفي يوم كانت فيه منفردة، أرسل الله إليها جبريل في صورة بشر." }, q: [19, 16, 17] },
        { t: { en: "He told her she would have a pure son. She asked how, when no man had touched her. The answer:", ar: "فبشّرها بغلام زكي، فسألت كيف ولم يمسسها بشر، فكان الجواب:" }, q: [19, 20, 21] },
        { t: { en: "In the pain of giving birth, alone by a palm tree, she was told not to grieve — Allah had provided water and fresh dates.", ar: "وفي ألم المخاض، وحيدة عند جذع النخلة، نوديت ألّا تحزني، فقد جعل الله لها ماءً ورطبًا جنيًّا." }, q: [19, 24, 25] },
        { t: { en: "When her people blamed her, she pointed to the baby. And the baby Isa spoke:", ar: "ولما لامها قومها أشارت إلى الطفل، فنطق عيسى في المهد:" }, q: [19, 29, 30] },
        { lesson: true, t: { en: "Maryam trusted Allah when she was alone and when people doubted her. When you do what is right, Allah takes care of you.", ar: "توكّلت مريم على الله وهي وحيدة وحين شكّ فيها الناس. إذا فعلت الصواب فإن الله يتولّاك." } },
      ],
    },
    {
      id: "cave", group: "quran", en: "The People of the Cave", ar: "أصحاب الكهف", hue: 230,
      sub: { en: "Young believers who held on to their faith", ar: "فتية آمنوا بربهم فثبّتهم" },
      slides: [
        { t: { en: "A group of young people believed in Allah when their people worshipped others besides Him.", ar: "آمن فتية بالله حين كان قومهم يعبدون غيره." }, q: [18, 13] },
        { t: { en: "To protect their faith, they left and took shelter in a cave, praying:", ar: "وليحفظوا إيمانهم خرجوا وأووا إلى الكهف داعين:" }, q: [18, 10] },
        { t: { en: "Allah made them sleep. Anyone looking would have thought they were awake — with their dog stretched out at the entrance.", ar: "فأنامهم الله، ومن رآهم حسبهم أيقاظًا وهم رقود، وكلبهم باسط ذراعيه بالوصيد." }, q: [18, 18] },
        { t: { en: "When they woke, they thought they had slept a day or part of a day.", ar: "ولما استيقظوا ظنّوا أنهم لبثوا يومًا أو بعض يوم." }, q: [18, 19] },
        { t: { en: "In fact, they had stayed in the cave for three hundred and nine years.", ar: "وقد لبثوا في كهفهم ثلاثمئة سنين وازدادوا تسعًا." }, q: [18, 25] },
        { t: { en: "People argue about how many they were. The Qur'an says only Allah knows exactly — so don't argue over it.", ar: "واختلف الناس في عددهم، والقرآن يقول إن الله أعلم بعدّتهم — فلا تجادل فيه." }, q: [18, 22] },
        { lesson: true, t: { en: "Young people can be heroes of faith. When it's hard to hold on, turn to Allah — and focus on what matters, not on small details.", ar: "يمكن للشباب أن يكونوا أبطال إيمان. إذا صعب الثبات فالجأ إلى الله، واهتم بما ينفع لا بالتفاصيل." } },
      ],
    },
    {
      id: "luqman", group: "quran", en: "Luqman's Advice", ar: "وصية لقمان", hue: 95,
      sub: { en: "A wise father's advice to his son", ar: "نصائح أب حكيم لابنه" },
      slides: [
        { t: { en: "Allah gave Luqman wisdom, and told him to be grateful.", ar: "آتى الله لقمان الحكمة، وأمره أن يشكر." }, q: [31, 12] },
        { t: { en: "His first advice to his son: never worship anything besides Allah.", ar: "وأول وصيته لابنه: لا تشرك بالله شيئًا." }, q: [31, 13] },
        { t: { en: "Allah reminds us to be grateful to our parents — especially our mothers.", ar: "ويذكّرنا الله بالشكر للوالدين، ولا سيما الأم." }, q: [31, 14] },
        { t: { en: "Nothing is hidden from Allah — not even something as small as a mustard seed.", ar: "لا يخفى على الله شيء، ولو كان مثقال حبة من خردل." }, q: [31, 16] },
        { t: { en: "Pray, do good, stop wrong, and be patient.", ar: "أقم الصلاة، وأمر بالمعروف، وانهَ عن المنكر، واصبر." }, q: [31, 17] },
        { t: { en: "Don't be arrogant — and be gentle in how you walk and speak.", ar: "لا تتكبّر، واقصد في مشيك واغضض من صوتك." }, q: [31, 18, 19] },
        { lesson: true, t: { en: "Good advice is simple: worship Allah alone, honour your parents, pray, be patient and be humble.", ar: "النصيحة الطيبة بسيطة: اعبد الله وحده، وبرّ والديك، وصلِّ، واصبر، وتواضع." } },
      ],
    },
    {
      id: "garden", group: "quran", en: "The Owners of the Garden", ar: "أصحاب الجنة", hue: 120,
      sub: { en: "A lesson about greed and giving", ar: "عبرة في البخل والعطاء" },
      slides: [
        { t: { en: "Some brothers owned a garden. They swore to pick all its fruit early in the morning — without saying “if Allah wills”.", ar: "كان لإخوة بستان، فأقسموا أن يقطفوا ثمره مبكرين دون أن يقولوا «إن شاء الله»." }, q: [68, 17, 18] },
        { t: { en: "Their plan was to go quietly, so no poor person could come and ask for a share.", ar: "وكانت خطتهم أن ينطلقوا خفية حتى لا يدخل عليهم مسكين." }, q: [68, 23, 24] },
        { t: { en: "But while they slept, the garden was destroyed.", ar: "لكن طاف على البستان طائف من ربهم وهم نائمون." }, q: [68, 19, 20] },
        { t: { en: "When they saw it, they said:", ar: "فلما رأوه قالوا:" }, q: [68, 26, 27] },
        { t: { en: "Then they admitted their mistake and turned to Allah, hoping for something better.", ar: "ثم اعترفوا بخطئهم ورجعوا إلى الله راجين خيرًا منه." }, q: [68, 29, 32] },
        { lesson: true, t: { en: "Everything we have is from Allah. Share with those in need, and say “in sha Allah” about your plans.", ar: "كل ما نملك من الله. شارك المحتاجين، وقل «إن شاء الله» في خططك." } },
      ],
    },
    {
      id: "elephant", group: "quran", en: "The Year of the Elephant", ar: "عام الفيل", hue: 25,
      sub: { en: "When Allah protected the Ka'bah", ar: "حين حمى الله الكعبة" },
      slides: [
        { t: { en: "An army came with an elephant to attack the Ka'bah in Makkah.", ar: "جاء جيش ومعه فيل لهدم الكعبة في مكة." }, q: [105, 1] },
        { t: { en: "But Allah made their plan fail.", ar: "لكن الله جعل كيدهم في تضليل." }, q: [105, 2] },
        { t: { en: "He sent flocks of birds carrying stones of baked clay.", ar: "وأرسل عليهم طيرًا أبابيل ترميهم بحجارة من سجيل." }, q: [105, 3, 4] },
        { t: { en: "And the mighty army was left like eaten straw.", ar: "فجعل الجيش العظيم كعصف مأكول." }, q: [105, 5] },
        { lesson: true, t: { en: "No army is stronger than Allah. He protects His House — and He protects those who trust Him.", ar: "لا جيش أقوى من الله. هو يحمي بيته، ويحمي من توكّل عليه." } },
      ],
    },

    /* ══════ The Prophet ﷺ and his Companions ══════ */
    {
      id: "khadijah", group: "seerah", en: "Khadijah", ar: "خديجة", hue: 345,
      sub: { en: "The wife who stood by him from the very first day", ar: "الزوجة التي ساندته منذ اليوم الأول" },
      slides: [
        { t: { en: "Before prophethood, the Prophet ﷺ would go to the cave of Hira to worship Allah alone.", ar: "قبل النبوة كان النبي ﷺ يخلو بغار حراء يتعبّد لله وحده." }, src: "Sahih al-Bukhari 3" },
        { t: { en: "There, the angel Jibril brought the first words of the Qur'an:", ar: "وهناك جاءه جبريل بأول ما نزل من القرآن:" }, q: [96, 1, 5] },
        { t: { en: "He came home shaken and told his wife Khadijah what had happened.", ar: "فرجع إلى بيته يرجف فؤاده، وأخبر زوجه خديجة بما حدث." }, src: "Sahih al-Bukhari 3" },
        { t: { en: "She comforted him: “Never! By Allah, Allah will never disgrace you. You keep ties with your relatives, help the poor, honour your guests, and help people in hardship.”", ar: "فطمأنته قائلة: «كلا والله، ما يخزيك الله أبدًا؛ إنك لتصل الرحم، وتحمل الكَلّ، وتُكسب المعدوم، وتَقري الضيف، وتعين على نوائب الحق»." }, src: "Sahih al-Bukhari 3" },
        { t: { en: "Later, Jibril brought her a greeting of peace from Allah Himself, and the good news of a house in Paradise.", ar: "وبعد ذلك أقرأها جبريل السلام من ربها، وبشّرها ببيت في الجنة." }, src: "Sahih al-Bukhari 3820" },
        { t: { en: "The Prophet ﷺ said the best of the women of her time was Khadijah.", ar: "وقال النبي ﷺ إن خير نساء زمانها خديجة." }, src: "Sahih al-Bukhari 3815" },
        { lesson: true, t: { en: "Stand by the people you love when they are scared. A kind, believing word at the right moment is priceless.", ar: "قف بجانب من تحب حين يخاف. الكلمة الطيبة المؤمنة في وقتها لا تُقدَّر بثمن." } },
      ],
    },
    {
      id: "hijrah", group: "seerah", en: "The Hijrah", ar: "الهجرة", hue: 45,
      sub: { en: "“Do not grieve — Allah is with us”", ar: "«لا تحزن إن الله معنا»" },
      slides: [
        { t: { en: "When the people of Makkah plotted against the Prophet ﷺ, he left for Madinah with his friend Abu Bakr.", ar: "لما تآمر أهل مكة على النبي ﷺ خرج إلى المدينة مع صاحبه أبي بكر." }, src: "Qur'an 9:40" },
        { t: { en: "They hid in a cave while their enemies searched for them. Abu Bakr was afraid and said: “If one of them looked down at his feet, he would see us.”", ar: "واختبآ في غار والأعداء يبحثون عنهما، فخاف أبو بكر وقال: «لو أن أحدهم نظر تحت قدميه لأبصرنا»." }, src: "Sahih al-Bukhari 3653" },
        { t: { en: "The Prophet ﷺ answered: “What do you think of two, when Allah is the third of them?”", ar: "فقال النبي ﷺ: «ما ظنّك باثنين الله ثالثهما؟»" }, src: "Sahih al-Bukhari 3653" },
        { t: { en: "The Qur'an remembers this moment — and the words he said to his friend:", ar: "ويذكر القرآن هذه اللحظة، وما قاله لصاحبه:" }, q: [9, 40] },
        { lesson: true, t: { en: "When you're afraid, remember: you are never alone. Allah is with those who trust Him.", ar: "إذا خفت فتذكّر أنك لست وحدك أبدًا؛ الله مع من توكّل عليه." } },
      ],
    },
    {
      id: "bilal", group: "seerah", en: "Bilal", ar: "بلال", hue: 260,
      sub: { en: "“One, One!” — the voice of the adhan", ar: "«أحد أحد» — صوت الأذان" },
      slides: [
        { t: { en: "Bilal was one of the first people to declare his Islam openly in Makkah.", ar: "كان بلال من أول من أظهر إسلامه بمكة." }, src: "Sunan Ibn Majah 150 (hasan)" },
        { t: { en: "He was tortured in the burning sun to make him give up his faith. He only kept repeating: “Ahad, Ahad — One, One.”", ar: "وعُذّب في حرّ الشمس ليترك دينه، فلم يزد على قوله: «أحد، أحد»." }, src: "Sunan Ibn Majah 150 (hasan)" },
        { t: { en: "Abu Bakr freed him. 'Umar later said: “Abu Bakr is our master, and he freed our master” — meaning Bilal.", ar: "فأعتقه أبو بكر، وكان عمر يقول: «أبو بكر سيدنا، وأعتق سيدنا» يعني بلالًا." }, src: "Sahih al-Bukhari 3754" },
        { t: { en: "When the words of the adhan were taught in a true dream, the Prophet ﷺ chose Bilal to call it, because he had a strong voice.", ar: "ولما رُئيت كلمات الأذان في رؤيا حق، اختار النبي ﷺ بلالًا ليؤذّن لأنه أندى صوتًا." }, src: "Sunan Abi Dawud 499 (hasan sahih)" },
        { t: { en: "The Prophet ﷺ told Bilal he had heard his footsteps ahead of him in Paradise. Bilal's secret: he prayed after every wudu.", ar: "وأخبر النبي ﷺ بلالًا أنه سمع دَفّ نعليه بين يديه في الجنة، وكان سرّه أنه يصلي بعد كل وضوء." }, src: "Sahih al-Bukhari 1149" },
        { lesson: true, t: { en: "Where you come from doesn't decide your worth — your faith does. Small habits, like praying after wudu, can be great deeds.", ar: "ليس أصلك ما يحدد قيمتك بل إيمانك. والعادات الصغيرة كالصلاة بعد الوضوء قد تكون أعمالًا عظيمة." } },
      ],
    },

    /* ══════ Stories the Prophet ﷺ told ══════ */
    {
      id: "three-cave", group: "hadith", en: "The Three Men in the Cave", ar: "الثلاثة في الغار", hue: 200,
      sub: { en: "Saved by deeds done only for Allah", ar: "نجّتهم أعمال خالصة لله" },
      slides: [
        { t: { en: "The Prophet ﷺ told of three men who sheltered in a cave. A huge rock rolled down and closed the entrance.", ar: "حدّث النبي ﷺ عن ثلاثة رجال آووا إلى غار، فانحدرت صخرة فسدّت عليهم الغار." }, src: "Sahih al-Bukhari 2272" },
        { t: { en: "They agreed that only one thing could save them: to ask Allah by a good deed each had done sincerely for Him.", ar: "فاتفقوا أنه لا ينجيهم إلا أن يدعوا الله بصالح أعمالهم التي أخلصوا فيها له." }, src: "Sahih al-Bukhari 2272" },
        { t: { en: "The first had stood all night holding milk for his elderly parents, waiting for them to wake — never giving it to anyone before them. The rock moved a little.", ar: "فذكر الأول أنه وقف الليل كله بقدح اللبن ينتظر استيقاظ والديه الكبيرين، ولم يقدّم عليهما أحدًا. فانفرجت الصخرة قليلًا." }, src: "Sahih al-Bukhari 2272" },
        { t: { en: "The second had walked away from a sin he could easily have done, out of fear of Allah. The rock moved a little more.", ar: "وذكر الثاني أنه ترك معصية كان قادرًا عليها خوفًا من الله. فانفرجت أكثر." }, src: "Sahih al-Bukhari 2272" },
        { t: { en: "The third had kept a worker's unpaid wages and grown them into herds — and gave every animal to him when he returned. The rock moved away and they walked out.", ar: "وذكر الثالث أنه نمّى أجر عامل لم يأخذه حتى صار قطعانًا، فلما رجع أعطاه إياها كلها. فانفرجت الصخرة وخرجوا يمشون." }, src: "Sahih al-Bukhari 2272" },
        { lesson: true, t: { en: "Good deeds done only for Allah — kindness to parents, staying away from sin, honesty — are what save us in hard times.", ar: "الأعمال الخالصة لله — برّ الوالدين، وترك المعصية، والأمانة — هي التي تنجّينا في الشدائد." } },
      ],
    },
    {
      id: "thirsty-dog", group: "hadith", en: "Water for a Thirsty Dog", ar: "سقيا الكلب", hue: 175,
      sub: { en: "Forgiven for one act of mercy", ar: "غُفر له برحمة واحدة" },
      slides: [
        { t: { en: "The Prophet ﷺ told of a man walking who became very thirsty. He found a well, climbed down and drank.", ar: "حدّث النبي ﷺ عن رجل اشتدّ عليه العطش وهو يمشي، فوجد بئرًا فنزل فشرب." }, src: "Sahih al-Bukhari 2363" },
        { t: { en: "When he came out, he saw a dog panting and licking the mud from thirst. He thought: this dog is suffering just like I was.", ar: "فلما خرج رأى كلبًا يلهث ويأكل الثرى من العطش، فقال: لقد بلغ هذا مثل الذي بلغني." }, src: "Sahih al-Bukhari 2363" },
        { t: { en: "He climbed back down, filled his shoe with water, held it in his teeth as he climbed, and gave the dog a drink.", ar: "فنزل البئر فملأ خفّه ماءً، وأمسكه بفيه حتى رقي، فسقى الكلب." }, src: "Sahih al-Bukhari 2363" },
        { t: { en: "Allah thanked him and forgave him. The Companions asked if there is reward for kindness to animals. He said: there is reward for kindness to every living thing.", ar: "فشكر الله له فغفر له. فسأل الصحابة: أفي البهائم أجر؟ فقال: في كل كبد رطبة أجر." }, src: "Sahih al-Bukhari 2363" },
        { lesson: true, t: { en: "Never think a kind act is too small. Mercy to any living thing — even an animal — is loved by Allah.", ar: "لا تحقرنّ عملًا طيبًا. الرحمة بأي كائن حي — ولو حيوانًا — يحبها الله." } },
      ],
    },
    {
      id: "repentance", group: "hadith", en: "The Man Who Never Gave Up on Repentance", ar: "قاتل المئة", hue: 0,
      sub: { en: "No one is beyond Allah's mercy", ar: "لا أحد أبعد من رحمة الله" },
      slides: [
        { t: { en: "The Prophet ﷺ told of a man from long ago who had killed ninety-nine people. He wanted to know if he could still be forgiven.", ar: "حدّث النبي ﷺ عن رجل ممّن كان قبلنا قتل تسعة وتسعين نفسًا، ثم سأل: هل له من توبة؟" }, src: "Sahih al-Bukhari 3470" },
        { t: { en: "He asked a monk, who said no — so he killed him too. But he kept asking, and someone told him to go to a certain town of good people.", ar: "فسأل راهبًا فقال: لا، فقتله فأكمل به المئة. ثم ظل يسأل، فدُلّ على قرية فيها قوم صالحون." }, src: "Sahih al-Bukhari 3470" },
        { t: { en: "He set out, but died on the way — turning his chest toward that town as he died.", ar: "فخرج إليها، فأدركه الموت في الطريق، فنأى بصدره نحوها." }, src: "Sahih al-Bukhari 3470" },
        { t: { en: "The angels of mercy and of punishment disagreed about him. Allah had the distances measured — he was a hand's span closer to the good town, and he was forgiven.", ar: "فاختصمت فيه ملائكة الرحمة وملائكة العذاب، فأمر الله بقياس المسافة، فكان أقرب إلى القرية الصالحة بشبر، فغُفر له." }, src: "Sahih al-Bukhari 3470" },
        { t: { en: "Allah says:", ar: "يقول الله تعالى:" }, q: [39, 53] },
        { lesson: true, t: { en: "Never give up on Allah's mercy. Take the first step back to Him — and stay near good people.", ar: "لا تيأس من رحمة الله. اخطُ الخطوة الأولى إليه، والزم الصالحين." } },
      ],
    },
  ];
})();
