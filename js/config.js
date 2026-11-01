/* SalaamStreet — config.js (classic script)
   Site configuration for optional accounts (Update 2.5).

   Accounts use Supabase (Auth + Postgres). Fill in your project's URL and
   anon/publishable key from Supabase → Project Settings → API. Both are
   designed to be public: every table is protected by Row-Level Security
   (backend/supabase-schema.sql), so a key only ever reaches the signed-in
   person's own rows. NEVER put the service_role key here.

   While supabaseUrl is empty, SalaamStreet runs in guest mode only: every
   feature works and data stays on the device; the Account page explains
   that sign-in isn't available on this copy of the site.

   signInMethods lists the buttons shown, in order. Remove any method you
   haven't enabled in Supabase → Authentication → Providers yet.
   See backend/README-backend.md for the full setup. */
(function () {
  "use strict";
  window.SS = window.SS || {};
  SS.CONFIG = {
    supabaseUrl: "https://aqyanyrmxjjofhyxodzm.supabase.co",
    supabaseAnonKey: "sb_publishable_tgu8mvHZ9RwiXz7tcKjnyg_5fRzsvvh",
    // Google and email are switched on in Supabase. Add "apple" and "phone"
    // back here once each is set up (backend/README-backend.md).
    signInMethods: ["google", "email"],
    // Reminders when SalaamStreet is closed (2.8): the VAPID *public* key.
    // The reminder server made this pair itself (public.push_keys); the
    // private half never leaves Supabase. Empty = the option stays hidden.
    pushPublicKey: "BFmjKhYmieuXb1eouDVi5JTsbe8FVIZO31MyaFjcjpD0on5GMoAFd83wFmkbrkdOIVJIooT1F4Ad7RVAZdfKFbk",
  };

  /* TEMPORARY — the admin access code (November 2026).
     While sign-in isn't working, the Admin Panel (#/admin) opens with an
     access code instead of an account. The code is checked by the server
     (CODE_ACCESS in backend/functions/admin/core.js), never here.
     It switches itself off after this date. To turn it off sooner, set
     ADMIN_CODE_UNTIL to "" — and switch it off on the server too (see
     core.js). */
  SS.ADMIN_CODE_UNTIL = "2026-11-07T08:00:00Z";
  SS.adminCode = {
    active: function () { var u = Date.parse(SS.ADMIN_CODE_UNTIL || ""); return !isNaN(u) && Date.now() < u; },
    get: function () {
      if (!SS.adminCode.active()) return "";
      try { return localStorage.getItem("ss.adminCode") || ""; } catch (e) { return ""; }
    },
    set: function (code) {
      try { if (code) localStorage.setItem("ss.adminCode", code); else localStorage.removeItem("ss.adminCode"); } catch (e) { /* private mode */ }
    },
  };

  /* Qur'an PDF (Offline Qur'an, 2.6.0). People can download this file, save it
     to their device and read it offline in SalaamStreet's own viewer. The file
     goes in files/ with exactly this name. While SS.QURAN_PDF is empty, or the
     file isn't there, the PDF card is hidden everywhere.
     bytes: the file's exact size, shown before downloading. Set it when the
     file is added; until then the size the server reports is shown. */
  SS.QURAN_PDF = "files/quran-english-sher-ali.pdf";
  SS.QURAN_PDF_INFO = {
    title: "The Holy Qur'ān",
    translator: "Maulawi Sher Ali",
    source: "alislam.org",
    sourceUrl: "https://www.alislam.org/quran/",
    bytes: 18597296,
  };
})();
