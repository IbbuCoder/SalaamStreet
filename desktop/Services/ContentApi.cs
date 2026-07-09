using System.Net.Http;
using System.Text.Json;

namespace SalaamStreet.Desktop.Services;

/// <summary>
/// Tafsir (Ibn Kathir), Hadith (fawazahmed0 hadith-api) and Hijri date
/// (AlAdhan) — the same open, cited sources the website uses.
/// </summary>
public static class ContentApi
{
    private static readonly HttpClient Http = new() { Timeout = TimeSpan.FromSeconds(20) };
    private const string TafsirBase = "https://cdn.jsdelivr.net/gh/spa5k/tafsir_api@main/tafsir/en-tafisr-ibn-kathir";
    private const string HadithBase = "https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions";
    private const string Aladhan = "https://api.aladhan.com/v1";

    public static async Task<string> TafsirAsync(int surah, int ayah)
    {
        var url = $"{TafsirBase}/{surah}_{ayah}.json";
        using var doc = JsonDocument.Parse(await Http.GetStringAsync(url));
        return doc.RootElement.TryGetProperty("text", out var t) ? (t.GetString() ?? "") : "";
    }

    public record HadithItem(string Arabic, string English, string Reference, string Grade);

    /// <summary>All hadith in a bounded edition (e.g. the 40 Hadith collections).</summary>
    public static async Task<List<HadithItem>> HadithEditionAsync(string engEdition, string araEdition, string cite)
    {
        var en = JsonDocument.Parse(await Http.GetStringAsync($"{HadithBase}/{engEdition}.min.json"));
        var ar = JsonDocument.Parse(await Http.GetStringAsync($"{HadithBase}/{araEdition}.min.json"));
        var arMap = new Dictionary<int, string>();
        foreach (var h in ar.RootElement.GetProperty("hadiths").EnumerateArray())
            arMap[h.GetProperty("hadithnumber").GetInt32()] = h.GetProperty("text").GetString() ?? "";

        var list = new List<HadithItem>();
        foreach (var h in en.RootElement.GetProperty("hadiths").EnumerateArray())
        {
            int num = h.GetProperty("hadithnumber").GetInt32();
            list.Add(new HadithItem(
                arMap.TryGetValue(num, out var a) ? a : "",
                h.GetProperty("text").GetString() ?? "",
                $"{cite} #{num}",
                Grade(h)));
        }
        return list;
    }

    /// <summary>A single hadith by number (for large collections like Bukhari).</summary>
    public static async Task<HadithItem?> HadithOneAsync(string engEdition, string araEdition, string cite, int num)
    {
        try
        {
            var en = JsonDocument.Parse(await Http.GetStringAsync($"{HadithBase}/{engEdition}/{num}.min.json"));
            string arText = "";
            try
            {
                var ar = JsonDocument.Parse(await Http.GetStringAsync($"{HadithBase}/{araEdition}/{num}.min.json"));
                arText = ar.RootElement.GetProperty("hadiths")[0].GetProperty("text").GetString() ?? "";
            }
            catch { }
            var h = en.RootElement.GetProperty("hadiths")[0];
            return new HadithItem(arText, h.GetProperty("text").GetString() ?? "", $"{cite} #{num}", Grade(h));
        }
        catch { return null; }
    }

    private static string Grade(JsonElement h)
    {
        if (h.TryGetProperty("grades", out var g) && g.ValueKind == JsonValueKind.Array && g.GetArrayLength() > 0)
            return g[0].TryGetProperty("grade", out var gr) ? (gr.GetString() ?? "") : "";
        return "";
    }

    public record HijriToday(string Day, string MonthEn, int MonthNumber, string Year);

    public static async Task<HijriToday> HijriTodayAsync()
    {
        var dd = DateTime.Now.ToString("dd-MM-yyyy");
        using var doc = JsonDocument.Parse(await Http.GetStringAsync($"{Aladhan}/gToH/{dd}"));
        var h = doc.RootElement.GetProperty("data").GetProperty("hijri");
        var month = h.GetProperty("month");
        return new HijriToday(
            h.GetProperty("day").GetString() ?? "",
            month.GetProperty("en").GetString() ?? "",
            month.GetProperty("number").GetInt32(),
            h.GetProperty("year").GetString() ?? "");
    }
}
