/* Builds every SalaamStreet email Supabase Auth sends, from one layout:
   backend/email-templates/<name>.html (paste into Supabase → Authentication →
   Emails) and templates.json (what the "Deploy Supabase" GitHub workflow
   sends to the Management API, which also switches the security alerts on).

   Sign-in emails show the 6-digit code big (the app asks for it, and it
   works across devices) plus a button. Security alerts say what changed and
   what to do if it wasn't you. Every email: a short preview line for the
   inbox, the SalaamStreet header, dark-mode colours where the mail app
   supports them, and quick links back into the app. Inline styles and
   tables so every mail app shows it the same way, and each one small enough
   to paste from a phone.
   Run: node tools/build-email-templates.js */
"use strict";
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "..", "backend", "email-templates");
const SITE = "https://salaamstreet.com";
const LOGO = SITE + "/icons/brand/logo-mark-128.png";
const ACCOUNT = SITE + "/#/account";

/* kind: "code" = code + button · "link" = button only · "codeonly" = code only
   · "alert" = security notice (tone "ok" for good news, "warn" to check). */
const EMAILS = {
  confirmation: { group: "Authentication", label: "Confirm sign up", kind: "code", icon: "🌙",
    subject: "Welcome to SalaamStreet — your code is {{ .Token }}",
    preview: "Your code is {{ .Token }}. Welcome to SalaamStreet!",
    title: "Welcome to SalaamStreet",
    intro: "Enter this code to finish creating your free account.",
    button: "Confirm my account" },
  invite: { group: "Authentication", label: "Invite user", kind: "link", icon: "🤝",
    subject: "You're invited to SalaamStreet",
    preview: "Prayer times, Qur'an, Qibla and more — free, with no ads.",
    title: "You're invited",
    intro: "You've been invited to SalaamStreet: prayer times, the Qur'an with audio, the Qibla, duas and more — free, with no ads.",
    button: "Accept the invitation" },
  magic_link: { group: "Authentication", label: "Magic link or OTP", kind: "code", icon: "🔑",
    subject: "Your SalaamStreet sign-in code: {{ .Token }}",
    preview: "Your sign-in code is {{ .Token }}.",
    title: "Your sign-in code",
    intro: "Enter this code in SalaamStreet to sign in.",
    button: "Sign in" },
  email_change: { group: "Authentication", label: "Change email address", kind: "code", icon: "✉️",
    subject: "Confirm your new email for SalaamStreet",
    preview: "Your code is {{ .Token }}.",
    title: "Confirm your new email",
    intro: "Enter this code to use <b>{{ .NewEmail }}</b> for your SalaamStreet account.",
    button: "Confirm new email" },
  recovery: { group: "Authentication", label: "Reset password", kind: "code", icon: "🔒",
    subject: "Reset your SalaamStreet password",
    preview: "Your code is {{ .Token }}.",
    title: "Reset your password",
    intro: "Enter this code in SalaamStreet to choose a new password.",
    button: "Reset password" },
  reauthentication: { group: "Authentication", label: "Reauthentication", kind: "codeonly", icon: "🛡️",
    subject: "Your SalaamStreet confirmation code: {{ .Token }}",
    preview: "Your code is {{ .Token }}.",
    title: "Confirm it's you",
    intro: "Enter this code in SalaamStreet to finish what you started." },
  password_changed_notification: { group: "Security", label: "Password changed", kind: "alert", tone: "warn", icon: "🔒",
    subject: "Your SalaamStreet password was changed",
    preview: "If this wasn't you, reset your password now.",
    title: "Your password was changed",
    intro: "The password for <b>{{ .Email }}</b> was just changed." },
  email_changed_notification: { group: "Security", label: "Email address changed", kind: "alert", tone: "warn", icon: "✉️",
    subject: "Your SalaamStreet email was changed",
    preview: "Your account now uses {{ .Email }}.",
    title: "Your email was changed",
    intro: "Your account's email changed from <b>{{ .OldEmail }}</b> to <b>{{ .Email }}</b>." },
  phone_changed_notification: { group: "Security", label: "Phone number changed", kind: "alert", tone: "warn", icon: "📱",
    subject: "Your SalaamStreet phone number was changed",
    preview: "Your account now uses {{ .Phone }}.",
    title: "Your phone number was changed",
    intro: "Your account's phone number changed from <b>{{ .OldPhone }}</b> to <b>{{ .Phone }}</b>." },
  identity_linked_notification: { group: "Security", label: "Sign-in method linked", kind: "alert", tone: "ok", icon: "🔗",
    subject: "New sign-in method added to SalaamStreet",
    preview: "You can now sign in with {{ .Provider }}.",
    title: "New sign-in method added",
    intro: "You can now sign in to SalaamStreet with <b>{{ .Provider }}</b>." },
  identity_unlinked_notification: { group: "Security", label: "Sign-in method removed", kind: "alert", tone: "warn", icon: "🔗",
    subject: "A sign-in method was removed from SalaamStreet",
    preview: "{{ .Provider }} can no longer be used to sign in.",
    title: "Sign-in method removed",
    intro: "<b>{{ .Provider }}</b> can no longer be used to sign in to your account." },
  mfa_factor_enrolled_notification: { group: "Security", label: "MFA method added", kind: "alert", tone: "ok", icon: "🛡️",
    subject: "Extra security added to your SalaamStreet account",
    preview: "A {{ .FactorType }} check was added to your account.",
    title: "Extra security added",
    intro: "A <b>{{ .FactorType }}</b> check was added to your account. Signing in now needs it too." },
  mfa_factor_unenrolled_notification: { group: "Security", label: "MFA method removed", kind: "alert", tone: "warn", icon: "🛡️",
    subject: "Extra security removed from your SalaamStreet account",
    preview: "A {{ .FactorType }} check was removed.",
    title: "Extra security removed",
    intro: "A <b>{{ .FactorType }}</b> check was removed from your account." },
};

