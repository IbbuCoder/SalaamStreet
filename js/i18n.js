/* SalaamStreet — i18n.js (classic script)
   English text is baked into the HTML, so the site is readable even before
   (or without) JavaScript. This module swaps text via data-i18n attributes. */
(function () {
  "use strict";
  window.SS = window.SS || {};

  var MSG = {
    en: {
      "nav.dashboard": "Dashboard", "nav.prayer": "Prayer Times", "nav.qibla": "Qibla",
      "nav.quran": "Qur'an", "nav.duas": "Duas", "nav.dhikr": "Dhikr", "nav.settings": "Settings",
      "nav.apps": "Apps",

      "apps.title": "SalaamStreet Apps", "apps.sub": "Take SalaamStreet beyond the browser.",
      "apps.windows": "SalaamStreet for Windows",
      "apps.windowsDesc": "A real native Windows app (C# / .NET 8) — not a browser window. Offline Qur'an, prayer reminders, tray notifications, a full-screen study mode, Arabic flashcards, and account sync.",
      "apps.download": "Download for Windows",
      "apps.free": "Free · no account needed",
      "apps.smartscreen": "Note: this is a new unsigned app, so Windows SmartScreen may show a warning. Choose \"More info\" → \"Run anyway\".",
      "apps.soon": "Unlocked in upcoming app updates",
      "apps.f1": "Adhan notifications", "apps.f1d": "Hear the call to prayer at every prayer time, even when the app is closed.",
      "apps.f2": "Full offline mode", "apps.f2d": "Download the complete Qur'an text and your favorite reciter for use without internet.",
      "apps.f3": "System-tray countdown", "apps.f3d": "Always-visible countdown to the next prayer in your Windows taskbar.",
      "apps.f4": "Auto location updates", "apps.f4d": "Prayer times that follow you automatically when you travel.",
      "apps.f5": "Ramadan mode", "apps.f5d": "Suhoor and iftar timers, fasting tracker, and Taraweeh reading plans.",
      "apps.f6": "Advanced statistics", "apps.f6d": "Deeper insights into your dhikr streaks, reading progress, and prayer consistency.",
      "apps.webNote": "Everything else you see on this site — prayer times, Qur'an with audio, duas, dhikr — is already free in the web version.",

      "nav.hadith": "Hadith", "nav.calendar": "Calendar", "nav.premium": "Premium",

      "hadith.title": "Hadith Library",
      "hadith.sub": "Authentic collections with Arabic, English, grading, and reference on every hadith.",
      "hadith.reference": "Reference", "hadith.grade": "Grading",
      "hadith.browse": "Browse by number", "hadith.number": "Hadith number", "hadith.go": "Go",
      "hadith.disclaimer": "Text served from the open hadith-api. Always verify important rulings with qualified scholars.",

      "tafsir.title": "Tafsir", "tafsir.ibnkathir": "Tafsir Ibn Kathir (abridged, English)",
      "tafsir.button": "Tafsir", "tafsir.none": "No tafsir available for this ayah.",
      "tafsir.source": "Source: Tafsir Ibn Kathir via the open tafsir_api.",

      "cal.title": "Islamic Calendar", "cal.sub": "Today's Hijri date and key Islamic dates.",
      "cal.today": "Today", "cal.hijri": "Hijri", "cal.gregorian": "Gregorian",
      "cal.keyDates": "Key Islamic dates", "cal.upcoming": "Upcoming this year",
      "cal.note": "Gregorian dates depend on moon-sighting and calculation method, and some observances differ among scholars.",

      "premium.title": "SalaamStreet Premium",
      "premium.sub": "Support the project and unlock deeper study tools. Core worship features stay free, always.",
      "premium.free": "Free forever", "premium.included": "Included in Premium",
      "premium.live": "Available now", "premium.soon": "Coming soon",
      "premium.choosePlan": "Choose a plan", "premium.best": "Best value",
      "premium.upgrade": "Upgrade", "premium.perMonth": "/mo", "premium.perYear": "/yr", "premium.oneTime": "one-time",
      "premium.active": "Premium active", "premium.manage": "Manage membership",
      "premium.freeList": "Prayer times, Qibla, full Qur'an with audio, duas, dhikr, hadith, tafsir, calendar.",

      "checkout.title": "Checkout", "checkout.plan": "Plan", "checkout.total": "Total",
      "checkout.payWith": "Pay with PayPal", "checkout.payNote": "You'll pay securely via PayPal to @aqmoha, then return here to activate.",
      "checkout.confirm": "I've completed payment", "checkout.confirmNote": "Enter your PayPal transaction ID or the email you paid with, then activate. (Provisional activation on this device until server verification is added.)",
      "checkout.reference": "PayPal transaction ID or email", "checkout.activate": "Activate Premium",
      "checkout.cancel": "Cancel", "checkout.back": "Back to plans",

      "premium.successTitle": "Welcome to Premium 🎉",
      "premium.successBody": "Premium is now active on this device. JazakAllahu khayran for supporting SalaamStreet.",
      "premium.cancelTitle": "Checkout cancelled",
      "premium.cancelBody": "No payment was made. You can upgrade any time.",

      "membership.title": "Membership", "membership.status": "Status",
      "membership.statusActive": "Active", "membership.statusFree": "Free",
      "membership.plan": "Plan", "membership.since": "Member since", "membership.renews": "Renews / expires",
      "membership.restore": "I already paid — activate", "membership.cancelMembership": "Deactivate on this device",
      "membership.note": "Membership is stored on this device. On a static site there is no server to verify payments yet — this is provisional and designed to move to server-side PayPal verification later.",

      "common.loading": "Loading…", "common.retry": "Try again", "common.error": "Something went wrong.",
      "common.offlineCache": "Showing saved data (offline).", "common.save": "Save",
      "common.play": "Play",

      "dash.greeting": "As-salamu alaykum",
      "dash.nextPrayer": "Next prayer", "dash.dailyAyah": "Ayah of the day",
      "dash.tomorrow": "tomorrow",
      "dash.continueReading": "Continue reading", "dash.startReading": "Start reading the Qur'an",
      "dash.dhikrStreak": "Dhikr streak", "dash.days": "days", "dash.continueDhikr": "Open counter",
      "dash.setLocation": "Set your location for accurate prayer times", "dash.setLocationBtn": "Set location",

      "prayer.title": "Prayer Times",
      "prayer.sub": "Times are calculated for your location using your chosen method.",
      "prayer.method": "Calculation method", "prayer.asr": "Asr method",
      "prayer.monthly": "Monthly view", "prayer.daily": "Today", "prayer.next": "Next",
      "prayer.methodNote": "Scholars differ on calculation parameters — choose the method used by your local mosque or region.",
      "prayer.Fajr": "Fajr", "prayer.Sunrise": "Sunrise", "prayer.Dhuhr": "Dhuhr",
      "prayer.Asr": "Asr", "prayer.Maghrib": "Maghrib", "prayer.Isha": "Isha",

      "qibla.title": "Qibla Finder", "qibla.sub": "Direction to the Kaaba from your location.",
      "qibla.fromNorth": "from North", "qibla.enableCompass": "Enable compass",
      "qibla.calibrate": "Move your phone in a figure-8 to calibrate the compass.",
      "qibla.noCompass": "Compass not available on this device — use the bearing below with a map or physical compass.",
      "qibla.aligned": "You are facing the Qibla",

      "quran.title": "The Noble Qur'an", "quran.sub": "Uthmani script · Saheeh International translation",
      "quran.search": "Search surahs…", "quran.resume": "Resume", "quran.verses": "verses",
      "quran.meccan": "Meccan", "quran.medinan": "Medinan",
      "quran.translation": "Translation", "quran.transliteration": "Transliteration",
      "quran.reciter": "Reciter", "quran.playSurah": "Play surah",
      "quran.bookmark": "Bookmark", "quran.bookmarked": "Bookmarked",
      "quran.prev": "Previous", "quran.next": "Next",
      "quran.source": "Text: Tanzil Uthmani via AlQuran Cloud · Translation: Saheeh International",

      "duas.title": "Dua Library",
      "duas.sub": "Authentic supplications with sources — every dua cites the Qur'an or a graded hadith.",
      "duas.favorites": "Favorites", "duas.source": "Source",
      "duas.empty": "No favorites yet — tap the star on any dua.",

      "dhikr.title": "Dhikr Counter", "dhikr.sub": "Remembrance of Allah — with daily streaks.",
      "dhikr.tap": "Tap to count", "dhikr.reset": "Reset", "dhikr.target": "Target",
      "dhikr.currentStreak": "Current streak", "dhikr.longestStreak": "Longest streak",
      "dhikr.completed": "Target reached — may Allah accept.",

      "settings.title": "Settings", "settings.language": "Language", "settings.theme": "Theme",
      "settings.themeLight": "Light", "settings.themeDark": "Dark", "settings.themeSystem": "System",
      "settings.location": "Location", "settings.locationSet": "Saved location",
      "settings.locationNone": "No location saved", "settings.locationClear": "Clear location",
      "settings.useDevice": "Use device location", "settings.transliteration": "Show transliteration",
      "settings.data": "Your data", "settings.export": "Export my data", "settings.deleteAll": "Delete all my data",
      "settings.deleteConfirm": "This deletes all SalaamStreet data on this device (bookmarks, streaks, settings). Continue?",
      "settings.privacyNote": "All your data stays on this device. Your coordinates are sent only to the prayer-times service (AlAdhan) to calculate times, and are never stored on a server by us.",

      "loc.title": "Location access",
      "loc.body": "We use your location only to provide accurate prayer times, Qibla direction, nearby mosques, and halal businesses.",
      "loc.allowWhile": "Allow while using app", "loc.allowOnce": "Allow once",
      "loc.manual": "Enter location manually", "loc.deny": "Don't allow",
      "loc.manualTitle": "Enter your city", "loc.manualPlaceholder": "e.g. London, Dubai, Karachi",
      "loc.denied": "Location off — times shown are approximate. You can set a city in Settings.",
      "loc.error": "Could not get your location. You can enter a city manually.",
      "loc.searching": "Finding city…", "loc.notFound": "City not found — try a different spelling.",
      "loc.approx": "Approximate — based on your device's time zone. Set your location for exact times.",
      "loc.fallbackNote": "No location set — showing times for Makkah.",
    },

    ar: {
      "nav.dashboard": "الرئيسية", "nav.prayer": "مواقيت الصلاة", "nav.qibla": "القبلة",
      "nav.quran": "القرآن", "nav.duas": "الأدعية", "nav.dhikr": "الذكر", "nav.settings": "الإعدادات",
      "nav.apps": "التطبيقات",

      "apps.title": "تطبيقات سلام ستريت", "apps.sub": "سلام ستريت خارج المتصفح.",
      "apps.windows": "سلام ستريت لويندوز",
      "apps.windowsDesc": "تطبيق ويندوز أصلي حقيقي (C# / .NET 8) — وليس نافذة متصفح. قرآن بدون اتصال، تنبيهات الصلاة، إشعارات، وضع دراسة بملء الشاشة، بطاقات عربية، ومزامنة الحساب.",
      "apps.download": "تنزيل مثبّت ويندوز",
      "apps.free": "مجاني · بدون حساب",
      "apps.smartscreen": "ملاحظة: هذا تطبيق جديد غير موقّع، فقد يعرض ويندوز SmartScreen تحذيرًا. اختر \"More info\" ثم \"Run anyway\".",
      "apps.soon": "ميزات قادمة في تحديثات التطبيق",
      "apps.f1": "إشعارات الأذان", "apps.f1d": "اسمع الأذان عند كل صلاة حتى عندما يكون التطبيق مغلقًا.",
      "apps.f2": "وضع عدم الاتصال الكامل", "apps.f2d": "حمّل نص القرآن كاملًا وقارئك المفضل للاستخدام بدون إنترنت.",
      "apps.f3": "عدّاد في شريط المهام", "apps.f3d": "عدّ تنازلي دائم الظهور للصلاة القادمة في شريط مهام ويندوز.",
      "apps.f4": "تحديث الموقع تلقائيًا", "apps.f4d": "مواقيت صلاة تتبعك تلقائيًا أثناء السفر.",
      "apps.f5": "وضع رمضان", "apps.f5d": "مؤقّتا السحور والإفطار، ومتابعة الصيام، وخطط قراءة التراويح.",
      "apps.f6": "إحصاءات متقدمة", "apps.f6d": "رؤى أعمق في سلاسل الذكر وتقدم القراءة والمواظبة على الصلاة.",
      "apps.webNote": "كل ما تراه في هذا الموقع — المواقيت والقرآن بالصوت والأدعية والذكر — متاح مجانًا في نسخة الويب.",

      "nav.hadith": "الحديث", "nav.calendar": "التقويم", "nav.premium": "المميز",

      "hadith.title": "مكتبة الحديث",
      "hadith.sub": "مجموعات موثوقة مع النص العربي والإنجليزي ودرجة الحديث والمرجع لكل حديث.",
      "hadith.reference": "المرجع", "hadith.grade": "الدرجة",
      "hadith.browse": "تصفّح بالرقم", "hadith.number": "رقم الحديث", "hadith.go": "اذهب",
      "hadith.disclaimer": "النص من hadith-api المفتوح. تحقّق دائمًا من الأحكام المهمة مع أهل العلم.",

      "tafsir.title": "التفسير", "tafsir.ibnkathir": "تفسير ابن كثير (مختصر، بالإنجليزية)",
      "tafsir.button": "التفسير", "tafsir.none": "لا يوجد تفسير متاح لهذه الآية.",
      "tafsir.source": "المصدر: تفسير ابن كثير عبر tafsir_api المفتوح.",

      "cal.title": "التقويم الهجري", "cal.sub": "تاريخ اليوم الهجري وأهم المناسبات الإسلامية.",
      "cal.today": "اليوم", "cal.hijri": "هجري", "cal.gregorian": "ميلادي",
      "cal.keyDates": "مناسبات إسلامية مهمة", "cal.upcoming": "القادمة هذا العام",
      "cal.note": "تعتمد التواريخ الميلادية على رؤية الهلال وطريقة الحساب، وتختلف بعض المناسبات باختلاف العلماء.",

      "premium.title": "سلام ستريت المميز",
      "premium.sub": "ادعم المشروع وافتح أدوات دراسة أعمق. تبقى ميزات العبادة الأساسية مجانية دائمًا.",
      "premium.free": "مجاني للأبد", "premium.included": "مضمّن في المميز",
      "premium.live": "متاح الآن", "premium.soon": "قريبًا",
      "premium.choosePlan": "اختر خطة", "premium.best": "الأفضل قيمة",
      "premium.upgrade": "ترقية", "premium.perMonth": "/شهر", "premium.perYear": "/سنة", "premium.oneTime": "مرة واحدة",
      "premium.active": "المميز مفعّل", "premium.manage": "إدارة العضوية",
      "premium.freeList": "مواقيت الصلاة، القبلة، القرآن كاملًا بالصوت، الأدعية، الذكر، الحديث، التفسير، التقويم.",

      "checkout.title": "الدفع", "checkout.plan": "الخطة", "checkout.total": "الإجمالي",
      "checkout.payWith": "ادفع عبر PayPal", "checkout.payNote": "ستدفع بأمان عبر PayPal إلى ‎@aqmoha ثم تعود هنا للتفعيل.",
      "checkout.confirm": "أتممتُ الدفع", "checkout.confirmNote": "أدخل رقم عملية PayPal أو البريد الذي دفعت به ثم فعّل. (تفعيل مبدئي على هذا الجهاز حتى تُضاف مراجعة عبر الخادم.)",
      "checkout.reference": "رقم عملية PayPal أو البريد", "checkout.activate": "تفعيل المميز",
      "checkout.cancel": "إلغاء", "checkout.back": "العودة للخطط",

      "premium.successTitle": "أهلًا بك في المميز 🎉",
      "premium.successBody": "تم تفعيل المميز على هذا الجهاز. جزاك الله خيرًا لدعمك سلام ستريت.",
      "premium.cancelTitle": "أُلغي الدفع",
      "premium.cancelBody": "لم يتم أي دفع. يمكنك الترقية في أي وقت.",

      "membership.title": "العضوية", "membership.status": "الحالة",
      "membership.statusActive": "مفعّلة", "membership.statusFree": "مجانية",
      "membership.plan": "الخطة", "membership.since": "عضو منذ", "membership.renews": "التجديد / الانتهاء",
      "membership.restore": "دفعتُ بالفعل — فعّل", "membership.cancelMembership": "إلغاء التفعيل على هذا الجهاز",
      "membership.note": "تُحفظ العضوية على هذا الجهاز. لا يوجد بعد خادم للتحقق من الدفع في الموقع الثابت — هذا مبدئي ومصمّم للانتقال إلى تحقّق PayPal عبر الخادم لاحقًا.",

      "common.loading": "جارٍ التحميل…", "common.retry": "أعد المحاولة", "common.error": "حدث خطأ ما.",
      "common.offlineCache": "عرض بيانات محفوظة (بدون اتصال).", "common.save": "حفظ",
      "common.play": "تشغيل",

      "dash.greeting": "السلام عليكم",
      "dash.nextPrayer": "الصلاة القادمة", "dash.dailyAyah": "آية اليوم",
      "dash.tomorrow": "غدًا",
      "dash.continueReading": "متابعة القراءة", "dash.startReading": "ابدأ قراءة القرآن",
      "dash.dhikrStreak": "سلسلة الذكر", "dash.days": "يوم", "dash.continueDhikr": "افتح العداد",
      "dash.setLocation": "حدّد موقعك لمواقيت صلاة دقيقة", "dash.setLocationBtn": "تحديد الموقع",

      "prayer.title": "مواقيت الصلاة",
      "prayer.sub": "تُحسب المواقيت لموقعك وفق الطريقة التي تختارها.",
      "prayer.method": "طريقة الحساب", "prayer.asr": "مذهب العصر",
      "prayer.monthly": "العرض الشهري", "prayer.daily": "اليوم", "prayer.next": "القادمة",
      "prayer.methodNote": "تختلف طرق الحساب باختلاف الجهات العلمية — اختر الطريقة المعتمدة في مسجدك أو بلدك.",
      "prayer.Fajr": "الفجر", "prayer.Sunrise": "الشروق", "prayer.Dhuhr": "الظهر",
      "prayer.Asr": "العصر", "prayer.Maghrib": "المغرب", "prayer.Isha": "العشاء",

      "qibla.title": "محدد القبلة", "qibla.sub": "اتجاه الكعبة المشرفة من موقعك.",
      "qibla.fromNorth": "من الشمال", "qibla.enableCompass": "تفعيل البوصلة",
      "qibla.calibrate": "حرّك هاتفك على شكل ٨ لمعايرة البوصلة.",
      "qibla.noCompass": "البوصلة غير متاحة على هذا الجهاز — استخدم الزاوية أدناه مع خريطة أو بوصلة.",
      "qibla.aligned": "أنت الآن باتجاه القبلة",

      "quran.title": "القرآن الكريم", "quran.sub": "الرسم العثماني · ترجمة صحيح إنترناشيونال",
      "quran.search": "ابحث عن سورة…", "quran.resume": "متابعة", "quran.verses": "آية",
      "quran.meccan": "مكية", "quran.medinan": "مدنية",
      "quran.translation": "الترجمة", "quran.transliteration": "النطق اللاتيني",
      "quran.reciter": "القارئ", "quran.playSurah": "تشغيل السورة",
      "quran.bookmark": "إشارة مرجعية", "quran.bookmarked": "محفوظة",
      "quran.prev": "السابقة", "quran.next": "التالية",
      "quran.source": "النص: تنزيل (الرسم العثماني) عبر AlQuran Cloud · الترجمة: صحيح إنترناشيونال",

      "duas.title": "مكتبة الأدعية",
      "duas.sub": "أدعية صحيحة موثقة المصادر — يُذكر المصدر مع كل دعاء.",
      "duas.favorites": "المفضلة", "duas.source": "المصدر",
      "duas.empty": "لا مفضلات بعد — اضغط النجمة على أي دعاء.",

      "dhikr.title": "عداد الذكر", "dhikr.sub": "ذكر الله — مع سلاسل يومية.",
      "dhikr.tap": "اضغط للعد", "dhikr.reset": "تصفير", "dhikr.target": "الهدف",
      "dhikr.currentStreak": "السلسلة الحالية", "dhikr.longestStreak": "أطول سلسلة",
      "dhikr.completed": "بلغت الهدف — تقبّل الله.",

      "settings.title": "الإعدادات", "settings.language": "اللغة", "settings.theme": "المظهر",
      "settings.themeLight": "فاتح", "settings.themeDark": "داكن", "settings.themeSystem": "حسب النظام",
      "settings.location": "الموقع", "settings.locationSet": "الموقع المحفوظ",
      "settings.locationNone": "لا يوجد موقع محفوظ", "settings.locationClear": "مسح الموقع",
      "settings.useDevice": "استخدام موقع الجهاز", "settings.transliteration": "إظهار النطق اللاتيني",
      "settings.data": "بياناتك", "settings.export": "تصدير بياناتي", "settings.deleteAll": "حذف كل بياناتي",
      "settings.deleteConfirm": "سيحذف هذا كل بيانات سلام ستريت على هذا الجهاز (الإشارات، السلاسل، الإعدادات). هل تريد المتابعة؟",
      "settings.privacyNote": "تبقى بياناتك على جهازك. تُرسل إحداثياتك فقط إلى خدمة مواقيت الصلاة (AlAdhan) لحساب المواقيت، ولا نخزنها على أي خادم.",

      "loc.title": "الوصول إلى الموقع",
      "loc.body": "نستخدم موقعك فقط لتوفير مواقيت صلاة دقيقة، واتجاه القبلة، والمساجد القريبة، والأعمال الحلال.",
      "loc.allowWhile": "السماح أثناء استخدام التطبيق", "loc.allowOnce": "السماح مرة واحدة",
      "loc.manual": "إدخال الموقع يدويًا", "loc.deny": "عدم السماح",
      "loc.manualTitle": "أدخل مدينتك", "loc.manualPlaceholder": "مثال: مكة، دبي، القاهرة",
      "loc.denied": "الموقع مغلق — المواقيت المعروضة تقريبية. يمكنك تحديد مدينة من الإعدادات.",
      "loc.error": "تعذر تحديد موقعك. يمكنك إدخال مدينة يدويًا.",
      "loc.searching": "جارٍ البحث عن المدينة…", "loc.notFound": "لم يتم العثور على المدينة — جرّب كتابة مختلفة.",
      "loc.approx": "تقريبي — حسب المنطقة الزمنية لجهازك. حدّد موقعك لمواقيت دقيقة.",
      "loc.fallbackNote": "لم يُحدد موقع — تُعرض مواقيت مكة المكرمة.",
    },
  };

  var current = "en";

  function t(key) {
    return (MSG[current] && MSG[current][key]) || MSG.en[key] || key;
  }

  function applyTranslations(root) {
    root = root || document;
    var els = root.querySelectorAll("[data-i18n]");
    for (var i = 0; i < els.length; i++) els[i].textContent = t(els[i].getAttribute("data-i18n"));
    var phs = root.querySelectorAll("[data-i18n-ph]");
    for (var j = 0; j < phs.length; j++) phs[j].setAttribute("placeholder", t(phs[j].getAttribute("data-i18n-ph")));
  }

  function setLocale(locale) {
    current = MSG[locale] ? locale : "en";
    document.documentElement.lang = current;
    document.documentElement.dir = current === "ar" ? "rtl" : "ltr";
    applyTranslations();
    document.dispatchEvent(new CustomEvent("ss:localechange"));
  }

  SS.i18n = {
    t: t,
    setLocale: setLocale,
    getLocale: function () { return current; },
    isAr: function () { return current === "ar"; },
    initLocale: function (locale) {
      current = MSG[locale] ? locale : "en";
      document.documentElement.lang = current;
      document.documentElement.dir = current === "ar" ? "rtl" : "ltr";
      applyTranslations();
    },
    applyTranslations: applyTranslations,
  };
})();
