using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using SalaamStreet.Desktop.Services;

namespace SalaamStreet.Desktop.Views;

public partial class PrayerTimesView : UserControl
{
    private record Method(int Id, string Name);
    private static readonly Method[] Methods =
    {
        new(3, "Muslim World League"), new(2, "ISNA (North America)"),
        new(5, "Egyptian General Authority"), new(4, "Umm al-Qura (Makkah)"),
        new(1, "University of Karachi"), new(12, "UOIF (France)"), new(13, "Diyanet (Türkiye)"),
    };
    private static readonly Method[] Schools = { new(0, "Standard (majority)"), new(1, "Hanafi") };

    public PrayerTimesView()
    {
        InitializeComponent();

        MethodBox.ItemsSource = Methods;
        MethodBox.DisplayMemberPath = "Name";
        MethodBox.SelectedItem = Array.Find(Methods, m => m.Id == App.Settings.Method) ?? Methods[0];
        MethodBox.SelectionChanged += (_, _) => { if (MethodBox.SelectedItem is Method m) { App.Settings.Method = m.Id; _ = LoadAsync(); } };

        SchoolBox.ItemsSource = Schools;
        SchoolBox.DisplayMemberPath = "Name";
        SchoolBox.SelectedItem = Array.Find(Schools, m => m.Id == App.Settings.School) ?? Schools[0];
        SchoolBox.SelectionChanged += (_, _) => { if (SchoolBox.SelectedItem is Method m) { App.Settings.School = m.Id; _ = LoadAsync(); } };

        Loaded += async (_, _) => await LoadAsync();
    }

    private async void SetCity_Click(object sender, RoutedEventArgs e)
    {
        var city = CityBox.Text.Trim();
        if (string.IsNullOrEmpty(city)) return;
        try
        {
            var loc = await App.Prayer.GeocodeCityAsync(city);
            if (loc == null) { MessageBox.Show("City not found — try a different spelling."); return; }
            App.Settings.Lat = loc.Lat; App.Settings.Lng = loc.Lng; App.Settings.LocationLabel = loc.Label;
            await LoadAsync();
        }
        catch { MessageBox.Show("Could not look up that city (offline?)."); }
    }

    private async Task LoadAsync()
    {
        var s = App.Settings;
        LocLabel.Text = "📍 " + s.LocationLabel;
        try
        {
            var t = await App.Prayer.GetTimesAsync(s.Lat, s.Lng, s.Method, s.School);
            Hijri.Text = t.HijriText;
            var next = PrayerService.NextPrayer(t.Timings);
            TimesList.Items.Clear();
            foreach (var key in PrayerService.Order)
            {
                var border = new Border
                {
                    Padding = new Thickness(14, 12, 14, 12),
                    Margin = new Thickness(0, 3, 0, 3),
                    CornerRadius = new CornerRadius(10),
                    Background = key == next ? (Brush)FindResource("EmeraldDark") : (Brush)FindResource("Surface2"),
                };
                var dp = new DockPanel();
                var time = new TextBlock { Text = t.Timings[key], FontWeight = FontWeights.Bold, Foreground = (Brush)FindResource("Text") };
                DockPanel.SetDock(time, Dock.Right);
                var name = new TextBlock { Text = key, Foreground = (Brush)FindResource("Text"), FontWeight = FontWeights.SemiBold };
                dp.Children.Add(time);
                dp.Children.Add(name);
                border.Child = dp;
                TimesList.Items.Add(border);
            }
        }
        catch
        {
            TimesList.Items.Clear();
            TimesList.Items.Add(new TextBlock { Text = "Prayer times unavailable (offline).", Foreground = (Brush)FindResource("Text2") });
        }
    }
}
