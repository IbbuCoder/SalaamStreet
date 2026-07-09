using System.Windows;
using System.Windows.Controls;
using SalaamStreet.Desktop.Models;
using SalaamStreet.Desktop.Services;

namespace SalaamStreet.Desktop.Views;

public partial class SettingsView : UserControl
{
    private bool _loading = true;

    public SettingsView()
    {
        InitializeComponent();
        var s = App.Settings;

        RemindersChk.IsChecked = s.RemindersEnabled;
        PrayerChk.IsChecked = s.PrayerReminders;
        QuranChk.IsChecked = s.DailyQuranReminder;
        ArabicChk.IsChecked = s.ArabicReminder;
        TranslationChk.IsChecked = s.ShowTranslation;
        TranslitChk.IsChecked = s.ShowTransliteration;
        AutoStartChk.IsChecked = AutoStartService.IsEnabled();
        StartTrayChk.IsChecked = s.StartMinimizedToTray;
        DlStatus.Text = $"{App.Db.CachedSurahCount()} of 114 surahs downloaded.";
        _loading = false;

        RemindersChk.Click += (_, _) => { s.RemindersEnabled = RemindersChk.IsChecked == true; ToggleService(); };
        PrayerChk.Click += (_, _) => s.PrayerReminders = PrayerChk.IsChecked == true;
        QuranChk.Click += (_, _) => s.DailyQuranReminder = QuranChk.IsChecked == true;
        ArabicChk.Click += (_, _) => s.ArabicReminder = ArabicChk.IsChecked == true;
        TranslationChk.Click += (_, _) => s.ShowTranslation = TranslationChk.IsChecked == true;
        TranslitChk.Click += (_, _) => s.ShowTransliteration = TranslitChk.IsChecked == true;
        StartTrayChk.Click += (_, _) => s.StartMinimizedToTray = StartTrayChk.IsChecked == true;
        AutoStartChk.Click += (_, _) =>
        {
            try { AutoStartService.SetEnabled(AutoStartChk.IsChecked == true); }
            catch { MessageBox.Show("Could not change the auto-start setting."); }
        };
    }

    private void ToggleService()
    {
        if (_loading) return;
        if (App.Settings.RemindersEnabled) App.Notifications.StartBackgroundService();
        else App.Notifications.StopBackgroundService();
    }

    private void Test_Click(object sender, RoutedEventArgs e)
        => NotificationService.Show("SalaamStreet", "Notifications are working. 🕌");

    private async void DownloadAll_Click(object sender, RoutedEventArgs e)
    {
        DlAllBtn.IsEnabled = false;
        int ok = 0;
        for (int n = 1; n <= 114; n++)
        {
            try { await App.Quran.DownloadSurahAsync(n); ok++; }
            catch { /* skip failures, keep going */ }
            DlStatus.Text = $"Downloading… {n}/114";
        }
        DlStatus.Text = $"{App.Db.CachedSurahCount()} of 114 surahs downloaded ({ok} this run).";
        DlAllBtn.IsEnabled = true;
    }
}
