/* SalaamStreet — praytimes.js (classic script; also loads in Node and Deno)
   Prayer times calculated on the device, so they work with no internet, on
   any date, anywhere. Same astronomy and method parameters as the AlAdhan
   service the app uses online (both follow the PrayTimes.org formulas), so
   the two agree to within a minute or so. Used when AlAdhan can't be
   reached, and by the push-reminder server (backend/functions).

   SS.praytimes.times(date, lat, lng, { method, school, tzOffset }) →
     { Fajr, Sunrise, Dhuhr, Asr, Sunset, Maghrib, Isha, Imsak, Midnight, Firstthird, Lastthird }
   as "HH:MM" strings in the location's local time. `tzOffset` is minutes
   east of UTC (e.g. -300 for Chicago in summer); the device's offset for
   that date is used when it is left out. */
(function (root) {
  "use strict";
  var SS = root.SS = root.SS || {};

  /* AlAdhan method ids → twilight angles (degrees below the horizon), or
     Isha as minutes after Maghrib. */
  var METHODS = {
    1: { fajr: 18, isha: 18 },        // University of Islamic Sciences, Karachi
    2: { fajr: 15, isha: 15 },        // ISNA (North America)
    3: { fajr: 18, isha: 17 },        // Muslim World League
    4: { fajr: 18.5, ishaMin: 90 },   // Umm al-Qura, Makkah
    5: { fajr: 19.5, isha: 17.5 },    // Egyptian General Authority of Survey
    12: { fajr: 12, isha: 12 },       // UOIF (France)
    13: { fajr: 18, isha: 17 },       // Diyanet (Türkiye)
  };

  var rad = Math.PI / 180;
  function sin(d) { return Math.sin(d * rad); }
  function cos(d) { return Math.cos(d * rad); }
  function tan(d) { return Math.tan(d * rad); }
  function asin(x) { return Math.asin(x) / rad; }
  function acos(x) { return Math.acos(x) / rad; }
  function atan2(y, x) { return Math.atan2(y, x) / rad; }
  function acot(x) { return Math.atan(1 / x) / rad; }
  function fix(a, b) { a = a - b * Math.floor(a / b); return a < 0 ? a + b : a; }

  function julian(y, m, d) {
    if (m <= 2) { y -= 1; m += 12; }
    var A = Math.floor(y / 100), B = 2 - A + Math.floor(A / 4);
    return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5;
  }
  /** Sun's declination and the equation of time (hours) for a Julian date. */
  function sunPosition(jd) {
    var D = jd - 2451545.0;
    var g = fix(357.529 + 0.98560028 * D, 360);
    var q = fix(280.459 + 0.98564736 * D, 360);
    var L = fix(q + 1.915 * sin(g) + 0.020 * sin(2 * g), 360);
    var e = 23.439 - 0.00000036 * D;
    var RA = atan2(cos(e) * sin(L), cos(L)) / 15;
    return { decl: asin(sin(e) * sin(L)), eqt: q / 15 - fix(RA, 24) };
  }

  function compute(date, lat, lng, opts) {
    opts = opts || {};
    var m = METHODS[opts.method] || METHODS[3];
    var asrFactor = +opts.school === 1 ? 2 : 1;
    var y = date.getFullYear(), mo = date.getMonth() + 1, d = date.getDate();
    var tz = (opts.tzOffset != null ? opts.tzOffset : -new Date(y, mo - 1, d, 12).getTimezoneOffset()) / 60;
    var jd = julian(y, mo, d) - lng / (15 * 24);

    function midDay(t) { return fix(12 - sunPosition(jd + t).eqt, 24); }
    /** Time (hours, UTC-ish solar) the sun reaches `angle` below the horizon; ccw = before noon. */
    function sunAngleTime(angle, t, ccw) {
      var decl = sunPosition(jd + t).decl, noon = midDay(t);
      var x = (-sin(angle) - sin(decl) * sin(lat)) / (cos(decl) * cos(lat));
      if (x < -1 || x > 1) return NaN;
      var h = acos(x) / 15;
      return noon + (ccw ? -h : h);
    }
    function asrTime(factor, t) {
      var decl = sunPosition(jd + t).decl;
      var angle = -acot(factor + tan(Math.abs(lat - decl)));
      return sunAngleTime(angle, t, false);
    }

    // Two passes: the first estimate the times, the second refine them at those times.
    var T = { fajr: 5, sunrise: 6, dhuhr: 12, asr: 13, sunset: 18, isha: 18 };
    for (var pass = 0; pass < 2; pass++) {
      var p = {};
      for (var k in T) p[k] = T[k] / 24;
      T = {
        fajr: sunAngleTime(m.fajr, p.fajr, true),
        sunrise: sunAngleTime(0.833, p.sunrise, true),
        dhuhr: midDay(p.dhuhr),
        asr: asrTime(asrFactor, p.asr),
        sunset: sunAngleTime(0.833, p.sunset, false),
        isha: m.ishaMin ? NaN : sunAngleTime(m.isha, p.isha, false),
      };
    }
    // Clock time at the location.
    for (var k2 in T) T[k2] += tz - lng / 15;
    if (m.ishaMin) T.isha = T.sunset + m.ishaMin / 60;

    // High latitudes: when twilight never ends (or lasts too long), cap Fajr and
    // Isha at a share of the night given by angle / 60 (AlAdhan's default rule).
    var night = 24 + T.sunrise - T.sunset;
    var fajrMax = night * m.fajr / 60;
    if (isNaN(T.fajr) || T.sunrise - T.fajr > fajrMax) T.fajr = T.sunrise - fajrMax;
    if (!m.ishaMin) {
      var ishaMax = night * m.isha / 60;
      if (isNaN(T.isha) || T.isha - T.sunset > ishaMax) T.isha = T.sunset + ishaMax;
    }

    T.maghrib = T.sunset;
    T.imsak = T.fajr - 10 / 60;
    T.midnight = T.sunset + night / 2;
    T.firstthird = T.sunset + night / 3;
    T.lastthird = T.sunset + night * 2 / 3;
    return T;
  }

  function hhmm(h) {
    if (isNaN(h)) return "--:--";
    var mins = Math.round(fix(h, 24) * 60) % 1440;
    return ("0" + Math.floor(mins / 60)).slice(-2) + ":" + ("0" + (mins % 60)).slice(-2);
  }

  SS.praytimes = {
    METHODS: METHODS,
    /** Hours (decimal, local) for each time — useful for maths. */
    hours: compute,
    times: function (date, lat, lng, opts) {
      var T = compute(date, lat, lng, opts);
      return {
        Fajr: hhmm(T.fajr), Sunrise: hhmm(T.sunrise), Dhuhr: hhmm(T.dhuhr), Asr: hhmm(T.asr),
        Sunset: hhmm(T.sunset), Maghrib: hhmm(T.maghrib), Isha: hhmm(T.isha), Imsak: hhmm(T.imsak),
        Midnight: hhmm(T.midnight), Firstthird: hhmm(T.firstthird), Lastthird: hhmm(T.lastthird),
      };
    },
    /** Minutes east of UTC for an IANA time zone on a date (device offset if unknown). */
    tzOffset: function (date, timeZone) {
      var noon = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
      if (!timeZone) return -noon.getTimezoneOffset();
      try {
        var parts = new Intl.DateTimeFormat("en-US", { timeZone: timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
          .formatToParts(noon).reduce(function (o, x) { o[x.type] = +x.value; return o; }, {});
        var asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour % 24, parts.minute);
        return Math.round((asUtc - noon.getTime()) / 60000);
      } catch (e) { return -noon.getTimezoneOffset(); }
    },
  };
  if (typeof module !== "undefined" && module.exports) module.exports = SS.praytimes;
})(typeof window !== "undefined" ? window : globalThis);
