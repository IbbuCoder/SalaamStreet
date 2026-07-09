using System.Windows.Threading;
using Microsoft.Toolkit.Uwp.Notifications;

namespace SalaamStreet.Desktop.Services;

/// <summary>
/// Windows toast notifications + a lightweight background reminder loop.
/// The loop only runs while the user has reminders enabled, checks once a
/// minute, and fires a toast at each prayer time (and optional daily study
/// reminders). No hidden processes: it's an in-app timer that stops when the
/// app exits or the setting is turned off.
/// </summary>
public class NotificationService : IDisposable
{
    private readonly SettingsService _settings;
    private readonly PrayerService _prayer;
    private DispatcherTimer? _timer;
    private string _lastFiredKey = "";
    private DateTime _lastDailyReminder = DateTime.MinValue;

    public NotificationService(SettingsService settings, PrayerService prayer)
    {
        _settings = settings;
        _prayer = prayer;
    }

    /// <summary>Show a toast immediately.</summary>
    public static void Show(string title, string message)
    {
        try
        {
            new ToastContentBuilder()
                .AddText(title)
                .AddText(message)
                .Show();
        }
        catch
        {
            // Toast APIs require a registered AppUserModelID; if unavailable
            // (e.g. running unpackaged without a shortcut) we simply skip.
        }
    }

    public void StartBackgroundService()
    {
        if (_timer != null) return;
        _timer = new DispatcherTimer { Interval = TimeSpan.FromMinutes(1) };
        _timer.Tick += async (_, _) => await TickAsync();
        _timer.Start();
    }

    public void StopBackgroundService()
    {
        _timer?.Stop();
        _timer = null;
    }

    private async Task TickAsync()
    {
        if (!_settings.RemindersEnabled) { StopBackgroundService(); return; }

        // Daily Qur'an / Arabic study reminder at ~09:00, once per day.
        var now = DateTime.Now;
        if ((_settings.DailyQuranReminder || _settings.ArabicReminder)
            && now.Hour == 9 && now.Minute == 0
            && _lastDailyReminder.Date != now.Date)
        {
            _lastDailyReminder = now;
            if (_settings.DailyQuranReminder)
                Show("SalaamStreet", "Time for your daily Qur'an reading.");
            if (_settings.ArabicReminder)
                Show("SalaamStreet", "Continue your Arabic learning today.");
        }

        if (!_settings.PrayerReminders) return;

        try
        {
            var t = await _prayer.GetTimesAsync(_settings.Lat, _settings.Lng, _settings.Method, _settings.School);
            foreach (var key in PrayerService.Order)
            {
                if (key == "Sunrise") continue;
                var at = PrayerService.TimeToday(t.Timings[key]);
                // Fire within the same minute, only once per prayer per day.
                var fireKey = $"{now:yyyy-MM-dd}:{key}";
                if (Math.Abs((at - now).TotalMinutes) < 0.9 && _lastFiredKey != fireKey)
                {
                    _lastFiredKey = fireKey;
                    Show("Prayer time", $"It's time for {key}.");
                }
            }
        }
        catch { /* offline — skip this tick */ }
    }

    public void Dispose() => StopBackgroundService();
}
