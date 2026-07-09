using System.Diagnostics;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using SalaamStreet.Desktop.Models;

namespace SalaamStreet.Desktop.Views;

public partial class PremiumView : UserControl
{
    public PremiumView()
    {
        InitializeComponent();
        ActiveCard.Visibility = App.Settings.IsPremium ? Visibility.Visible : Visibility.Collapsed;

        foreach (var f in ContentData.PremiumFeatures)
        {
            var row = new DockPanel { Margin = new Thickness(0, 4, 0, 4) };
            var badge = new Border { Style = (Style)FindResource(f.Live ? "Badge" : "GoldBadge") };
            badge.Child = new TextBlock { Text = f.Live ? "Available now" : "Coming soon", FontSize = 10.5, Foreground = (Brush)FindResource(f.Live ? "EmeraldStrong" : "Gold") };
            DockPanel.SetDock(badge, Dock.Right);
            row.Children.Add(badge);
            row.Children.Add(new TextBlock { Text = $"{f.Icon}  {f.En}", Foreground = (Brush)FindResource("Text"), VerticalAlignment = VerticalAlignment.Center });
            Features.Children.Add(row);
        }

        foreach (var p in ContentData.Plans)
        {
            var card = new Border { Style = (Style)FindResource("Card"), Width = 180, Margin = new Thickness(0, 0, 12, 0) };
            var st = new StackPanel { HorizontalAlignment = HorizontalAlignment.Center };
            st.Children.Add(new TextBlock { Text = p.En, Style = (Style)FindResource("H2"), HorizontalAlignment = HorizontalAlignment.Center });
            st.Children.Add(new TextBlock { Text = $"${p.Price:0.00}", FontSize = 30, FontWeight = FontWeights.Bold, Foreground = (Brush)FindResource("Text"), HorizontalAlignment = HorizontalAlignment.Center });
            st.Children.Add(new TextBlock { Text = p.Per, Style = (Style)FindResource("Tiny"), HorizontalAlignment = HorizontalAlignment.Center });
            var pay = new Button { Content = "Pay with PayPal", Style = (Style)FindResource("GoldButton"), Margin = new Thickness(0, 10, 0, 0) };
            pay.Click += (_, _) => Pay(p);
            st.Children.Add(pay);
            var act = new Button { Content = "I've paid — activate", Style = (Style)FindResource("GhostButton"), Margin = new Thickness(0, 8, 0, 0) };
            act.Click += (_, _) => Activate(p);
            st.Children.Add(act);
            card.Child = st;
            Plans.Children.Add(card);
        }
    }

    private static void Pay(Plan p)
    {
        var url = $"{ContentData.PayPalMe}/{p.Price:0.00}USD";
        try { Process.Start(new ProcessStartInfo(url) { UseShellExecute = true }); }
        catch { MessageBox.Show("Could not open PayPal. Visit " + url); }
    }

    private void Activate(Plan p)
    {
        var r = MessageBox.Show(
            "Only confirm after you've completed the PayPal payment.\n\nActivate Premium on this device now?",
            "Activate Premium", MessageBoxButton.YesNo, MessageBoxImage.Question);
        if (r != MessageBoxResult.Yes) return;
        App.Settings.IsPremium = true;
        ActiveCard.Visibility = Visibility.Visible;
        if (Window.GetWindow(this) is MainWindow mw) mw.RefreshAccount();
        MessageBox.Show("Premium activated on this device. Once server verification ships, it will sync to your account automatically.");
    }
}
