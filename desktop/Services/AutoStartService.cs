using Microsoft.Win32;

namespace SalaamStreet.Desktop.Services;

/// <summary>
/// Optional "start with Windows" via the per-user Run key (HKCU). This needs
/// NO administrator rights and only affects the current user — a Windows-trust
/// friendly approach. Fully removable from Settings.
/// </summary>
public static class AutoStartService
{
    private const string RunKey = @"Software\Microsoft\Windows\CurrentVersion\Run";
    private const string ValueName = "SalaamStreet";

    public static bool IsEnabled()
    {
        using var key = Registry.CurrentUser.OpenSubKey(RunKey, writable: false);
        return key?.GetValue(ValueName) is string;
    }

    public static void SetEnabled(bool enabled)
    {
        using var key = Registry.CurrentUser.OpenSubKey(RunKey, writable: true)
                        ?? Registry.CurrentUser.CreateSubKey(RunKey);
        if (key is null) return;
        if (enabled)
        {
            var exe = Environment.ProcessPath ?? "";
            if (!string.IsNullOrEmpty(exe))
                key.SetValue(ValueName, $"\"{exe}\" --tray");
        }
        else
        {
            key.DeleteValue(ValueName, throwOnMissingValue: false);
        }
    }
}
