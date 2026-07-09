using System.Net.Http;
using System.Text.Json;
using SalaamStreet.Desktop.Models;

namespace SalaamStreet.Desktop.Services;

/// <summary>
/// Qur'an text from AlQuran Cloud, cached in local SQLite so downloaded surahs
/// work fully offline. Audio streams per-ayah from the Islamic Network CDN.
/// </summary>
public class QuranService
{
    private static readonly HttpClient Http = new() { Timeout = TimeSpan.FromSeconds(20) };
    private const string Base = "https://api.alquran.cloud/v1";
    private readonly Database _db;

    public QuranService(Database db) => _db = db;

    /// <summary>Load a surah, preferring the offline cache; falls back to network.</summary>
    public async Task<List<AyahRow>> GetSurahAsync(int surah, bool forceNetwork = false)
    {
        string? json = forceNetwork ? null : _db.GetSurahJson(surah);
        if (json is null)
        {
            var url = $"{Base}/surah/{surah}/editions/quran-uthmani,en.sahih,en.transliteration";
            json = await Http.GetStringAsync(url);
            _db.SaveSurahJson(surah, json);
        }
        return Parse(json);
    }

    /// <summary>Download a surah into the offline cache (used by "download for offline").</summary>
    public async Task DownloadSurahAsync(int surah)
    {
        var url = $"{Base}/surah/{surah}/editions/quran-uthmani,en.sahih,en.transliteration";
        var json = await Http.GetStringAsync(url);
        _db.SaveSurahJson(surah, json);
    }

    private static List<AyahRow> Parse(string json)
    {
        using var doc = JsonDocument.Parse(json);
        var data = doc.RootElement.GetProperty("data");
        var ar = data[0].GetProperty("ayahs");
        var tr = data[1].GetProperty("ayahs");
        var tl = data[2].GetProperty("ayahs");
        var rows = new List<AyahRow>();
        for (int i = 0; i < ar.GetArrayLength(); i++)
        {
            rows.Add(new AyahRow
            {
                NumberInSurah = ar[i].GetProperty("numberInSurah").GetInt32(),
                Arabic = ar[i].GetProperty("text").GetString() ?? "",
                Translation = tr[i].GetProperty("text").GetString() ?? "",
                Transliteration = tl[i].GetProperty("text").GetString() ?? "",
            });
        }
        return rows;
    }

    /// <summary>Global ayah number → per-ayah audio URL for the chosen reciter.</summary>
    public static string AudioUrl(int globalAyah, string reciter, int bitrate = 128)
        => $"https://cdn.islamic.network/quran/audio/{bitrate}/{reciter}/{globalAyah}.mp3";

    private static readonly int[] Offsets = BuildOffsets();
    private static int[] BuildOffsets()
    {
        var o = new int[114];
        o[0] = 0;
        for (int i = 1; i < 114; i++) o[i] = o[i - 1] + Surahs.All[i - 1].Ayahs;
        return o;
    }
    public static int GlobalAyah(int surah, int ayah) => Offsets[surah - 1] + ayah;
}
