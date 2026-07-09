using System.Text.Json;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using SalaamStreet.Desktop.Models;

namespace SalaamStreet.Desktop.Views;

public partial class DhikrView : UserControl
{
    private DhikrPreset _preset = ContentData.Dhikr[0];
    private int _count;

    public DhikrView()
    {
        InitializeComponent();
        BuildPresets();
        Load();
        Render();
        RenderStreak();
        Loaded += (_, _) => { Focusable = true; Keyboard.Focus(this); };
        KeyDown += (_, e) => { if (e.Key == Key.Space) { Tap(); e.Handled = true; } };
    }

    private void BuildPresets()
    {
        Presets.Children.Clear();
        foreach (var p in ContentData.Dhikr)
        {
            var b = new Button
            {
                Content = $"{p.En} · {p.Target}",
                Margin = new Thickness(0, 0, 8, 8),
                Style = p.Id == _preset.Id ? (Style)FindResource("PrimaryButton") : (Style)FindResource("GhostButton"),
            };
            b.Click += (_, _) => { _preset = p; Load(); BuildPresets(); Render(); };
            Presets.Children.Add(b);
        }
    }

    private string TodayKey() => "dhikr:day:" + DateTime.Now.ToString("yyyy-MM-dd");

    private void Load()
    {
        var raw = App.Db.Get(TodayKey());
        _count = 0;
        if (raw != null)
        {
            try { using var doc = JsonDocument.Parse(raw); if (doc.RootElement.TryGetProperty(_preset.Id, out var v)) _count = v.GetInt32(); }
            catch { }
        }
    }

    private void Save()
    {
        var map = new Dictionary<string, int>();
        var raw = App.Db.Get(TodayKey());
        if (raw != null)
        {
            try { map = JsonSerializer.Deserialize<Dictionary<string, int>>(raw) ?? new(); } catch { }
        }
        map[_preset.Id] = _count;
        App.Db.Set(TodayKey(), JsonSerializer.Serialize(map));
    }

    private void Render()
    {
        DhikrText.Text = _preset.Arabic;
        DhikrSource.Text = _preset.Source;
        Count.Text = _count.ToString();
        Target.Text = $"Target: {_preset.Target}";
    }

    private void RenderStreak()
    {
        var raw = App.Db.Get("dhikr:streak");
        int cur = 0, max = 0;
        if (raw != null)
        {
            try { using var d = JsonDocument.Parse(raw); cur = d.RootElement.GetProperty("current").GetInt32(); max = d.RootElement.GetProperty("longest").GetInt32(); }
            catch { }
        }
        StreakCur.Text = cur.ToString();
        StreakMax.Text = max.ToString();
    }

    private void Tap_Click(object sender, RoutedEventArgs e) => Tap();

    private void Tap()
    {
        _count++;
        Save();
        Render();
        if (_count == _preset.Target) BumpStreak();
    }

    private void BumpStreak()
    {
        var raw = App.Db.Get("dhikr:streak");
        int cur = 0, max = 0; string last = "";
        if (raw != null)
        {
            try { using var d = JsonDocument.Parse(raw); cur = d.RootElement.GetProperty("current").GetInt32(); max = d.RootElement.GetProperty("longest").GetInt32(); last = d.RootElement.GetProperty("lastDate").GetString() ?? ""; }
            catch { }
        }
        var today = DateTime.Now.ToString("yyyy-MM-dd");
        if (last == today) return;
        var yesterday = DateTime.Now.AddDays(-1).ToString("yyyy-MM-dd");
        cur = last == yesterday ? cur + 1 : 1;
        max = Math.Max(max, cur);
        App.Db.Set("dhikr:streak", JsonSerializer.Serialize(new { current = cur, longest = max, lastDate = today }));
        RenderStreak();
    }

    private void Reset_Click(object sender, RoutedEventArgs e) { _count = 0; Save(); Render(); }
}
