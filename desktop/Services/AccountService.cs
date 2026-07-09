using System.Net.Http;
using System.Text;
using System.Text.Json;

namespace SalaamStreet.Desktop.Services;

/// <summary>
/// Supabase Auth (GoTrue) over HTTPS — the SAME account system the website
/// uses, so a login and (later) synced data work across both. No third-party
/// SDK: plain HttpClient against the documented REST endpoints.
///
/// The session (access + refresh token, email) is cached in the local SQLite
/// settings table so the user stays signed in between launches. Two-way data
/// sync (bookmarks/progress/preferences) is wired in a later session.
/// </summary>
public class AccountService
{
    private static readonly HttpClient Http = new() { Timeout = TimeSpan.FromSeconds(20) };
    private readonly Database _db;

    public string? AccessToken { get; private set; }
    public string? RefreshToken { get; private set; }
    public string? Email { get; private set; }
    public string? DisplayName { get; private set; }
    public bool IsSignedIn => !string.IsNullOrEmpty(AccessToken);

    public AccountService(Database db)
    {
        _db = db;
        // Restore a cached session if present.
        AccessToken = _db.Get("auth:access");
        RefreshToken = _db.Get("auth:refresh");
        Email = _db.Get("auth:email");
        DisplayName = _db.Get("auth:name");
    }

    public bool Configured => SupabaseConfig.IsConfigured;

    private HttpRequestMessage Build(HttpMethod method, string path, object? body)
    {
        var req = new HttpRequestMessage(method, SupabaseConfig.Url.TrimEnd('/') + path);
        req.Headers.Add("apikey", SupabaseConfig.AnonKey);
        if (!string.IsNullOrEmpty(AccessToken))
            req.Headers.Add("Authorization", "Bearer " + AccessToken);
        if (body != null)
            req.Content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json");
        return req;
    }

    /// <summary>Create an account with email + password.</summary>
    public async Task<(bool ok, string message)> SignUpAsync(string email, string password)
    {
        if (!Configured) return (false, "Accounts are not configured yet (see README-backend.md).");
        try
        {
            var res = await Http.SendAsync(Build(HttpMethod.Post, "/auth/v1/signup",
                new { email, password }));
            var json = await res.Content.ReadAsStringAsync();
            if (!res.IsSuccessStatusCode) return (false, ExtractError(json));
            // If email confirmation is on, there is no session yet.
            if (TryStoreSession(json)) return (true, "Account created and signed in.");
            return (true, "Account created. Check your email to confirm, then sign in.");
        }
        catch (Exception ex) { return (false, "Network error: " + ex.Message); }
    }

    /// <summary>Sign in with email + password.</summary>
    public async Task<(bool ok, string message)> SignInAsync(string email, string password)
    {
        if (!Configured) return (false, "Accounts are not configured yet (see README-backend.md).");
        try
        {
            var res = await Http.SendAsync(Build(HttpMethod.Post, "/auth/v1/token?grant_type=password",
                new { email, password }));
            var json = await res.Content.ReadAsStringAsync();
            if (!res.IsSuccessStatusCode) return (false, ExtractError(json));
            return TryStoreSession(json)
                ? (true, "Signed in.")
                : (false, "Unexpected sign-in response.");
        }
        catch (Exception ex) { return (false, "Network error: " + ex.Message); }
    }

    public void SignOut()
    {
        AccessToken = RefreshToken = Email = DisplayName = null;
        _db.Set("auth:access", "");
        _db.Set("auth:refresh", "");
        _db.Set("auth:email", "");
        _db.Set("auth:name", "");
        App.Settings.IsPremium = false;
        App.Settings.AccountEmail = "";
    }

    /// <summary>Read the profile row to learn premium status (RLS-protected).</summary>
    public async Task RefreshProfileAsync()
    {
        if (!IsSignedIn || !Configured) return;
        try
        {
            var res = await Http.SendAsync(Build(HttpMethod.Get,
                "/rest/v1/profiles?select=display_name,is_premium&limit=1", null));
            if (!res.IsSuccessStatusCode) return;
            using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync());
            if (doc.RootElement.ValueKind == JsonValueKind.Array && doc.RootElement.GetArrayLength() > 0)
            {
                var row = doc.RootElement[0];
                if (row.TryGetProperty("is_premium", out var p))
                    App.Settings.IsPremium = p.ValueKind == JsonValueKind.True;
                if (row.TryGetProperty("display_name", out var n) && n.ValueKind == JsonValueKind.String)
                {
                    DisplayName = n.GetString();
                    _db.Set("auth:name", DisplayName ?? "");
                }
            }
        }
        catch { /* offline — keep cached state */ }
    }

    private bool TryStoreSession(string json)
    {
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;
        if (!root.TryGetProperty("access_token", out var at)) return false;

        AccessToken = at.GetString();
        RefreshToken = root.TryGetProperty("refresh_token", out var rt) ? rt.GetString() : null;
        if (root.TryGetProperty("user", out var user) && user.TryGetProperty("email", out var em))
            Email = em.GetString();

        _db.Set("auth:access", AccessToken ?? "");
        _db.Set("auth:refresh", RefreshToken ?? "");
        _db.Set("auth:email", Email ?? "");
        App.Settings.AccountEmail = Email ?? "";
        return true;
    }

    private static string ExtractError(string json)
    {
        try
        {
            using var doc = JsonDocument.Parse(json);
            var r = doc.RootElement;
            foreach (var key in new[] { "msg", "error_description", "message", "error" })
                if (r.TryGetProperty(key, out var v) && v.ValueKind == JsonValueKind.String)
                    return v.GetString()!;
        }
        catch { }
        return "Sign-in failed. Please check your details and try again.";
    }
}
