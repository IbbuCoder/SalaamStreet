// SalaamStreet — plans (prepared, NOT live). Plain JavaScript so the Edge
// Function (Deno) and the tests (Node) share it.
//
// This describes the planned 3.0 plans so the backend has one place to look
// them up later. Billing is OFF: nobody can buy or hold a paid plan, every
// account is on Free, and no payment provider is needed or contacted.
// Allowances are placeholders to tune before launch; none is "unlimited".
//
// The private AI Testing Lab never looks at plans: only the admin check in
// core.js lets someone in, so a plan can never stand in for admin access.

export const BILLING_ENABLED = false;

export const PLANS = Object.freeze({
  free: { name: "Free", usdPerMonth: 0, aiRequestsPerDay: 0, status: "live",
    features: ["Prayer times and reminders", "Qibla", "Mosque finder", "Qur'an with audio, translations and tafsir",
      "Prayer check-ins", "Duas and dhikr", "Hadith", "Islamic calendar", "Stories", "Modes, Kids Mode and Family", "Account and sync"] },
  plus: { name: "Plus", usdPerMonth: 4.99, aiRequestsPerDay: 20, status: "planned",
    features: ["Islamic AI tutor", "Qur'an study and tafsir help (where reliable content is available)",
      "Personal study notes and saved research", "Learning and worship planning"] },
  pro: { name: "Pro", usdPerMonth: 7.99, aiRequestsPerDay: 50, status: "planned", includes: "plus",
    features: ["More extensive, source-aware research", "Organization and planning tools", "Family study spaces",
      "Hajj and Umrah planning"] },
  max: { name: "Max", usdPerMonth: 9.99, aiRequestsPerDay: 100, status: "planned", includes: "pro",
    features: ["Highest AI and research allowances", "Larger research projects and multi-document analysis",
      "More collaboration and family features"] },
});

/** The plan an account is on. While billing is off this is always "free",
    whatever a database row or a request claims. */
export function planFor(_record) {
  if (!BILLING_ENABLED) return "free";
  const p = _record && _record.status === "active" && PLANS[_record.plan] ? _record.plan : "free";
  return p;
}

/** Daily AI requests an account's plan allows (0 on Free). Not used for the Lab. */
export function aiAllowance(record) {
  return PLANS[planFor(record)].aiRequestsPerDay;
}