const F = "font-family:Figtree,-apple-system,'Segoe UI',Roboto,Arial,sans-serif";
const CODE = '<div class="code" style="display:inline-block;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:14px;padding:14px 22px;font-size:32px;font-weight:800;letter-spacing:8px;color:#047857;font-family:Menlo,Consolas,monospace">{{ .Token }}</div>';
const btn = (href, text, bg) => `<a href="${href}" style="display:inline-block;background:${bg || "#047857"};color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:13px 28px;border-radius:12px">${text}</a>`;
const small = (t) => `<p class="m" style="margin:10px 0 0;font-size:13px;line-height:1.5;color:#64746b">${t}</p>`;

function body(e) {
  if (e.kind === "code") return `<tr><td align="center" style="padding:22px 28px 4px">${CODE}${small("Works once and expires soon.")}</td></tr>
<tr><td align="center" style="padding:16px 28px 0">${btn("{{ .ConfirmationURL }}", e.button)}${small("Or tap the button on the device you're using.")}</td></tr>`;
  if (e.kind === "codeonly") return `<tr><td align="center" style="padding:22px 28px 4px">${CODE}${small("Works once and expires soon.")}</td></tr>`;
  if (e.kind === "link") return `<tr><td align="center" style="padding:22px 28px 0">${btn("{{ .ConfirmationURL }}", e.button)}</td></tr>`;
  const ok = e.tone === "ok";
  return `<tr><td style="padding:20px 28px 0"><div style="background:${ok ? "#ecfdf5" : "#fff7ed"};border:1px solid ${ok ? "#a7f3d0" : "#fed7aa"};border-radius:14px;padding:14px 16px;font-size:14px;line-height:1.55;color:#0b1210">
<b>${ok ? "✅ Was this you? Great — nothing to do." : "⚠️ Wasn't you?"}</b><br>${ok ? "If you didn't do this, check your account now." : "Sign in and secure your account now: change your password and remove any sign-in methods you don't recognise."}</div></td></tr>
<tr><td align="center" style="padding:18px 28px 0">${btn(ACCOUNT, "Check my account", ok ? "#047857" : "#b45309")}</td></tr>`;
}

