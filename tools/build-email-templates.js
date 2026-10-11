/* Builds SalaamStreet's sign-in emails for Supabase Auth from one layout:
   backend/email-templates/<name>.html (paste into Supabase → Authentication →
   Emails → Templates) and templates.json (what the "Deploy Supabase" GitHub
   workflow sends to the Management API). Each email shows the 6-digit code
   big (the app asks for it, and it works across devices) plus a button.
   Kept small and inline-styled so every mail app shows it the same way, and
   short enough to paste from a phone.
   Run: node tools/build-email-templates.js */
"use strict";
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "..", "backend", "email-templates");
const LOGO = "https://salaamstreet.com/icons/brand/logo-mark-128.png";
const GREEN = "#047857", INK = "#0b1210", MUTED = "#64746b", SOFT = "#ecfdf5", BORDER = "#dbe6df";

/** Supabase variables: {{ .Token }} {{ .ConfirmationURL }} {{ .Email }} {{ .NewEmail }} */
const EMAILS = {
  magic_link: {
    subject: "Your SalaamStreet sign-in code: {{ .Token }}",
    title: "Your sign-in code",
    intro: "Enter this code in SalaamStreet to sign in.",
    button: "Sign in",
    after: "Or tap the button on the device you're signing in on.",
  },
  confirmation: {
    subject: "Welcome to SalaamStreet — your code: {{ .Token }}",
    title: "Assalamu alaikum, welcome!",
    intro: "Enter this code in SalaamStreet to finish creating your free account.",
    button: "Confirm my account",
    after: "Or tap the button on the device you're signing up on.",
  },
  email_change: {
    subject: "Confirm your new email for SalaamStreet",
    title: "Confirm your new email",
    intro: "Enter this code in SalaamStreet to use <b>{{ .NewEmail }}</b> for your account.",
    button: "Confirm new email",
    after: "Or tap the button on the device you're using SalaamStreet on.",
  },
  recovery: {
    subject: "Reset your SalaamStreet password",
    title: "Reset your password",
    intro: "Enter this code in SalaamStreet to choose a new password.",
    button: "Reset password",
    after: "Or tap the button on the device you're using SalaamStreet on.",
  },
};

function render(e) {
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${e.title}</title></head>
<body style="margin:0;padding:0;background:#f6faf7">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6faf7"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border:1px solid ${BORDER};border-radius:18px;font-family:Figtree,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:${INK}">
<tr><td align="center" style="padding:28px 24px 8px"><img src="${LOGO}" width="56" height="56" alt="" style="display:block;border-radius:14px">
<div style="margin-top:10px;font-size:18px;font-weight:800;color:${GREEN}">SalaamStreet</div></td></tr>
<tr><td style="padding:8px 28px 0;text-align:center">
<h1 style="margin:8px 0 6px;font-size:22px;line-height:1.3">${e.title}</h1>
<p style="margin:0;font-size:15px;line-height:1.55;color:#425249">${e.intro}</p></td></tr>
<tr><td align="center" style="padding:20px 28px 6px">
<div style="display:inline-block;background:${SOFT};border:1px solid #a7f3d0;border-radius:14px;padding:14px 22px;font-size:32px;font-weight:800;letter-spacing:8px;color:${GREEN};font-family:'SFMono-Regular',Menlo,Consolas,monospace">{{ .Token }}</div>
<p style="margin:10px 0 0;font-size:13px;color:${MUTED}">This code works once and expires soon.</p></td></tr>
<tr><td align="center" style="padding:18px 28px 4px">
<a href="{{ .ConfirmationURL }}" style="display:inline-block;background:${GREEN};color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:12px 26px;border-radius:12px">${e.button}</a>
<p style="margin:10px 0 0;font-size:13px;color:${MUTED}">${e.after}</p></td></tr>
<tr><td style="padding:22px 28px 26px;text-align:center;border-top:1px solid ${BORDER};font-size:12px;line-height:1.55;color:${MUTED}">
Didn't ask for this? You can ignore this email — nothing changes without the code.<br>
Never share this code. SalaamStreet will never ask you for it.<br>
<a href="https://salaamstreet.com" style="color:${GREEN};text-decoration:none">salaamstreet.com</a> · free, no ads</td></tr>
</table></td></tr></table>
</body></html>
`;
}

function build() {
  fs.mkdirSync(OUT, { recursive: true });
  const api = {};
  for (const [name, e] of Object.entries(EMAILS)) {
    const html = render(e);
    fs.writeFileSync(path.join(OUT, name + ".html"), html);
    api["mailer_subjects_" + name] = e.subject;
    api["mailer_templates_" + name + "_content"] = html;
  }
  fs.writeFileSync(path.join(OUT, "templates.json"), JSON.stringify(api, null, 1) + "\n");
  console.log("Wrote", Object.keys(EMAILS).length, "templates to", path.relative(process.cwd(), OUT));
}
if (require.main === module) build();

module.exports = { EMAILS, render };
