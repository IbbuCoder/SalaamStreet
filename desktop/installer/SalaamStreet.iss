; ─────────────────────────────────────────────────────────────────────────
;  SalaamStreet — Inno Setup installer script
;  Build the app first (see README-desktop.md), then compile this with the
;  Inno Setup Compiler (iscc.exe) to produce SalaamStreet-Setup.exe.
;
;  Windows-trust friendly:
;   - Installs per-user by default (no admin prompt) via lowest privileges.
;   - No bundled third-party software, no browser toolbars, nothing hidden.
;   - Clean uninstaller, proper metadata, versioned.
; ─────────────────────────────────────────────────────────────────────────

#define MyAppName "SalaamStreet"
#define MyAppVersion "0.1.0"
#define MyAppPublisher "SalaamStreet"
#define MyAppURL "https://salaamstreet.com"
#define MyAppExeName "SalaamStreet.exe"

; Point this at your published output folder (see README-desktop.md):
;   dotnet publish -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true
; Default publish path for that command:
#define PublishDir "..\bin\Release\net8.0-windows10.0.19041.0\win-x64\publish"

[Setup]
AppId={{A6E1F3C2-9B4D-4E7A-BC10-2F3A1D9E0C77}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppVerName={#MyAppName} {#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
; Per-user install → no UAC/admin prompt (better SmartScreen story):
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog
OutputBaseFilename=SalaamStreet-Setup
OutputDir=Output
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
SetupIconFile=..\Assets\AppIcon.ico
UninstallDisplayIcon={app}\{#MyAppExeName}
UninstallDisplayName={#MyAppName}
VersionInfoVersion={#MyAppVersion}
VersionInfoCompany={#MyAppPublisher}
VersionInfoProductName={#MyAppName}
; If/when you have a code-signing certificate, uncomment and configure:
; SignTool=signtool
; SignedUninstaller=yes

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Create a &desktop shortcut"; GroupDescription: "Additional icons:"; Flags: unchecked

[Files]
; Bring in everything from the publish folder (self-contained → no .NET needed on the target).
Source: "{#PublishDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{group}\Uninstall {#MyAppName}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "Launch {#MyAppName}"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
; Leave user data (%AppData%\SalaamStreet) in place on uninstall by default.
; To also remove it, uncomment:
; Type: filesandordirs; Name: "{userappdata}\SalaamStreet"
