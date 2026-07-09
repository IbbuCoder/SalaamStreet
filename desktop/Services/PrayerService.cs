using System.Net.Http;
using System.Text.Json;
using SalaamStreet.Desktop.Models;

namespace SalaamStreet.Desktop.Services;

/// <summary>
/// Prayer times + Hijri date from the free AlAdhan API, and city geocoding.
/// Coordinates are rounded to 2 decimals (~1 km) before being sent.
/// </summary>
public class PrayerService
{
    private static readonly HttpClient Http = new() { Timeout = TimeSpan.FromSeconds(15) };
    private const string Base = "https://api.aladhan.com/v1";
    public static readonly string[] Order = { "Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha" };

    public async Task<DayTimes> GetTimesAsync(double lat, double lng, int method, int school, DateTime? date = null)
    {
        var d = date ?? DateTime.Now;
        var dd = d.ToString("dd-MM-yyyy");
        var url = $"{Base}/timings/{dd}?latitude={lat:F2}&longitude={lng:F2}&method={method}&school={school}";
        using var doc = JsonDocument.Parse(await Http.GetStringAsync(url));
        var data = doc.RootElement.GetProperty("data");
        var timings = new Dictionary<string, string>();
        foreach (var key in Order)
            timings[key] = data.GetProperty("timings").GetProperty(key).GetString()!.Split(' ')[0];
        var hijri = data.GetProperty("date").GetProperty("hijri");
        var hijriText = $"{hijri.GetProperty("day").GetString()} " +
                        $"{hijri.GetProperty("month").GetProperty("en").GetString()} " +
                        $"{hijri.GetProperty("year").GetString()} AH";
        return new DayTimes { Timings = timings, HijriText = hijriText };
    }

    public async Task<GeoLocation?> GeocodeCityAsync(string city)
    {
        var url = $"{Base}/timingsByAddress?address={Uri.EscapeDataString(city)}";
        using var doc = JsonDocument.Parse(await Http.GetStringAsync(url));
        var meta = doc.RootElement.GetProperty("data").GetProperty("meta");
        if (!meta.TryGetProperty("latitude", out var la)) return null;
        return new GeoLocation(
            Math.Round(la.GetDouble(), 2),
            Math.Round(meta.GetProperty("longitude").GetDouble(), 2),
            city);
    }

    /// <summary>Name of the next upcoming prayer today, or null if all passed.</summary>
    public static string? NextPrayer(Dictionary<string, string> timings)
    {
        var now = DateTime.Now;
        foreach (var key in Order)
        {
            if (key == "Sunrise") continue;
            if (TimeToday(timings[key]) > now) return key;
        }
        return null;
    }

    public static DateTime TimeToday(string hhmm)
    {
        var parts = hhmm.Split(':');
        var d = DateTime.Today;
        return d.AddHours(int.Parse(parts[0])).AddMinutes(int.Parse(parts[1]));
    }
}
