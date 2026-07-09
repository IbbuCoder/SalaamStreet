namespace SalaamStreet.Desktop.Models;

public record DuaCategory(string Id, string Icon, string En);
public record Dua(string Category, string TitleEn, string Arabic, string Transliteration, string TranslationEn, string Source);
public record DhikrPreset(string Id, string Arabic, string En, int Target, string Source);
public record IslamicEvent(int Month, int Day, string En, string Note);
public record HadithCollection(string Id, string En, string Eng, string Ara, bool Bounded, string Cite);
public record PremiumFeature(string Icon, string En, bool Live);
public record Plan(string Id, string En, decimal Price, string Per);

/// <summary>Self-hosted content: duas, dhikr, Islamic events, and catalogue
/// data for hadith / premium. Qur'an/hadith come from cited sources.</summary>
public static class ContentData
{
    public static readonly DuaCategory[] DuaCategories =
    {
        new("morning-evening", "🌅", "Morning & Evening"),
        new("sleep", "🌙", "Sleep & Waking"),
        new("daily-life", "🏠", "Daily Life"),
        new("distress", "🤲", "Distress & Anxiety"),
        new("quranic", "📖", "Duas from the Qur'an"),
    };

    public static readonly Dua[] Duas =
    {
        new("morning-evening", "Sayyid al-Istighfar",
            "اللَّهُمَّ أَنْتَ رَبِّي لَا إِلَهَ إِلَّا أَنْتَ، خَلَقْتَنِي وَأَنَا عَبْدُكَ، وَأَنَا عَلَى عَهْدِكَ وَوَعْدِكَ مَا اسْتَطَعْتُ، أَعُوذُ بِكَ مِنْ شَرِّ مَا صَنَعْتُ، أَبُوءُ لَكَ بِنِعْمَتِكَ عَلَيَّ، وَأَبُوءُ بِذَنْبِي فَاغْفِرْ لِي، فَإِنَّهُ لَا يَغْفِرُ الذُّنُوبَ إِلَّا أَنْتَ",
            "Allahumma anta Rabbi la ilaha illa ant…",
            "O Allah, You are my Lord; there is no god but You. You created me and I am Your servant… forgive me, for none forgives sins but You.",
            "Sahih al-Bukhari 6306"),
        new("morning-evening", "Protection morning and evening (3×)",
            "بِسْمِ اللَّهِ الَّذِي لَا يَضُرُّ مَعَ اسْمِهِ شَيْءٌ فِي الْأَرْضِ وَلَا فِي السَّمَاءِ وَهُوَ السَّمِيعُ الْعَلِيمُ",
            "Bismillahil-ladhi la yadurru ma'a-smihi shay'un fil-ardi wa la fis-sama', wa huwas-Sami'ul-'Alim.",
            "In the name of Allah, with whose name nothing on earth or in heaven can cause harm; He is the All-Hearing, All-Knowing. (×3)",
            "Abu Dawud 5088; At-Tirmidhi 3388 — sahih"),
        new("sleep", "Before sleeping",
            "بِاسْمِكَ اللَّهُمَّ أَمُوتُ وَأَحْيَا",
            "Bismika Allahumma amutu wa ahya.",
            "In Your name, O Allah, I die and I live.",
            "Sahih al-Bukhari 6324"),
        new("sleep", "Upon waking",
            "الْحَمْدُ لِلَّهِ الَّذِي أَحْيَانَا بَعْدَ مَا أَمَاتَنَا وَإِلَيْهِ النُّشُورُ",
            "Alhamdu lillahil-ladhi ahyana ba'da ma amatana wa ilayhin-nushur.",
            "All praise is for Allah who gave us life after death, and to Him is the resurrection.",
            "Sahih al-Bukhari 6312"),
        new("daily-life", "Leaving the home",
            "بِسْمِ اللَّهِ، تَوَكَّلْتُ عَلَى اللَّهِ، وَلَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ",
            "Bismillah, tawakkaltu 'alallah, wa la hawla wa la quwwata illa billah.",
            "In the name of Allah, I place my trust in Allah; there is no might nor power except with Allah.",
            "Abu Dawud 5095; At-Tirmidhi 3426 — sahih"),
        new("daily-life", "Before eating",
            "بِسْمِ اللَّهِ",
            "Bismillah.",
            "In the name of Allah. (If forgotten at the start: 'Bismillahi awwalahu wa akhirahu'.)",
            "Abu Dawud 3767; At-Tirmidhi 1858"),
        new("distress", "The supplication of Yunus (AS)",
            "لَا إِلَهَ إِلَّا أَنْتَ سُبْحَانَكَ إِنِّي كُنْتُ مِنَ الظَّالِمِينَ",
            "La ilaha illa anta subhanaka inni kuntu minaz-zalimin.",
            "There is no god but You; exalted are You. Indeed, I have been of the wrongdoers.",
            "Qur'an 21:87; At-Tirmidhi 3505"),
        new("distress", "Refuge from anxiety and sorrow",
            "اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنَ الْهَمِّ وَالْحَزَنِ، وَالْعَجْزِ وَالْكَسَلِ",
            "Allahumma inni a'udhu bika minal-hammi wal-hazan, wal-'ajzi wal-kasal…",
            "O Allah, I seek refuge in You from anxiety and sorrow, from incapacity and laziness…",
            "Sahih al-Bukhari 6369"),
        new("quranic", "Good in this world and the next",
            "رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الْآخِرَةِ حَسَنَةً وَقِنَا عَذَابَ النَّارِ",
            "Rabbana atina fid-dunya hasanatan wa fil-akhirati hasanatan wa qina 'adhaban-nar.",
            "Our Lord, give us good in this world and good in the Hereafter, and protect us from the punishment of the Fire.",
            "Qur'an 2:201"),
        new("quranic", "Increase in knowledge",
            "رَبِّ زِدْنِي عِلْمًا",
            "Rabbi zidni 'ilma.",
            "My Lord, increase me in knowledge.",
            "Qur'an 20:114"),
        new("quranic", "For one's parents",
            "رَبِّ ارْحَمْهُمَا كَمَا رَبَّيَانِي صَغِيرًا",
            "Rabbi-rhamhuma kama rabbayani saghira.",
            "My Lord, have mercy upon them as they brought me up when I was small.",
            "Qur'an 17:24"),
    };

