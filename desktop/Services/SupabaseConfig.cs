namespace SalaamStreet.Desktop.Services;

/// <summary>
/// Supabase connection settings. Paste your project's values here (from
/// Supabase → Project Settings → API). The anon key is PUBLIC and safe to ship;
/// security comes from Row-Level Security (see backend/supabase-schema.sql).
///
/// Until these are filled in, the app runs fully in offline/guest mode and the
/// sign-in window explains that accounts aren't configured yet.
/// </summary>
public static class SupabaseConfig
{
    // e.g. "https://abcdxyz.supabase.co"
    public const string Url = "";

    // e.g. "eyJhbGciOi..." (the anon public key)
    public const string AnonKey = "";

    public static bool IsConfigured =>
        !string.IsNullOrWhiteSpace(Url) && !string.IsNullOrWhiteSpace(AnonKey);
}
