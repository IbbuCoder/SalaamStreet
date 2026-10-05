/* On-device prayer times (js/praytimes.js) against the independent, widely
   used adhan library (dev-only), for every method the app offers.
   Run: node --test tests/praytimes.test.js */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const adhan = require("adhan");
const pt = require("../js/praytimes.js");

const CITIES = {
  Chicago: [41.88, -87.63, "America/Chicago"], London: [51.51, -0.13, "Europe/London"], Makkah: [21.42, 39.83, "Asia/Riyadh"],
  Jakarta: [-6.21, 106.85, "Asia/Jakarta"], Cairo: [30.04, 31.24, "Africa/Cairo"], Karachi: [24.86, 67.01, "Asia/Karachi"],
  Stockholm: [59.33, 18.07, "Europe/Stockholm"], Sydney: [-33.87, 151.21, "Australia/Sydney"],
};
// SalaamStreet (AlAdhan) method id → the same angles in adhan.
function params(id) {
  const name = { 1: "Karachi", 2: "NorthAmerica", 3: "MuslimWorldLeague", 4: "UmmAlQura", 5: "Egyptian", 12: "Other", 13: "Turkey" }[id];
  const p = adhan.CalculationMethod[name]();
  if (id === 12) { p.fajrAngle = 12; p.ishaAngle = 12; }
  p.methodAdjustments = { fajr: 0, sunrise: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 }; // compare the astronomy, not house adjustments
  p.highLatitudeRule = adhan.HighLatitudeRule.TwilightAngle;
  p.rounding = adhan.Rounding.Nearest;
  return p;
}
const mins = (s) => +s.slice(0, 2) * 60 + +s.slice(3);

test("on-device times agree with adhan to within 2 minutes (8 cities, 4 seasons, 7 methods, both Asr schools)", () => {
  let worst = 0;
  for (const [city, [lat, lng, tz]] of Object.entries(CITIES)) {
    for (const day of ["2026-01-15", "2026-03-21", "2026-06-21", "2026-10-05"]) {
      const [y, m, d] = day.split("-").map(Number);
      for (const id of Object.keys(pt.METHODS).map(Number)) {
        for (const school of [0, 1]) {
          const p = params(id);
          p.madhab = school ? adhan.Madhab.Hanafi : adhan.Madhab.Shafi;
          const ref = new adhan.PrayerTimes(new adhan.Coordinates(lat, lng), new Date(Date.UTC(y, m - 1, d)), p);
          const mine = pt.times(new Date(y, m - 1, d), lat, lng, { method: id, school, tzOffset: pt.tzOffset(new Date(y, m - 1, d), tz) });
          const fmt = (t) => new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(t);
          for (const k of ["fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha"]) {
            const diff = Math.abs(mins(fmt(ref[k])) - mins(mine[k[0].toUpperCase() + k.slice(1)]));
            const gap = Math.min(diff, 1440 - diff);
            worst = Math.max(worst, gap);
            assert.ok(gap <= 2, `${city} ${day} method ${id} school ${school} ${k}: ${fmt(ref[k])} vs ${mine[k[0].toUpperCase() + k.slice(1)]}`);
          }
        }
      }
    }
  }
  assert.ok(worst <= 2);
});

test("times come in order, Umm al-Qura Isha is 90 minutes after Maghrib, and time zones are honoured", () => {
  const t = pt.times(new Date(2026, 9, 5), 21.42, 39.83, { method: 4, school: 0, tzOffset: 180 });
  const order = ["Imsak", "Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha"].map((k) => mins(t[k]));
  assert.deepEqual([...order].sort((a, b) => a - b), order);
  assert.equal(mins(t.Isha) - mins(t.Maghrib), 90);
  assert.equal(mins(t.Fajr) - mins(t.Imsak), 10);
  assert.equal(pt.tzOffset(new Date(2026, 6, 1), "America/Chicago"), -300);
  assert.equal(pt.tzOffset(new Date(2026, 0, 1), "America/Chicago"), -360);
});
