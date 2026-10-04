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
  };
})();
