using System.IO;
using Microsoft.Data.Sqlite;

namespace SalaamStreet.Desktop.Services;

/// <summary>
/// Local SQLite cache + settings + user data store. Lives in the user's
/// AppData folder (per-user, no admin rights needed). This is the offline
/// store; in a later session it two-way syncs with the Supabase account.
/// </summary>
public class Database
{
    public string Path { get; }

    public Database()
    {
        var dir = System.IO.Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
            "SalaamStreet");
        Directory.CreateDirectory(dir);
        Path = System.IO.Path.Combine(dir, "salaamstreet.db");
    }

    public SqliteConnection Open()
    {
        var conn = new SqliteConnection($"Data Source={Path}");
        conn.Open();
        return conn;
    }

    public void Initialize()
    {
        using var conn = Open();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            CREATE TABLE IF NOT EXISTS settings (
                key   TEXT PRIMARY KEY,
                value TEXT
            );
            CREATE TABLE IF NOT EXISTS quran_cache (
                surah INTEGER PRIMARY KEY,
                json  TEXT NOT NULL,
                saved_at INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS bookmarks (
                surah INTEGER NOT NULL,
                ayah  INTEGER NOT NULL,
                note  TEXT,
                created_at INTEGER NOT NULL,
                PRIMARY KEY (surah, ayah)
            );
            CREATE TABLE IF NOT EXISTS progress (
                kind  TEXT NOT NULL,   -- 'quran' | 'arabic'
                key   TEXT NOT NULL,   -- e.g. surah number, lesson id
                value TEXT NOT NULL,   -- json blob
                updated_at INTEGER NOT NULL,
                PRIMARY KEY (kind, key)
            );
            CREATE TABLE IF NOT EXISTS favorites (
                kind TEXT NOT NULL,     -- 'mosque' | 'halal'
                id   TEXT NOT NULL,
                name TEXT,
                data TEXT,
                PRIMARY KEY (kind, id)
            );
            """;
        cmd.ExecuteNonQuery();
    }

    // ── settings helpers ─────────────────────────────────────────
    public string? Get(string key)
    {
        using var conn = Open();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT value FROM settings WHERE key=$k";
        cmd.Parameters.AddWithValue("$k", key);
        return cmd.ExecuteScalar() as string;
    }

    public void Set(string key, string value)
    {
        using var conn = Open();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = "INSERT INTO settings(key,value) VALUES($k,$v) " +
                          "ON CONFLICT(key) DO UPDATE SET value=$v";
        cmd.Parameters.AddWithValue("$k", key);
        cmd.Parameters.AddWithValue("$v", value);
        cmd.ExecuteNonQuery();
    }

    // ── quran offline cache ──────────────────────────────────────
    public string? GetSurahJson(int surah)
    {
        using var conn = Open();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT json FROM quran_cache WHERE surah=$s";
        cmd.Parameters.AddWithValue("$s", surah);
        return cmd.ExecuteScalar() as string;
    }

    public void SaveSurahJson(int surah, string json)
    {
        using var conn = Open();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = "INSERT INTO quran_cache(surah,json,saved_at) VALUES($s,$j,$t) " +
                          "ON CONFLICT(surah) DO UPDATE SET json=$j, saved_at=$t";
        cmd.Parameters.AddWithValue("$s", surah);
        cmd.Parameters.AddWithValue("$j", json);
        cmd.Parameters.AddWithValue("$t", DateTimeOffset.UtcNow.ToUnixTimeSeconds());
        cmd.ExecuteNonQuery();
    }

    public int CachedSurahCount()
    {
        using var conn = Open();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT COUNT(*) FROM quran_cache";
        return Convert.ToInt32(cmd.ExecuteScalar());
    }
}
