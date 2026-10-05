/* SalaamStreet — which reminders a device should get right now.
   Pure logic (no network), shared by the send-reminders function and the
   tests. Times are worked out on the server with the same calculator the app
   uses offline (praytimes.js), in the device's own time zone. */

export const FIVE = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];
/** The function runs every 5 minutes; anything due in the last WINDOW minutes is sent once. */
export const WINDOW = 10;

/** Local date ("YYYY-MM-DD"), weekday (0 = Sunday) and minute of the day in a time zone. */
export function localNow(nowMs, tz) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short",
  }).formatToParts(new Date(nowMs)).map((x) => [x.type, x.value]));
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday);
  return { date: `${p.year}-${p.month}-${p.day}`, y: +p.year, m: +p.month, d: +p.day, weekday: wd, minute: (+p.hour % 24) * 60 + +p.minute };
}

function mins(hhmm) { return +hhmm.slice(0, 2) * 60 + +hhmm.slice(3, 5); }
function fill(s, vars) { return String(s).replace(/\{(\w+)\}/g, (_, k) => (k in vars ? vars[k] : "{" + k + "}")); }
function clock(hhmm, lang) {
  if (lang !== "en") return hhmm;
  const h = +hhmm.slice(0, 2), m = hhmm.slice(3, 5);
  return ((h + 11) % 12 + 1) + ":" + m + (h < 12 ? " AM" : " PM");
}

/**
 * sub: a push_subscriptions row. pt: SS.praytimes. messages: { lang: { key: text } }.
 * Returns { send: [{ id, title, body, tag, url, prayed? }], sent } — `sent` is the
 * updated record of what has gone out today, to store back on the row.
 */
export function dueReminders(sub, nowMs, pt, messages) {
  const L = localNow(nowMs, sub.tz);
  const M = Object.assign({}, messages.en, messages[sub.lang] || {});
  const t = (k, v) => fill(M[k] || k, v || {});
  const day = new Date(L.y, L.m - 1, L.d);
  const times = pt.times(day, +sub.lat, +sub.lng, { method: +sub.method, school: +sub.school, tzOffset: pt.tzOffset(day, sub.tz) });
  const sent = sub.sent && sub.sent.date === L.date ? { date: L.date, ids: [...sub.sent.ids] } : { date: L.date, ids: [] };
  const send = [];
  const at = (id, minute, msg) => {
    if (sent.ids.includes(id)) return;
    if (L.minute >= minute && L.minute < minute + WINDOW) { sent.ids.push(id); send.push(Object.assign({ id }, msg)); }
  };
  const off = +sub.offset_min || 0;
  if (sub.prayers) {
    for (const key of FIVE) {
      const p = t("prayer." + key);
      at(key, mins(times[key]) - off, {
        title: off ? t("rem.soon", { p, n: off }) : t("rem.now", { p }),
        body: clock(times[key], sub.lang),
        tag: `prayer-${L.date}-${key}`,
        url: "./#/home",
        prayed: `./#/home/prayed/${key}/${L.date}`,
        action: t("daily.iPrayed"),
      });
    }
  }
  if (sub.kahf && L.weekday === 5) {
    at("kahf", 10 * 60, { title: t("friday.title"), body: t("friday.notify"), tag: `kahf-${L.date}`, url: "./#/surah/18" });
  }
  if (sub.adhkar) {
    at("adhkar-morning", mins(times.Fajr) + 20, { title: t("daily.adhkarRem_morning"), body: t("daily.adhkarRemBody"), tag: `adhkar-morning-${L.date}`, url: "./#/adhkar/morning" });
    at("adhkar-evening", mins(times.Asr) + 20, { title: t("daily.adhkarRem_evening"), body: t("daily.adhkarRemBody"), tag: `adhkar-evening-${L.date}`, url: "./#/adhkar/evening" });
  }
  return { send, sent };
}
