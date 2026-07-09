# SalaamStreet for Windows — build, package & sign

A **real native Windows desktop app** — WPF on **.NET 8**. No Edge, no WebView,
no Electron, no PWA. You compile it on a Windows PC and get a genuine `.exe`.

## What's in this folder

```
desktop/
├── SalaamStreet.Desktop.sln        Visual Studio solution
├── SalaamStreet.Desktop.csproj     .NET 8 WPF project
├── app.manifest                    asInvoker (no admin), per-monitor DPI
├── App.xaml(.cs)                   startup, single-instance, service container
├── MainWindow.xaml(.cs)            native shell: sidebar nav, tray, shortcuts
├── Themes/Styles.xaml              emerald/gold desktop theme
├── Models/                         Surahs (114), data models
├── Services/                       SQLite cache, settings, prayer, quran,
│                                   qibla, Windows toast + tray reminders, autostart
├── Views/                          Dashboard, PrayerTimes, Qibla, Quran, Learn, Settings
├── Assets/AppIcon.ico / .png       app icon
├── installer/SalaamStreet.iss      Inno Setup installer script
└── README-desktop.md               this file
```

## Features in this build (Session 1 foundation)

- Native window with sidebar navigation, app icon, taskbar presence, single-instance.
- **Prayer times** (AlAdhan) with method/madhhab pickers and city lookup.
- **Qibla** bearing computed on-device.
- **Qur'an reader** with a large desktop reading mode, adjustable font (A- / A+),
  **full-screen study mode (F11)**, and **download-for-offline** (per surah or all
  114) cached in local SQLite.
- **Learn Arabic** flashcards with keyboard controls (Space flip, ← →).
- **Desktop notifications** (Windows toast) + **system-tray background reminder
  service** for prayer times and daily study — *only runs when you enable it*.
- **Settings**: reminders, offline download, reader options, **optional auto-start**
  (per-user, no admin), start-minimised-to-tray.
- **Keyboard shortcuts**: Ctrl+1..5 navigate, Ctrl+, settings, F11 full-screen.

Account sync (shared login with the website via Supabase) lands in a later session;
today everything works offline on the device.

## Prerequisites (Windows)

1. Install the **.NET 8 SDK**: <https://dotnet.microsoft.com/download/dotnet/8.0>
2. (Optional, to edit visually) Visual Studio 2022 with the *.NET desktop
   development* workload — or just use `dotnet` on the command line.

## Build & run

```powershell
cd desktop
dotnet restore
dotnet build -c Release
dotnet run -c Release      # launches the app
```

## Publish a distributable, self-contained EXE

This produces a single folder that runs on any Windows 10/11 x64 machine with
**no .NET install required** on the target:

```powershell
dotnet publish -c Release -r win-x64 --self-contained true `
  -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true
```

Output lands in:
`bin\Release\net8.0-windows10.0.19041.0\win-x64\publish\`

## Build the installer (Inno Setup)

1. Install **Inno Setup**: <https://jrsoftware.org/isinfo.php>
2. Open `installer\SalaamStreet.iss` in the Inno Setup Compiler and press
   **Compile** (or run `iscc installer\SalaamStreet.iss`).
3. Out comes `installer\Output\SalaamStreet-Setup.exe` — a proper wizard with a
   Start Menu shortcut, optional desktop shortcut, and a clean uninstaller.
   It installs **per-user with no admin prompt**.

Put that `SalaamStreet-Setup.exe` on your site's download page (replace the old
launcher `.exe`).

---

## Code signing & reducing SmartScreen warnings

New, unsigned apps trigger **Windows Defender SmartScreen** ("Windows protected
your PC"). This is about *reputation*, not a virus detection. Two things reduce it:
a valid **code-signing certificate** and **accrued download reputation** over time.

### 1. Get a code-signing certificate

- **Standard OV certificate** (~$100–300/yr, e.g. Sectigo, DigiCert, SSL.com):
  signs the binary. SmartScreen reputation still has to build up over downloads.
- **EV (Extended Validation) certificate** (more expensive, requires a hardware
  token/HSM): grants **immediate SmartScreen reputation** — the cleanest path if
  you're distributing widely. Since June 2023 all standard code-signing certs are
  also issued on hardware tokens.

### 2. Sign the app EXE

Use `signtool.exe` (ships with the Windows SDK). Sign the **published app exe**
*before* building the installer:

```powershell
signtool sign /fd SHA256 /tr http://timestamp.digicert.com /td SHA256 `
  /a "bin\Release\net8.0-windows10.0.19041.0\win-x64\publish\SalaamStreet.exe"
```

- `/tr` + `/td` add an RFC-3161 **timestamp**, so signatures stay valid after the
  certificate expires.
- `/a` auto-selects your installed certificate (or use `/f cert.pfx /p password`,
  or `/csp`/`/kc` for a hardware token).

### 3. Sign the installer

Build the installer, then sign it the same way:

```powershell
signtool sign /fd SHA256 /tr http://timestamp.digicert.com /td SHA256 `
  /a "installer\Output\SalaamStreet-Setup.exe"
```

You can also let Inno Setup sign automatically: configure a `[Setup] SignTool=`
entry and register the tool via `Tools > Configure Sign Tools` in the Inno Setup
IDE (uncomment the `SignTool` lines in `SalaamStreet.iss`).

### 4. Verify the signature

```powershell
signtool verify /pa /v "installer\Output\SalaamStreet-Setup.exe"
```

### 5. Reduce SmartScreen warnings — practical checklist

- **Sign both** the app exe and the installer with a trusted cert (EV = instant
  reputation; OV = reputation builds as more people download and run it).
- **Always timestamp** signatures.
- Keep a **stable publisher name and certificate** across releases so reputation
  accrues to *you*, not each new build.
- **Don't request admin** you don't need (this app is `asInvoker`, per-user
  install) — elevated unsigned apps look more suspicious.
- Distribute over **HTTPS** from a consistent domain.
- Optionally submit the app to Microsoft for analysis:
  <https://www.microsoft.com/wdsi/filesubmission>
- If users still see the prompt on day one, they click **"More info" → "Run
  anyway"** — normal for brand-new signed apps until reputation builds.

### Windows-trust practices this app already follows

- No administrator elevation (`asInvoker`), per-user install.
- No hidden processes — the only background work is an in-app timer that runs
  **only when the user enables reminders** and stops on exit.
- No bundled third-party software, toolbars, or fake installer screens.
- User data stays in `%AppData%\SalaamStreet`; uninstall is clean.
- Deterministic build, versioned metadata, ready for signing.
