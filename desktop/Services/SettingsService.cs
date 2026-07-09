namespace SalaamStreet.Desktop.Services;

/// <summary>
/// Typed access to user preferences, persisted in the local SQLite settings
/// table. Mirrors the website's settings so they can sync later.
/// </summary>
public class SettingsService
{
    private readonly Database _db;
    public SettingsService(Database db) => _db = db;

    private string Get(string k, string fallback) => _db.Get(k) ?? fallback;
    private void Set(string k, string v) => _db.Set(k, v);

    // Location (city label + coordinates). Empty = not set.
    public double Lat { get => double.TryParse(Get("lat", ""), out var v) ? v : 21.4225; set => Set("lat", value.ToString()); }
    public double Lng { get => double.TryParse(Get("lng", ""), out var v) ? v : 39.8262; set => Set("lng", value.ToString()); }
    public string LocationLabel { get => Get("locLabel", "Makkah (default)"); set => Set("locLabel", value); }
    public bool HasLocation => _db.Get("lat") != null && _db.Get("lng") != null;

    // Prayer calculation (AlAdhan method id + Asr school)
    public int Method { get => int.TryParse(Get("method", "3"), out var v) ? v : 3; set => Set("method", value.ToString()); }
    public int School { get => int.TryParse(Get("school", "0"), out var v) ? v : 0; set => Set("school", value.ToString()); }

    // Qur'an
    public string Reciter { get => Get("reciter", "ar.alafasy"); set => Set("reciter", value); }
    public bool ShowTranslation { get => Get("showTr", "true") == "true"; set => Set("showTr", value ? "true" : "false"); }
    public bool ShowTransliteration { get => Get("showTl", "false") == "true"; set => Set("showTl", value ? "true" : "false"); }
    public double ReaderFontSize { get => double.TryParse(Get("readerFont", "30"), out var v) ? v : 30; set => Set("readerFont", value.ToString()); }

    // Reminders / notifications
    public bool RemindersEnabled { get => Get("reminders", "false") == "true"; set => Set("reminders", value ? "true" : "false"); }
    public bool PrayerReminders { get => Get("prayerReminders", "true") == "true"; set => Set("prayerReminders", value ? "true" : "false"); }
    public bool DailyQuranReminder { get => Get("quranReminder", "true") == "true"; set => Set("quranReminder", value ? "true" : "false"); }
    public bool ArabicReminder { get => Get("arabicReminder", "false") == "true"; set => Set("arabicReminder", value ? "true" : "false"); }

    // System
    public bool AutoStart { get => Get("autoStart", "false") == "true"; set => Set("autoStart", value ? "true" : "false"); }
    public bool StartMinimizedToTray { get => Get("startTray", "false") == "true"; set => Set("startTray", value ? "true" : "false"); }

    // Last read position
    public int LastSurah { get => int.TryParse(Get("lastSurah", "1"), out var v) ? v : 1; set => Set("lastSurah", value.ToString()); }
    public int LastAyah { get => int.TryParse(Get("lastAyah", "1"), out var v) ? v : 1; set => Set("lastAyah", value.ToString()); }

    // Account (filled in a later session once Supabase auth is wired up)
    public bool IsPremium { get => Get("isPremium", "false") == "true"; set => Set("isPremium", value ? "true" : "false"); }
    public string AccountEmail { get => Get("email", ""); set => Set("email", value); }
}
