using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using CommunityToolkit.Mvvm.Input;
using SalaamStreet.Desktop.Services;
using SalaamStreet.Desktop.Views;

namespace SalaamStreet.Desktop;

public partial class MainWindow : Window
{
    private WindowState _prevState = WindowState.Normal;
    private bool _fullScreen;

    public IRelayCommand<string> NavCommand { get; }
    public IRelayCommand FullScreenCommand { get; }

    public MainWindow()
    {
        NavCommand = new RelayCommand<string>(key => NavigateTo(key));
        FullScreenCommand = new RelayCommand(ToggleFullScreen);
        InitializeComponent();
        DataContext = this;

        try
        {
            Tray.IconSource = new System.Windows.Media.Imaging.BitmapImage(
                new Uri("pack://application:,,,/Assets/AppIcon.ico"));
        }
        catch { /* icon optional at runtime */ }

        var args = Environment.GetCommandLineArgs();
        if (Array.IndexOf(args, "--tray") >= 0 || App.Settings.StartMinimizedToTray)
            Loaded += (_, _) => MinimizeToTray();

        NavigateTo("dashboard");
        RefreshAccount();
    }

    public void RefreshAccount()
    {
        if (App.Account.IsSignedIn)
        {
            var email = App.Account.Email;
            AccountName.Text = App.Account.DisplayName ?? email;
            AccountSub.Text = App.Settings.IsPremium ? "⭐ Premium member" : "Signed in · tap to manage";
            Avatar.Text = string.IsNullOrEmpty(email) ? "•" : email[..1].ToUpperInvariant();
        }
        else
        {
            AccountName.Text = "Guest";
            AccountSub.Text = "Sign in to sync";
            Avatar.Text = "?";
        }
    }

    private void Account_Click(object sender, RoutedEventArgs e)
    {
        if (App.Account.IsSignedIn)
        {
            var r = MessageBox.Show($"Signed in as {App.Account.Email}.\n\nSign out on this device?",
                "SalaamStreet account", MessageBoxButton.YesNo, MessageBoxImage.Question);
            if (r == MessageBoxResult.Yes) { App.Account.SignOut(); RefreshAccount(); }
        }
        else
        {
            var win = new LoginWindow { Owner = this };
            win.ShowDialog();
            RefreshAccount();
        }
    }

    private void Nav_Checked(object sender, RoutedEventArgs e)
    {
        if (sender is RadioButton rb && rb.Tag is string tag) NavigateTo(tag, updateRadio: false);
    }

    private void NavigateTo(string? key, bool updateRadio = true)
    {
        UserControl view = key switch
        {
            "prayer" => new PrayerTimesView(),
            "qibla" => new QiblaView(),
            "quran" => new QuranView(),
            "hadith" => new HadithView(),
            "duas" => new DuasView(),
            "dhikr" => new DhikrView(),
            "calendar" => new CalendarView(),
            "learn" => new LearnView(),
            "premium" => new PremiumView(),
            "settings" => new SettingsView(),
            _ => new DashboardView(),
        };
        ContentHost.Content = view;

        if (updateRadio)
            foreach (var child in NavPanel.Children)
                if (child is RadioButton rb && (string?)rb.Tag == (key ?? "dashboard"))
                    rb.IsChecked = true;
    }

    private void ToggleFullScreen()
    {
        if (!_fullScreen)
        {
            _prevState = WindowState;
            WindowStyle = WindowStyle.None;
            ResizeMode = ResizeMode.NoResize;
            WindowState = WindowState.Maximized;
            _fullScreen = true;
        }
        else
        {
            WindowStyle = WindowStyle.SingleBorderWindow;
            ResizeMode = ResizeMode.CanResize;
            WindowState = _prevState;
            _fullScreen = false;
        }
    }

    // ── Tray behaviour ────────────────────────────────────────────
    public void MinimizeToTray()
    {
        Tray.Visibility = Visibility.Visible;
        Hide();
    }

    private void Tray_Open(object sender, RoutedEventArgs e)
    {
        Show();
        WindowState = WindowState.Normal;
        Activate();
        Tray.Visibility = App.Settings.RemindersEnabled ? Visibility.Visible : Visibility.Collapsed;
    }

    private async void Tray_NextPrayer(object sender, RoutedEventArgs e)
    {
        try
        {
            var s = App.Settings;
            var t = await App.Prayer.GetTimesAsync(s.Lat, s.Lng, s.Method, s.School);
            var next = PrayerService.NextPrayer(t.Timings);
            NotificationService.Show("SalaamStreet",
                next != null ? $"Next prayer: {next} at {t.Timings[next]}" : "All prayers done for today.");
        }
        catch { NotificationService.Show("SalaamStreet", "Prayer times unavailable (offline)."); }
    }

    private void Tray_Exit(object sender, RoutedEventArgs e) => Application.Current.Shutdown();

    protected override void OnStateChanged(EventArgs e)
    {
        if (WindowState == WindowState.Minimized && App.Settings.RemindersEnabled)
            MinimizeToTray();
        base.OnStateChanged(e);
    }
}
