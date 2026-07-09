using System.Windows;
using SalaamStreet.Desktop.Services;

namespace SalaamStreet.Desktop;

public partial class TafsirWindow : Window
{
    public TafsirWindow(int surah, int ayah)
    {
        InitializeComponent();
        RefText.Text = $"{surah}:{ayah}";
        Body.Text = "Loading…";
        Loaded += async (_, _) =>
        {
            try
            {
                var text = (await ContentApi.TafsirAsync(surah, ayah)).Trim();
                Body.Text = string.IsNullOrEmpty(text) ? "No tafsir available for this ayah." : text;
            }
            catch { Body.Text = "Could not load tafsir (offline or source unavailable)."; }
        };
    }
}
