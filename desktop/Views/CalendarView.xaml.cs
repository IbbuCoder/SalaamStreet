using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using SalaamStreet.Desktop.Models;
using SalaamStreet.Desktop.Services;

namespace SalaamStreet.Desktop.Views;

public partial class CalendarView : UserControl
{
    public CalendarView()
    {
        InitializeComponent();
        GregText.Text = DateTime.Now.ToString("dddd, d MMMM yyyy");
        Loaded += async (_, _) => await LoadAsync();
    }

    private async Task LoadAsync()
    {
        int curMonth = 0;
        try
        {
            var h = await ContentApi.HijriTodayAsync();
            HijriText.Text = $"{h.Day} {h.MonthEn} {h.Year} AH";
            curMonth = h.MonthNumber;
        }
        catch { HijriText.Text = "Hijri date unavailable (offline)"; }

        Events.Children.Clear();
        foreach (var e in ContentData.Events)
        {
            var upcoming = curMonth != 0 && e.Month >= curMonth;
            var row = new Border
            {
                Padding = new Thickness(14, 12, 14, 12),
                Margin = new Thickness(0, 0, 0, 8),
                CornerRadius = new CornerRadius(12),
                Background = upcoming ? (Brush)FindResource("EmeraldSoft") : (Brush)FindResource("Surface2"),
            };
            var dp = new DockPanel();
            var date = new TextBlock { Text = $"{e.Day} {ContentData.HijriMonths[e.Month - 1]}", FontWeight = FontWeights.SemiBold, Foreground = (Brush)FindResource("Text") };
            DockPanel.SetDock(date, Dock.Right);
            var col = new StackPanel();
            col.Children.Add(new TextBlock { Text = e.En, Foreground = (Brush)FindResource("Text"), FontWeight = FontWeights.SemiBold });
            if (!string.IsNullOrEmpty(e.Note))
                col.Children.Add(new TextBlock { Text = e.Note, Foreground = (Brush)FindResource("Text3"), FontSize = 11.5, TextWrapping = TextWrapping.Wrap });
            dp.Children.Add(date);
            dp.Children.Add(col);
            row.Child = dp;
            Events.Children.Add(row);
        }
    }
}