    public static readonly DhikrPreset[] Dhikr =
    {
        new("subhanallah", "سُبْحَانَ اللَّهِ", "SubhanAllah", 33, "Sahih Muslim 596"),
        new("alhamdulillah", "الْحَمْدُ لِلَّهِ", "Alhamdulillah", 33, "Sahih Muslim 596"),
        new("allahuakbar", "اللَّهُ أَكْبَرُ", "Allahu Akbar", 34, "Sahih Muslim 596"),
        new("istighfar", "أَسْتَغْفِرُ اللَّهَ", "Astaghfirullah", 100, "Sahih Muslim 2702"),
        new("tahlil", "لَا إِلَهَ إِلَّا اللَّهُ", "La ilaha illallah", 100, "Sahih al-Bukhari 6403"),
    };

    public static readonly IslamicEvent[] Events =
    {
        new(1, 1, "Islamic New Year", ""),
        new(1, 10, "Day of Ashura", "Recommended fast (Sahih Muslim 1134)."),
        new(3, 12, "Mawlid an-Nabi", "Observance differs among scholars."),
        new(7, 27, "Isra & Mi'raj", "Date and observance differ among scholars."),
        new(9, 1, "Start of Ramadan", "Subject to moon-sighting."),
        new(9, 27, "Laylat al-Qadr (sought)", "Sought in the last ten nights (Bukhari 2017)."),
        new(10, 1, "Eid al-Fitr", "Subject to moon-sighting."),
        new(12, 9, "Day of Arafah", "Recommended fast for non-pilgrims (Muslim 1162)."),
        new(12, 10, "Eid al-Adha", ""),
    };

    public static readonly string[] HijriMonths =
    {
        "Muharram","Safar","Rabi al-Awwal","Rabi al-Thani","Jumada al-Awwal","Jumada al-Thani",
        "Rajab","Sha'ban","Ramadan","Shawwal","Dhul-Qi'dah","Dhul-Hijjah",
    };

    public static readonly HadithCollection[] HadithCollections =
    {
        new("nawawi", "40 Hadith Nawawi", "eng-nawawi", "ara-nawawi", true, "Nawawi's Forty Hadith"),
        new("qudsi", "40 Hadith Qudsi", "eng-qudsi", "ara-qudsi", true, "Forty Hadith Qudsi"),
        new("bukhari", "Sahih al-Bukhari", "eng-bukhari", "ara-bukhari", false, "Sahih al-Bukhari"),
        new("muslim", "Sahih Muslim", "eng-muslim", "ara-muslim", false, "Sahih Muslim"),
    };

    public static readonly PremiumFeature[] PremiumFeatures =
    {
        new("🎨", "Premium themes", true),
        new("🗂️", "Collections (organise bookmarks)", true),
        new("📝", "Unlimited notes on ayat", true),
        new("📊", "Premium dashboard & analytics", true),
        new("🅰️", "Quranic Arabic course", false),
        new("🗣️", "Modern Standard Arabic course", false),
        new("🤖", "AI Arabic tutor", false),
        new("🧠", "Memorization planner", false),
        new("📐", "Grammar lessons", false),
        new("🃏", "Full flashcard decks", false),
        new("❓", "Quizzes", false),
        new("📅", "Study planner", false),
    };

    public static readonly Plan[] Plans =
    {
        new("monthly", "Monthly", 4.99m, "/mo"),
        new("yearly", "Yearly", 39.99m, "/yr"),
        new("lifetime", "Lifetime", 99.00m, "one-time"),
    };

    public const string PayPalMe = "https://www.paypal.com/paypalme/aqmoha";
}
