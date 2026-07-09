using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using System.Windows.Threading;
using SalaamStreet.Desktop.Models;
using SalaamStreet.Desktop.Services;

namespace SalaamStreet.Desktop.Views;

public partial class DashboardView : UserControl
{
    private DispatcherTimer? _timer;
    private DateTime _target;

    public DashboardView()
    {
        InitializeComponent();
        Loaded += async (_, _) => await LoadAsync();
        Unloaded += (_, _) => _timer?.Stop();
    }

    private async Task LoadAsync()
    {
        var s = App.Settings;
        LocLabel.Text = "📍 " + s.LocationLabel;
        OfflineCount.Text = $"{App.Db.CachedSurahCount()} of 114 surahs downloaded";

        var last = Surahs.All[s.LastSurah - 1];
        LastRead.Text = $"{last.English} · {s.LastSurah}:{s.LastAyah}";

        try
        {
            var t = await App.Prayer.GetTimesAsync(s.Lat, s.Lng, s.Method, s.School);
            Hijri.Text = t.HijriText;

            TimesList.Items.Clear();
            var next = PrayerService.NextPrayer(t.Timings);
            foreach (var key in PrayerService.Order)
            {
                var row = new DockPanel { Margin = new Thickness(0, 3, 0, 3) };
                var name = new TextBlock { Text = key, Foreground = (Brush)FindResource("Text2"), FontWeight = key == next ? FontWeights.Bold : FontWeights.Normal };
                var time = new TextBlock { Text = t.Timings[key], Foreground = key == next ? (Brush)FindResource("Gold") : (Brush)FindResource("Text"), FontWeight = FontWeights.SemiBold };
                DockPanel.SetDock(time, Dock.Right);
                row.Children.Add(time);
                row.Children.Add(name);
                TimesList.Items.Add(row);
            }

            if (next != null)
            {
                NextName.Text = next;
                _target = PrayerService.TimeToday(t.Timings[next]);
            }
            else
            {
                NextName.Text = "Fajr (tomorrow)";
                _target = PrayerService.TimeToday(t.Timings["Fajr"]).AddDays(1);
            }
            StartCountdown();
        }
        catch
        {
            NextName.Text = "Offline";
            Countdown.Text = "—";
        }
    }

    private void StartCountdown()
    {
        _timer?.Stop();
        _timer = new DispatcherTimer { Interval = TimeSpan.FromSeconds(1) };
        _timer.Tick += (_, _) =>
        {
            var ms = _target - DateTime.Now;
            if (ms.TotalSeconds <= 0) { _ = LoadAsync(); return; }
            Countdown.Text = $"{(int)ms.TotalHours:D2}:{ms.Minutes:D2}:{ms.Seconds:D2}";
        };
        _timer.Start();
    }
}
