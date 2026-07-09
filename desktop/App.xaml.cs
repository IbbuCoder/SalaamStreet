using System.Windows;
using SalaamStreet.Desktop.Services;

namespace SalaamStreet.Desktop;

/// <summary>
/// Application entry point. Initialises the local database and the shared
/// service container, and wires a single-instance guard so launching the app
/// again just focuses the running window.
/// </summary>
public partial class App : Application
{
    public static Database Db { get; private set; } = null!;
    public static SettingsService Settings { get; private set; } = null!;
    public static PrayerService Prayer { get; private set; } = null!;
    public static QuranService Quran { get; private set; } = null!;
    public static NotificationService Notifications { get; private set; } = null!;
    public static AccountService Account { get; private set; } = null!;

    private static System.Threading.Mutex? _mutex;

    protected override void OnStartup(StartupEventArgs e)
    {
        // Single-instance: if already running, don't start a second copy.
        _mutex = new System.Threading.Mutex(true, "SalaamStreet.Desktop.SingleInstance", out bool isNew);
        if (!isNew)
        {
            Shutdown();
            return;
        }

        base.OnStartup(e);

        Db = new Database();
        Db.Initialize();
        Settings = new SettingsService(Db);
        Prayer = new PrayerService();
        Quran = new QuranService(Db);
        Account = new AccountService(Db);
        Notifications = new NotificationService(Settings, Prayer);

        // If a session was restored, refresh premium status in the background.
        if (Account.IsSignedIn)
            _ = Account.RefreshProfileAsync();

        // Start the background reminder service only if the user enabled it.
        if (Settings.RemindersEnabled)
            Notifications.StartBackgroundService();
    }

    protected override void OnExit(ExitEventArgs e)
    {
        Notifications?.Dispose();
        base.OnExit(e);
    }
}
