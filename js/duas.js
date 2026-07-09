/* SalaamStreet — dua library (classic script, exposes window.SS). */
(function () {
"use strict";
/**
 * SalaamStreet — Dua library (self-hosted).
 * Every dua carries a `source` citation. Content is drawn from the Qur'an and
 * well-known authentic hadith collections (as compiled in Hisnul Muslim).
 * Never edit Arabic text without verifying against the cited source.
 */

const DUA_CATEGORIES = [
  { id: "morning-evening", icon: "🌅", en: "Morning & Evening", ar: "أذكار الصباح والمساء" },
  { id: "sleep", icon: "🌙", en: "Sleep & Waking", ar: "أذكار النوم والاستيقاظ" },
  { id: "daily-life", icon: "🏠", en: "Daily Life", ar: "أدعية الحياة اليومية" },
  { id: "distress", icon: "🤲", en: "Distress & Anxiety", ar: "أدعية الكرب والهم" },
  { id: "travel", icon: "✈️", en: "Travel", ar: "أدعية السفر" },
  { id: "quranic", icon: "📖", en: "Duas from the Qur'an", ar: "أدعية من القرآن" },
];

const DUAS = [
  // ── Morning & Evening ──────────────────────────────────────────
  {
    id: "sayyid-istighfar", category: "morning-evening",
    titleEn: "Sayyid al-Istighfar (the best seeking of forgiveness)",
    arabic: "اللَّهُمَّ أَنْتَ رَبِّي لَا إِلَهَ إِلَّا أَنْتَ، خَلَقْتَنِي وَأَنَا عَبْدُكَ، وَأَنَا عَلَى عَهْدِكَ وَوَعْدِكَ مَا اسْتَطَعْتُ، أَعُوذُ بِكَ مِنْ شَرِّ مَا صَنَعْتُ، أَبُوءُ لَكَ بِنِعْمَتِكَ عَلَيَّ، وَأَبُوءُ بِذَنْبِي فَاغْفِرْ لِي، فَإِنَّهُ لَا يَغْفِرُ الذُّنُوبَ إِلَّا أَنْتَ",
    transliteration: "Allahumma anta Rabbi la ilaha illa ant, khalaqtani wa ana 'abduk, wa ana 'ala 'ahdika wa wa'dika ma-stata't, a'udhu bika min sharri ma sana't, abu'u laka bini'matika 'alayya, wa abu'u bidhanbi faghfir li, fa innahu la yaghfirudh-dhunuba illa ant.",
    translationEn: "O Allah, You are my Lord; there is no god but You. You created me and I am Your servant, and I abide by Your covenant and promise as best I can. I seek refuge in You from the evil of what I have done. I acknowledge Your favor upon me, and I acknowledge my sin, so forgive me — for none forgives sins but You.",
    source: "Sahih al-Bukhari 6306",
  },
  {
    id: "bismillah-protection", category: "morning-evening",
    titleEn: "Protection morning and evening (3×)",
    arabic: "بِسْمِ اللَّهِ الَّذِي لَا يَضُرُّ مَعَ اسْمِهِ شَيْءٌ فِي الْأَرْضِ وَلَا فِي السَّمَاءِ وَهُوَ السَّمِيعُ الْعَلِيمُ",
    transliteration: "Bismillahil-ladhi la yadurru ma'a-smihi shay'un fil-ardi wa la fis-sama', wa huwas-Sami'ul-'Alim.",
    translationEn: "In the name of Allah, with whose name nothing on earth or in heaven can cause harm, and He is the All-Hearing, the All-Knowing. (Said three times.)",
    source: "Abu Dawud 5088; At-Tirmidhi 3388 — graded sahih",
  },
  {
    id: "radeetu", category: "morning-evening",
    titleEn: "Contentment with Allah (3×)",
    arabic: "رَضِيتُ بِاللَّهِ رَبًّا، وَبِالْإِسْلَامِ دِينًا، وَبِمُحَمَّدٍ صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ نَبِيًّا",
    transliteration: "Raditu billahi Rabba, wa bil-Islami dina, wa bi-Muhammadin sallallahu 'alayhi wa sallama nabiyya.",
    translationEn: "I am pleased with Allah as my Lord, with Islam as my religion, and with Muhammad (peace and blessings be upon him) as my Prophet. (Said three times.)",
    source: "Abu Dawud 5072; At-Tirmidhi 3389",
  },
  {
    id: "asbahna", category: "morning-evening",
    titleEn: "Upon entering the morning",
    arabic: "اللَّهُمَّ بِكَ أَصْبَحْنَا، وَبِكَ أَمْسَيْنَا، وَبِكَ نَحْيَا، وَبِكَ نَمُوتُ، وَإِلَيْكَ النُّشُورُ",
    transliteration: "Allahumma bika asbahna, wa bika amsayna, wa bika nahya, wa bika namutu, wa ilaykan-nushur.",
    translationEn: "O Allah, by You we enter the morning and by You we enter the evening; by You we live and by You we die, and to You is the resurrection. (In the evening: '…by You we enter the evening… and to You is the final return.')",
    source: "At-Tirmidhi 3391; Abu Dawud 5068",
  },
  // ── Sleep & Waking ─────────────────────────────────────────────
  {
    id: "sleep-bismika", category: "sleep",
    titleEn: "Before sleeping",
    arabic: "بِاسْمِكَ اللَّهُمَّ أَمُوتُ وَأَحْيَا",
    transliteration: "Bismika Allahumma amutu wa ahya.",
    translationEn: "In Your name, O Allah, I die and I live.",
    source: "Sahih al-Bukhari 6324",
  },
  {
    id: "wake-alhamdu", category: "sleep",
    titleEn: "Upon waking",
    arabic: "الْحَمْدُ لِلَّهِ الَّذِي أَحْيَانَا بَعْدَ مَا أَمَاتَنَا وَإِلَيْهِ النُّشُورُ",
    transliteration: "Alhamdu lillahil-ladhi ahyana ba'da ma amatana wa ilayhin-nushur.",
    translationEn: "All praise is for Allah who gave us life after having taken it from us, and to Him is the resurrection.",
    source: "Sahih al-Bukhari 6312",
  },
  // ── Daily Life ─────────────────────────────────────────────────
  {
    id: "leaving-home", category: "daily-life",
    titleEn: "Leaving the home",
    arabic: "بِسْمِ اللَّهِ، تَوَكَّلْتُ عَلَى اللَّهِ، وَلَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ",
    transliteration: "Bismillah, tawakkaltu 'alallah, wa la hawla wa la quwwata illa billah.",
    translationEn: "In the name of Allah, I place my trust in Allah, and there is no might nor power except with Allah.",
    source: "Abu Dawud 5095; At-Tirmidhi 3426 — graded sahih",
  },
  {
    id: "entering-mosque", category: "daily-life",
    titleEn: "Entering the mosque",
    arabic: "اللَّهُمَّ افْتَحْ لِي أَبْوَابَ رَحْمَتِكَ",
    transliteration: "Allahumma-ftah li abwaba rahmatik.",
    translationEn: "O Allah, open for me the gates of Your mercy.",
    source: "Sahih Muslim 713",
  },
  {
    id: "before-eating", category: "daily-life",
    titleEn: "Before eating",
    arabic: "بِسْمِ اللَّهِ",
    transliteration: "Bismillah.",
    translationEn: "In the name of Allah. (If one forgets at the start: 'Bismillahi awwalahu wa akhirahu' — In the name of Allah at its beginning and its end.)",
    source: "Abu Dawud 3767; At-Tirmidhi 1858",
  },
  {
    id: "after-eating", category: "daily-life",
    titleEn: "After eating",
    arabic: "الْحَمْدُ لِلَّهِ الَّذِي أَطْعَمَنِي هَذَا وَرَزَقَنِيهِ مِنْ غَيْرِ حَوْلٍ مِنِّي وَلَا قُوَّةٍ",
    transliteration: "Alhamdu lillahil-ladhi at'amani hadha wa razaqanihi min ghayri hawlin minni wa la quwwah.",
    translationEn: "All praise is for Allah who fed me this and provided it for me, without any might or power on my part.",
    source: "Abu Dawud 4023; At-Tirmidhi 3458 — graded hasan",
  },
  // ── Distress & Anxiety ─────────────────────────────────────────
  {
    id: "distress-tahlil", category: "distress",
    titleEn: "At times of distress",
    arabic: "لَا إِلَهَ إِلَّا اللَّهُ الْعَظِيمُ الْحَلِيمُ، لَا إِلَهَ إِلَّا اللَّهُ رَبُّ الْعَرْشِ الْعَظِيمِ، لَا إِلَهَ إِلَّا اللَّهُ رَبُّ السَّمَاوَاتِ وَرَبُّ الْأَرْضِ وَرَبُّ الْعَرْشِ الْكَرِيمِ",
    transliteration: "La ilaha illallahul-'Azimul-Halim, la ilaha illallahu Rabbul-'Arshil-'Azim, la ilaha illallahu Rabbus-samawati wa Rabbul-ardi wa Rabbul-'Arshil-Karim.",
    translationEn: "There is no god but Allah, the Magnificent, the Forbearing. There is no god but Allah, Lord of the Magnificent Throne. There is no god but Allah, Lord of the heavens, Lord of the earth, and Lord of the Noble Throne.",
    source: "Sahih al-Bukhari 6346; Sahih Muslim 2730",
  },
  {
    id: "dua-yunus", category: "distress",
    titleEn: "The supplication of Yunus (peace be upon him)",
    arabic: "لَا إِلَهَ إِلَّا أَنْتَ سُبْحَانَكَ إِنِّي كُنْتُ مِنَ الظَّالِمِينَ",
    transliteration: "La ilaha illa anta subhanaka inni kuntu minaz-zalimin.",
    translationEn: "There is no god but You; exalted are You. Indeed, I have been of the wrongdoers.",
    source: "Qur'an 21:87; At-Tirmidhi 3505",
  },
  {
    id: "anxiety-refuge", category: "distress",
    titleEn: "Refuge from anxiety and sorrow",
    arabic: "اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنَ الْهَمِّ وَالْحَزَنِ، وَالْعَجْزِ وَالْكَسَلِ، وَالْبُخْلِ وَالْجُبْنِ، وَضَلَعِ الدَّيْنِ وَغَلَبَةِ الرِّجَالِ",
    transliteration: "Allahumma inni a'udhu bika minal-hammi wal-hazan, wal-'ajzi wal-kasal, wal-bukhli wal-jubn, wa dala'id-dayni wa ghalabatir-rijal.",
    translationEn: "O Allah, I seek refuge in You from anxiety and sorrow, from incapacity and laziness, from miserliness and cowardice, and from the burden of debt and being overpowered by men.",
    source: "Sahih al-Bukhari 6369",
  },
  // ── Travel ─────────────────────────────────────────────────────
  {
    id: "travel-mount", category: "travel",
    titleEn: "When mounting/boarding for travel",
    arabic: "سُبْحَانَ الَّذِي سَخَّرَ لَنَا هَذَا وَمَا كُنَّا لَهُ مُقْرِنِينَ وَإِنَّا إِلَى رَبِّنَا لَمُنْقَلِبُونَ",
    transliteration: "Subhanal-ladhi sakhkhara lana hadha wa ma kunna lahu muqrinin, wa inna ila Rabbina lamunqalibun.",
    translationEn: "Glory be to the One who subjected this for us, for we could never have done so ourselves — and indeed, to our Lord we shall return.",
    source: "Qur'an 43:13–14; Sahih Muslim 1342 (travel dua)",
  },
  // ── Duas from the Qur'an ───────────────────────────────────────
  {
    id: "rabbana-dunya", category: "quranic",
    titleEn: "Good in this world and the next",
    arabic: "رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الْآخِرَةِ حَسَنَةً وَقِنَا عَذَابَ النَّارِ",
    transliteration: "Rabbana atina fid-dunya hasanatan wa fil-akhirati hasanatan wa qina 'adhaban-nar.",
    translationEn: "Our Lord, give us good in this world and good in the Hereafter, and protect us from the punishment of the Fire.",
    source: "Qur'an 2:201",
  },
  {
    id: "rabbi-zidni", category: "quranic",
    titleEn: "Increase in knowledge",
    arabic: "رَبِّ زِدْنِي عِلْمًا",
    transliteration: "Rabbi zidni 'ilma.",
    translationEn: "My Lord, increase me in knowledge.",
    source: "Qur'an 20:114",
  },
  {
    id: "rabbi-irhamhuma", category: "quranic",
    titleEn: "For one's parents",
    arabic: "رَبِّ ارْحَمْهُمَا كَمَا رَبَّيَانِي صَغِيرًا",
    transliteration: "Rabbi-rhamhuma kama rabbayani saghira.",
    translationEn: "My Lord, have mercy upon them as they brought me up when I was small.",
    source: "Qur'an 17:24",
  },
  {
    id: "rabbi-shrah", category: "quranic",
    titleEn: "The supplication of Musa (peace be upon him)",
    arabic: "رَبِّ اشْرَحْ لِي صَدْرِي وَيَسِّرْ لِي أَمْرِي وَاحْلُلْ عُقْدَةً مِنْ لِسَانِي يَفْقَهُوا قَوْلِي",
    transliteration: "Rabbi-shrah li sadri, wa yassir li amri, wahlul 'uqdatan min lisani, yafqahu qawli.",
    translationEn: "My Lord, expand for me my chest, ease for me my task, and untie the knot from my tongue so that they may understand my speech.",
    source: "Qur'an 20:25–28",
  },
];

/** Common dhikr presets with sources (used by the dhikr counter). */
const DHIKR_PRESETS = [
  { id: "subhanallah", ar: "سُبْحَانَ اللَّهِ", en: "SubhanAllah", target: 33, source: "Sahih Muslim 596 (after prayer)" },
  { id: "alhamdulillah", ar: "الْحَمْدُ لِلَّهِ", en: "Alhamdulillah", target: 33, source: "Sahih Muslim 596" },
  { id: "allahuakbar", ar: "اللَّهُ أَكْبَرُ", en: "Allahu Akbar", target: 34, source: "Sahih Muslim 596" },
  { id: "istighfar", ar: "أَسْتَغْفِرُ اللَّهَ", en: "Astaghfirullah", target: 100, source: "Sahih Muslim 2702" },
  { id: "salawat", ar: "اللَّهُمَّ صَلِّ عَلَى مُحَمَّدٍ", en: "Salawat on the Prophet ﷺ", target: 100, source: "cf. Qur'an 33:56" },
  { id: "tahlil", ar: "لَا إِلَهَ إِلَّا اللَّهُ", en: "La ilaha illallah", target: 100, source: "Sahih al-Bukhari 6403 (virtue of 100×)" },
];
window.SS = window.SS || {};
Object.assign(window.SS, { DUA_CATEGORIES: DUA_CATEGORIES, DUAS: DUAS, DHIKR_PRESETS: DHIKR_PRESETS });
})();
