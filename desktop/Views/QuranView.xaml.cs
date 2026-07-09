using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using SalaamStreet.Desktop.Models;
using SalaamStreet.Desktop.Services;

namespace SalaamStreet.Desktop.Views;

public partial class QuranView : UserControl
{
    private int _current = 1;

    public QuranView()
    {
        InitializeComponent();
        FillSurahList("");
        _current = App.Settings.LastSurah;
        Loaded += async (_, _) =>
        {
            SelectInList(_current);
            await LoadSurahAsync(_current);
        };
    }

    private void FillSurahList(string filter)
    {
        SurahList.Items.Clear();
        foreach (var s in Surahs.All)
        {
            if (!string.IsNullOrEmpty(filter) &&
                !s.English.Contains(filter, StringComparison.OrdinalIgnoreCase) &&
                !s.Meaning.Contains(filter, StringComparison.OrdinalIgnoreCase) &&
                s.Number.ToString() != filter) continue;

            var item = new ListBoxItem { Tag = s.Number, Padding = new Thickness(12, 8, 12, 8) };
            var dp = new DockPanel();
            var ar = new TextBlock { Text = s.Arabic, FontSize = 16, Foreground = (Brush)FindResource("Emerald") };
            DockPanel.SetDock(ar, Dock.Right);
            var col = new StackPanel();
            col.Children.Add(new TextBlock { Text = $"{s.Number}. {s.English}", Foreground = (Brush)FindResource("Text"), FontWeight = FontWeights.SemiBold });
            col.Children.Add(new TextBlock { Text = $"{s.Meaning} · {s.Ayahs} verses", Foreground = (Brush)FindResource("Text2"), FontSize = 11 });
            dp.Children.Add(ar);
            dp.Children.Add(col);
            item.Content = dp;
            SurahList.Items.Add(item);
        }
    }

    private void SelectInList(int surah)
    {
        foreach (ListBoxItem item in SurahList.Items)
            if ((int)item.Tag == surah) { item.IsSelected = true; break; }
    }

    private void Search_Changed(object sender, TextChangedEventArgs e) => FillSurahList(Search.Text.Trim());

    private async void Surah_Changed(object sender, SelectionChangedEventArgs e)
    {
        if (SurahList.SelectedItem is ListBoxItem item && item.Tag is int n)
        {
            _current = n;
            await LoadSurahAsync(n);
        }
    }

    private async Task LoadSurahAsync(int surah)
    {
        var meta = Surahs.All[surah - 1];
        SurahTitle.Text = $"{meta.English}  {meta.Arabic}";
        SurahMeta.Text = $"{meta.Meaning} · {meta.Ayahs} verses · {(meta.Meccan ? "Meccan" : "Medinan")}";
        App.Settings.LastSurah = surah;

        AyahList.Items.Clear();
        AyahList.Items.Add(new TextBlock { Text = "Loading…", Foreground = (Brush)FindResource("Text2") });
        try
        {
            var rows = await App.Quran.GetSurahAsync(surah);
            RenderAyahs(rows);
            DownloadBtn.Content = App.Db.GetSurahJson(surah) != null ? "Saved offline ✓" : "Download offline";
        }
        catch
        {
            AyahList.Items.Clear();
            AyahList.Items.Add(new TextBlock { Text = "Could not load this surah (offline and not yet downloaded).", Foreground = (Brush)FindResource("Text2") });
        }
    }

    private void RenderAyahs(List<AyahRow> rows)
    {
        AyahList.Items.Clear();
        double font = App.Settings.ReaderFontSize;
        foreach (var a in rows)
        {
            var card = new Border
            {
                Style = (Style)FindResource("Card"),
                Margin = new Thickness(0, 0, 0, 12),
            };
            var stack = new StackPanel();
            stack.Children.Add(new TextBlock
            {
                Text = $"{a.Arabic}  ﴿{a.NumberInSurah}﴾",
                FontFamily = new FontFamily("Traditional Arabic, Segoe UI"),
                FontSize = font,
                TextAlignment = TextAlignment.Right,
                FlowDirection = FlowDirection.RightToLeft,
                Foreground = (Brush)FindResource("Text"),
                TextWrapping = TextWrapping.Wrap,
                LineHeight = font * 2,
            });
            if (App.Settings.ShowTransliteration)
                stack.Children.Add(new TextBlock { Text = a.Transliteration, FontStyle = FontStyles.Italic, Foreground = (Brush)FindResource("Text2"), TextWrapping = TextWrapping.Wrap, Margin = new Thickness(0, 8, 0, 0) });
            if (App.Settings.ShowTranslation)
                stack.Children.Add(new TextBlock { Text = a.Translation, Foreground = (Brush)FindResource("Text2"), TextWrapping = TextWrapping.Wrap, Margin = new Thickness(0, 6, 0, 0) });

            // Per-ayah tools: reference + Tafsir button.
            var tools = new DockPanel { Margin = new Thickness(0, 10, 0, 0) };
            int ayahNo = a.NumberInSurah;
            var tafsirBtn = new Button { Content = "Tafsir", Padding = new Thickness(11, 5, 11, 5), FontSize = 12 };
            tafsirBtn.Click += (_, _) =>
            {
                var win = new SalaamStreet.Desktop.TafsirWindow(_current, ayahNo) { Owner = Window.GetWindow(this) };
                win.ShowDialog();
            };
            DockPanel.SetDock(tafsirBtn, Dock.Right);
            tools.Children.Add(tafsirBtn);
            tools.Children.Add(new TextBlock { Text = $"{_current}:{ayahNo}", Foreground = (Brush)FindResource("EmeraldStrong"), FontWeight = FontWeights.SemiBold, FontSize = 12, VerticalAlignment = VerticalAlignment.Center });
            stack.Children.Add(tools);

            card.Child = stack;
            AyahList.Items.Add(card);
        }
    }

    private async void Download_Click(object sender, RoutedEventArgs e)
    {
        DownloadBtn.IsEnabled = false;
        DownloadBtn.Content = "Downloading…";
        try { await App.Quran.DownloadSurahAsync(_current); DownloadBtn.Content = "Saved offline ✓"; }
        catch { DownloadBtn.Content = "Download failed"; }
        finally { DownloadBtn.IsEnabled = true; }
    }

    private void FontLarger_Click(object sender, RoutedEventArgs e) => ChangeFont(+2);
    private void FontSmaller_Click(object sender, RoutedEventArgs e) => ChangeFont(-2);
    private async void ChangeFont(double delta)
    {
        App.Settings.ReaderFontSize = Math.Clamp(App.Settings.ReaderFontSize + delta, 18, 60);
        await LoadSurahAsync(_current);
    }

    private void Study_Click(object sender, RoutedEventArgs e)
    {
        if (Window.GetWindow(this) is MainWindow mw)
            mw.FullScreenCommand.Execute(null);
    }
}
