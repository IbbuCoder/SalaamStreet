using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using SalaamStreet.Desktop.Models;

namespace SalaamStreet.Desktop.Views;

public partial class DuasView : UserControl
{
    public DuasView()
    {
        InitializeComponent();
        foreach (var c in ContentData.DuaCategories)
        {
            var btn = new Button
            {
                Content = $"{c.Icon}  {c.En}",
                Margin = new Thickness(0, 0, 8, 8),
                Tag = c.Id,
            };
            btn.Click += (_, _) => Show(c.Id, c.En);
            Cats.Children.Add(btn);
        }
        Show(ContentData.DuaCategories[0].Id, ContentData.DuaCategories[0].En);
    }

    private void Show(string catId, string title)
    {
        List.Children.Clear();
        List.Children.Add(new TextBlock { Text = title, Style = (Style)FindResource("H2"), Margin = new Thickness(0, 0, 0, 10) });
        foreach (var d in ContentData.Duas)
        {
            if (d.Category != catId) continue;
            var card = new Border { Style = (Style)FindResource("Card"), Margin = new Thickness(0, 0, 0, 12) };
            var st = new StackPanel();
            st.Children.Add(new TextBlock { Text = d.TitleEn, Style = (Style)FindResource("H2") });
            st.Children.Add(new TextBlock
            {
                Text = d.Arabic, FontSize = 22, TextAlignment = TextAlignment.Right,
                FlowDirection = FlowDirection.RightToLeft, Foreground = (Brush)FindResource("Text"),
                Margin = new Thickness(0, 10, 0, 8), LineHeight = 40, TextWrapping = TextWrapping.Wrap,
            });
            st.Children.Add(new TextBlock { Text = d.Transliteration, FontStyle = FontStyles.Italic, Foreground = (Brush)FindResource("Text3"), TextWrapping = TextWrapping.Wrap });
            st.Children.Add(new TextBlock { Text = d.TranslationEn, Foreground = (Brush)FindResource("Text2"), TextWrapping = TextWrapping.Wrap, Margin = new Thickness(0, 6, 0, 0) });
            var badge = new Border { Style = (Style)FindResource("Badge"), HorizontalAlignment = HorizontalAlignment.Left, Margin = new Thickness(0, 10, 0, 0) };
            badge.Child = new TextBlock { Text = "Source: " + d.Source, FontSize = 11.5, Foreground = (Brush)FindResource("EmeraldStrong") };
            st.Children.Add(badge);
            card.Child = st;
            List.Children.Add(card);
        }
    }
}
