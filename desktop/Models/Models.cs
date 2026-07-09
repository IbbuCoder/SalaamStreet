namespace SalaamStreet.Desktop.Models;

/// <summary>Prayer timings for a single day plus the Hijri date.</summary>
public class DayTimes
{
    public Dictionary<string, string> Timings { get; set; } = new();
    public string HijriText { get; set; } = "";
    public bool FromCache { get; set; }
}

/// <summary>Surah metadata (self-hosted list of the 114 chapters).</summary>
public record SurahInfo(int Number, string Arabic, string English, string Meaning, int Ayahs, bool Meccan);

/// <summary>A single ayah with Arabic, translation and transliteration.</summary>
public class AyahRow
{
    public int NumberInSurah { get; set; }
    public string Arabic { get; set; } = "";
    public string Translation { get; set; } = "";
    public string Transliteration { get; set; } = "";
}

/// <summary>A geographic location used for prayer times and Qibla.</summary>
public record GeoLocation(double Lat, double Lng, string Label);

/// <summary>A flashcard for the Arabic learning module.</summary>
public record Flashcard(string Front, string Back, string Note);
