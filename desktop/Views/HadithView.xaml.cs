using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using SalaamStreet.Desktop.Models;
using SalaamStreet.Desktop.Services;

namespace SalaamStreet.Desktop.Views;

public partial class HadithView : UserControl
{
    private HadithCollection _current = ContentData.HadithCollections[0];

    public HadithView()
    {
        InitializeComponent();
        foreach (var c in ContentData.HadithCollections)
        {
            var b = new Button { Content = c.En, Margin = new Thickness(0, 0, 8, 8), Tag = c.Id };
            b.Click += async (_, _) => await Open(c);
            Cats.Children.Add(b);
        }
        Loaded += async (_, _) => await Open(ContentData.HadithCollections[0]);
    }

    private async Task Open(HadithCollection c)
    {
        _current = c;
        BrowseRow.Visibility = c.Bounded ? Visibility.Collapsed : Visibility.Visible;
        List.Children.Clear();
        List.Children.Add(new TextBlock { Text = "Loading…", Foreground = (Brush)FindResource("Text2") });
        try
        {
            if (c.Bounded)
            {
                var items = await ContentApi.HadithEditionAsync(c.Eng, c.Ara, c.Cite);
                Render(items);
            }
            else
            {
                await LoadOne(1);
            }
        }
        catch { Error(); }
    }

    private async void Go_Click(object sender, RoutedEventArgs e)
    {
        if (int.TryParse(NumBox.Text.Trim(), out var n) && n > 0) await LoadOne(n);
    }

    private async Task LoadOne(int num)
    {
        NumBox.Text = num.ToString();
        List.Children.Clear();
        List.Children.Add(new TextBlock { Text = "Loading…", Foreground = (Brush)FindResource("Text2") });
        try
        {
            var item = await ContentApi.HadithOneAsync(_current.Eng, _current.Ara, _current.Cite, num);
            Render(item == null ? new List<ContentApi.HadithItem>() : new() { item });
        }
        catch { Error(); }
    }

    private void Render(List<ContentApi.HadithItem> items)
    {
        List.Children.Clear();
        List.Children.Add(new TextBlock { Text = _current.En, Style = (Style)FindResource("H2"), Margin = new Thickness(0, 0, 0, 10) });
        if (items.Count == 0) { List.Children.Add(new TextBlock { Text = "No hadith found.", Foreground = (Brush)FindResource("Text2") }); return; }
        foreach (var h in items)
        {
            var card = new Border { Style = (Style)FindResource("Card"), Margin = new Thickness(0, 0, 0, 12) };
            var st = new StackPanel();
            if (!string.IsNullOrEmpty(h.Arabic))
                st.Children.Add(new TextBlock { Text = h.Arabic, FontSize = 20, TextAlignment = TextAlignment.Right, FlowDirection = FlowDirection.RightToLeft, Foreground = (Brush)FindResource("Text"), LineHeight = 36, TextWrapping = TextWrapping.Wrap, Margin = new Thickness(0, 0, 0, 8) });
            if (!string.IsNullOrEmpty(h.English))
                st.Children.Add(new TextBlock { Text = h.English, Foreground = (Brush)FindResource("Text2"), TextWrapping = TextWrapping.Wrap });
            var badges = new StackPanel { Orientation = Orientation.Horizontal, Margin = new Thickness(0, 10, 0, 0) };
            var refB = new Border { Style = (Style)FindResource("Badge"), Margin = new Thickness(0, 0, 6, 0) };
            refB.Child = new TextBlock { Text = "Reference: " + h.Reference, FontSize = 11.5, Foreground = (Brush)FindResource("EmeraldStrong") };
            badges.Children.Add(refB);
            if (!string.IsNullOrEmpty(h.Grade))
            {
                var gB = new Border { Style = (Style)FindResource("GoldBadge") };
                gB.Child = new TextBlock { Text = "Grading: " + h.Grade, FontSize = 11.5, Foreground = (Brush)FindResource("Gold") };
                badges.Children.Add(gB);
            }
            st.Children.Add(badges);
            card.Child = st;
            List.Children.Add(card);
        }
    }

    private void Error()
    {
        List.Children.Clear();
        List.Children.Add(new TextBlock { Text = "Could not load hadith (offline or source unavailable).", Foreground = (Brush)FindResource("Text2") });
    }
}