function render(e) {
  const alert = e.kind === "alert";
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><title>${e.title}</title>
<style>@media (prefers-color-scheme:dark){.bg{background:#0a100d!important}.c{background:#121a16!important;border-color:#24332b!important}.t{color:#e6efe9!important}.m{color:#9fb0a6!important}.code{background:#0f2a20!important;border-color:#1f5a43!important;color:#6ee7b7!important}.lk{color:#6ee7b7!important}}</style></head>
<body class="bg" style="margin:0;padding:0;background:#f6faf7">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${e.preview}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="bg" style="background:#f6faf7"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="c" style="max-width:480px;background:#fff;border:1px solid #dbe6df;border-radius:20px;overflow:hidden;${F}">
<tr><td align="center" bgcolor="#065f46" style="background:#065f46;background-image:linear-gradient(135deg,#064e3b,#047857);padding:24px 20px 20px">
<img src="${LOGO}" width="52" height="52" alt="" style="display:block;border-radius:14px;border:2px solid rgba(255,255,255,.25)">
<div style="margin-top:8px;font-size:19px;font-weight:800;color:#fff">SalaamStreet</div>
<div style="margin-top:2px;font-size:13px;color:#e8d48b"><span dir="rtl" lang="ar">السلام عليكم</span> · Peace be with you</div></td></tr>
<tr><td style="height:4px;background:#c9a227;line-height:4px;font-size:0">&nbsp;</td></tr>
<tr><td class="t" style="padding:26px 28px 0;text-align:center;color:#0b1210">
<div style="font-size:30px;line-height:1">${e.icon}</div>
<h1 style="margin:10px 0 6px;font-size:22px;line-height:1.3">${e.title}</h1>
<p class="m" style="margin:0;font-size:15px;line-height:1.55;color:#425249">${e.intro}</p></td></tr>
${body(e)}
<tr><td style="padding:24px 28px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
${[["🕌", "Prayer times", "/#/prayer"], ["📖", "Qur'an", "/#/quran"], ["🧭", "Qibla", "/#/qibla"]].map(([i, t, h]) => `<td align="center" width="33%" style="font-size:13px"><a class="lk" href="${SITE}${h}" style="color:#047857;text-decoration:none;font-weight:700">${i} ${t}</a></td>`).join("")}
</tr></table></td></tr>
<tr><td class="m" style="padding:18px 28px 24px;text-align:center;font-size:12px;line-height:1.55;color:#64746b">
${alert ? "This is an automatic security notice." : "Didn't ask for this? Ignore this email — nothing changes without it.<br>Never share your code. SalaamStreet will never ask you for it."}<br>
<a class="lk" href="${SITE}" style="color:#047857;text-decoration:none">salaamstreet.com</a> · free · no ads</td></tr>
</table></td></tr></table>
</body></html>
`;
}

/** What the Management API takes (config/auth). Security alerts are switched on too. */
function apiPayload() {
  const api = {};
  for (const [name, e] of Object.entries(EMAILS)) {
    api["mailer_subjects_" + name] = e.subject;
    api["mailer_templates_" + name + "_content"] = render(e);
    if (e.kind === "alert") api["mailer_notifications_" + name.replace(/_notification$/, "") + "_enabled"] = true;
  }
  return api;
}

function build() {
  fs.mkdirSync(OUT, { recursive: true });
  for (const f of fs.readdirSync(OUT)) if (f.endsWith(".html")) fs.unlinkSync(path.join(OUT, f));
  for (const [name, e] of Object.entries(EMAILS)) fs.writeFileSync(path.join(OUT, name + ".html"), render(e));
  fs.writeFileSync(path.join(OUT, "templates.json"), JSON.stringify(apiPayload(), null, 1) + "\n");
  console.log("Wrote", Object.keys(EMAILS).length, "templates to", path.relative(process.cwd(), OUT));
}
if (require.main === module) build();

module.exports = { EMAILS, render, apiPayload };
