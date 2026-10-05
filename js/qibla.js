/* SalaamStreet — qibla.js (classic script)
   Qibla finder: compass mode and camera mode.

   How the direction is found (all on the device):
   1. Bearing — the great-circle bearing from the person's location to the
      Kaaba, clockwise from TRUE north (SS.qiblaBearing in core.js).
   2. Heading — where the phone points, from the DeviceOrientation sensors.
      Phone compasses measure MAGNETIC north (Android's absolute orientation
      and iOS's webkitCompassHeading both do), which differs from true north
      by the local magnetic declination — up to 15–20° in parts of North
      America, Australia and Asia. We correct it with the World Magnetic
      Model (WMM2025), so bearing and heading use the same north.
   3. Orientation — the full alpha/beta/gamma rotation is used, not just
      alpha, so the heading is right whether the phone is flat (top edge) or
      held upright (direction of the back camera), in any screen rotation.

   Without a real location we show no direction at all — never a guess. */
(function (root) {
  "use strict";
  var SS = (root.SS = root.SS || {});
  var RAD = Math.PI / 180;

  /* ═══════════ World Magnetic Model 2025 (declination) ═══════════
     Coefficients: NOAA/BGS WMM2025, valid 2025.0–2030.0. Algorithm and
     coefficient tables ported from the MIT-licensed `magvar` package
     (© 2025 Darren Yeates, github.com/dpyeates/magvar). */
  var WMM = {
    epoch: 2025.0, validUntil: 2030.0,
    g: [
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [-29351.8, -1410.8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [-2556.6, 2951.1, 1649.3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [1361.0, -2404.1, 1243.8, 453.6, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [895.0, 799.5, 55.7, -281.1, 12.1, 0, 0, 0, 0, 0, 0, 0, 0],
      [-233.2, 368.9, 187.2, -138.7, -142.0, 20.9, 0, 0, 0, 0, 0, 0, 0],
      [64.4, 63.8, 76.9, -115.7, -40.9, 14.9, -60.7, 0, 0, 0, 0, 0, 0],
      [79.5, -77.0, -8.8, 59.3, 15.8, 2.5, -11.1, 14.2, 0, 0, 0, 0, 0],
      [23.2, 10.8, -17.5, 2.0, -21.7, 16.9, 15.0, -16.8, 0.9, 0, 0, 0, 0],
      [4.6, 7.8, 3.0, -0.2, -2.5, -13.1, 2.4, 8.6, -8.7, -12.9, 0, 0, 0],
      [-1.3, -6.4, 0.2, 2.0, -1.0, -0.6, -0.9, 1.5, 0.9, -2.7, -3.9, 0, 0],
      [2.9, -1.5, -2.5, 2.4, -0.6, -0.1, -0.6, -0.1, 1.1, -1.0, -0.2, 2.6, 0],
      [-2.0, -0.2, 0.3, 1.2, -1.3, 0.6, 0.6, 0.5, -0.1, -0.4, -0.2, -1.3, -0.7],
    ],
    h: [
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 4545.4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, -3133.6, -815.1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, -56.6, 237.5, -549.5, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 278.6, -133.9, 212.0, -375.6, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 45.4, 220.2, -122.9, 43.0, 106.1, 0, 0, 0, 0, 0, 0, 0],
      [0, -18.4, 16.8, 48.8, -59.8, 10.9, 72.7, 0, 0, 0, 0, 0, 0],
      [0, -48.9, -14.4, -1.0, 23.4, -7.4, -25.1, -2.3, 0, 0, 0, 0, 0],
      [0, 7.1, -12.6, 11.4, -9.7, 12.7, 0.7, -5.2, 3.9, 0, 0, 0, 0],
      [0, -24.8, 12.2, 8.3, -3.3, -5.2, 7.2, -0.6, 0.8, 10.0, 0, 0, 0],
      [0, 3.3, 0.0, 2.4, 5.3, -9.1, 0.4, -4.2, -3.8, 0.9, -9.1, 0, 0],
      [0, 0, 2.9, -0.6, 0.2, 0.5, -0.3, -1.2, -1.7, -2.9, -1.8, -2.3, 0],
      [0, -1.3, 0.7, 1.0, -1.4, 0.0, 0.6, -0.1, 0.8, 0.1, -1.0, 0.1, 0.2],
    ],
    gt: [
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [12.0, 9.7, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [-11.6, -5.2, -8.0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [-1.3, -4.2, 0.4, -15.6, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [-1.6, -2.4, -6.0, 5.6, -7.0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0.6, 1.4, 0.0, 0.6, 2.2, 0.9, 0, 0, 0, 0, 0, 0, 0],
      [-0.2, -0.4, 0.9, 1.2, -0.9, 0.3, 0.9, 0, 0, 0, 0, 0, 0],
      [0, -0.1, -0.1, 0.5, -0.1, -0.8, -0.8, 0.8, 0, 0, 0, 0, 0],
      [-0.1, 0.2, 0.0, 0.5, -0.1, 0.3, 0.2, 0, 0.2, 0, 0, 0, 0],
      [0, -0.1, 0.1, 0.3, -0.3, 0, 0.3, -0.1, 0.1, -0.1, 0, 0, 0],
      [0.1, 0.0, 0.1, 0.1, 0, -0.3, 0, -0.1, -0.1, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, -0.1, 0, 0, -0.1, -0.1, -0.1, -0.1, 0],
      [0, 0, 0, 0, 0, 0, 0.1, 0, 0, 0, -0.1, 0, -0.1],
    ],
    ht: [
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, -21.5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, -27.7, -12.1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 4.0, -0.3, -4.1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, -1.1, 4.1, 1.6, -4.4, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, -0.5, 2.2, 0.4, 1.7, 1.9, 0, 0, 0, 0, 0, 0, 0],
      [0, 0.3, -1.6, -0.4, 0.9, 0.7, 0.9, 0, 0, 0, 0, 0, 0],
      [0, 0.6, 0.5, -0.8, 0.0, -1.0, 0.6, -0.2, 0, 0, 0, 0, 0],
      [0, -0.2, 0.5, -0.4, 0.4, -0.5, -0.6, 0.3, 0.2, 0, 0, 0, 0],
      [0, -0.3, 0.3, -0.3, 0.3, 0.2, -0.1, -0.2, 0.4, 0.1, 0, 0, 0],
      [0, 0, 0, -0.2, 0.1, -0.1, 0.1, 0.0, -0.1, 0.2, 0, 0, 0],
      [0, 0, 0.1, 0, 0.1, 0, 0, 0.1, 0, 0, 0, 0, 0],
      [0, 0, 0, -0.1, 0.1, 0, 0, 0, 0, 0, 0, 0, -0.1],
    ],
  };

  function zeros(n) { var a = []; for (var i = 0; i < n; i++) { a.push([]); for (var j = 0; j < n; j++) a[i].push(0); } return a; }
  var N = 12;
  var ROOT = [], ROOTS = zeros(N + 1);
  (function () {
    for (var n = 2; n <= N; n++) ROOT[n] = Math.sqrt((2 * n - 1) / (2 * n));
    for (var m = 0; m <= N; m++) {
      for (var n2 = Math.max(m + 1, 2); n2 <= N; n2++) {
        ROOTS[m][n2] = [Math.sqrt((n2 - 1) * (n2 - 1) - m * m), 1 / Math.sqrt(n2 * n2 - m * m)];
      }
    }
  })();

  function decimalYear(d) {
    var y = d.getUTCFullYear();
    var start = Date.UTC(y, 0, 1), end = Date.UTC(y + 1, 0, 1);
    return y + (d.getTime() - start) / (end - start);
  }

  /** Magnetic declination in degrees (east positive) at a place and time. */
  function declination(lat, lng, when, altKm) {
    var year = typeof when === "number" ? when : decimalYear(when || new Date());
    // Outside the model's 5-year window the secular-variation extrapolation
    // degrades; clamp so we never extrapolate wildly.
    var dt = Math.min(Math.max(year, WMM.epoch), WMM.validUntil) - WMM.epoch;
    var alt = altKm || 0;
    var a = 6378.137, b = 6356.7523142, r0 = 6371.2;
    var gnm = zeros(N + 1), hnm = zeros(N + 1), P = zeros(N + 1), DP = zeros(N + 1);
    var n, m;
    for (n = 1; n <= N; n++) for (m = 0; m <= n; m++) {
      gnm[n][m] = WMM.g[n][m] + dt * WMM.gt[n][m];
      hnm[n][m] = WMM.h[n][m] + dt * WMM.ht[n][m];
    }
    var latR = lat * RAD, lonR = lng * RAD;
    var sinLat = Math.sin(latR), cosLat = Math.cos(latR);
    var sr = Math.sqrt(a * a * cosLat * cosLat + b * b * sinLat * sinLat);
    var theta = Math.atan2(cosLat * (alt * sr + a * a), sinLat * (alt * sr + b * b));
    var r = Math.sqrt(alt * alt + 2 * alt * sr +
      (Math.pow(a, 4) - (Math.pow(a, 4) - Math.pow(b, 4)) * sinLat * sinLat) / (a * a - (a * a - b * b) * sinLat * sinLat));
    var c = Math.cos(theta), s = Math.sin(theta);
    var invS = 1 / (s + (s === 0 ? 1e-8 : 0));
    P[0][0] = 1; P[1][1] = s; DP[0][0] = 0; DP[1][1] = c; P[1][0] = c; DP[1][0] = -s;
    for (n = 2; n <= N; n++) {
      P[n][n] = P[n - 1][n - 1] * s * ROOT[n];
      DP[n][n] = (DP[n - 1][n - 1] * s + P[n - 1][n - 1] * c) * ROOT[n];
    }
    for (m = 0; m <= N; m++) {
      for (n = Math.max(m + 1, 2); n <= N; n++) {
        P[n][m] = (P[n - 1][m] * c * (2 * n - 1) - P[n - 2][m] * ROOTS[m][n][0]) * ROOTS[m][n][1];
        DP[n][m] = ((DP[n - 1][m] * c - P[n - 1][m] * s) * (2 * n - 1) - DP[n - 2][m] * ROOTS[m][n][0]) * ROOTS[m][n][1];
      }
    }
    var BR = 0, BT = 0, BP = 0, fn0 = r0 / r, fn = fn0 * fn0;
    for (n = 1; n <= N; n++) {
      var c1 = 0, c2 = 0, c3 = 0;
      for (m = 0; m <= n; m++) {
        var sm = Math.sin(m * lonR), cm = Math.cos(m * lonR);
        var tmp = gnm[n][m] * cm + hnm[n][m] * sm;
        c1 += tmp * P[n][m];
        c2 += tmp * DP[n][m];
        c3 += m * (gnm[n][m] * sm - hnm[n][m] * cm) * P[n][m];
      }
      fn *= fn0;
      BR += (n + 1) * c1 * fn;
      BT -= c2 * fn;
      BP += c3 * fn * invS;
    }
    var psi = theta - (Math.PI / 2 - latR);
    var x = -BT * Math.cos(psi) - BR * Math.sin(psi), y = BP;
    return x !== 0 || y !== 0 ? Math.atan2(y, x) / RAD : 0;
  }

  /* ═══════════ Orientation math ═══════════ */
  function norm360(d) { return ((d % 360) + 360) % 360; }
  /** Signed smallest difference a→b in degrees, in (-180, 180]. */
  function angleDiff(a, b) { var d = norm360(b - a); return d > 180 ? d - 360 : d; }

  /**
   * Headings from a W3C DeviceOrientation reading (alpha/beta/gamma in
   * degrees, alpha measured from north). The device→earth rotation is
   * R = Rz(alpha)·Rx(beta)·Ry(gamma); its columns are the device's x
   * (right), y (top) and z (out of the screen) axes in East/North/Up.
   *   top     — compass heading of the top of the SCREEN (uses the screen
   *             rotation angle, for landscape)
   *   camera  — compass heading of the back camera (−z)
   *   flat    — how close to flat the phone is (1 flat, 0 upright)
   *   pitch   — camera elevation above the horizon, degrees
   */
  function orientationHeadings(alpha, beta, gamma, screenAngle) {
    var cA = Math.cos(alpha * RAD), sA = Math.sin(alpha * RAD);
    var cB = Math.cos(beta * RAD), sB = Math.sin(beta * RAD);
    var cG = Math.cos(gamma * RAD), sG = Math.sin(gamma * RAD);
    var xE = cA * cG - sA * sB * sG, xN = sA * cG + cA * sB * sG;
    var yE = -sA * cB, yN = cA * cB;
    var zE = cA * sG + sA * sB * cG, zN = sA * sG - cA * sB * cG, zU = cB * cG;
    var th = (screenAngle || 0) * RAD;
    var upE = Math.cos(th) * yE + Math.sin(th) * xE, upN = Math.cos(th) * yN + Math.sin(th) * xN;
    return {
      top: norm360(Math.atan2(upE, upN) / RAD),
      camera: norm360(Math.atan2(-zE, -zN) / RAD),
      flat: Math.abs(zU),
      pitch: Math.asin(Math.max(-1, Math.min(1, -zU))) / RAD,
    };
  }

  function distanceKm(lat, lng) {
    var R = 6371;
    var dLat = (SS.KAABA.lat - lat) * RAD, dLng = (SS.KAABA.lng - lng) * RAD;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat * RAD) * Math.cos(SS.KAABA.lat * RAD) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  SS.qiblaMath = {
    declination: declination, orientationHeadings: orientationHeadings,
    angleDiff: angleDiff, norm360: norm360, distanceKm: distanceKm,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = SS.qiblaMath;
  if (typeof document === "undefined") return; // Node (tests): math only.

  /* ═══════════ Compass sensor ═══════════ */
  var compass = (function () {
    var listeners = [], listening = false, evName = null;
    var decl = 0, iosOffset = null, smooth = { top: null, camera: null };
    var last = null, rafPending = false, gotAbsolute = false;

    function screenAngle() {
      try {
        if (screen.orientation && typeof screen.orientation.angle === "number") return screen.orientation.angle;
      } catch (e) { /* noop */ }
      return typeof window.orientation === "number" ? window.orientation : 0;
    }
    // Low-pass filter on the unit circle (so 359°→1° doesn't swing round).
    function lowpass(prev, next, k) {
      if (prev === null) return next;
      var x = Math.cos(prev * RAD) * (1 - k) + Math.cos(next * RAD) * k;
      var y = Math.sin(prev * RAD) * (1 - k) + Math.sin(next * RAD) * k;
      return norm360(Math.atan2(y, x) / RAD);
    }
    // Smooth hard while the phone is still (hides sensor jitter) but follow
    // quickly while it's turning (no lag): the bigger the jump, the less smoothing.
    function adaptiveK(prev, next) {
      if (prev === null) return 1;
      return Math.min(0.85, 0.12 + Math.abs(angleDiff(prev, next)) / 25);
    }
    function onEvent(e) {
      if (typeof e.alpha !== "number" || typeof e.beta !== "number" || typeof e.gamma !== "number" || isNaN(e.alpha)) return;
      var alphaAbs = null, accuracy = null;
      if (typeof e.webkitCompassHeading === "number" && e.webkitCompassHeading >= 0) {
        // iOS: alpha is relative to where the page started; webkitCompassHeading
        // is the magnetic heading of the device top (≈ the camera when upright).
        // Track the offset between them so the full 3-D maths can use alpha.
        accuracy = typeof e.webkitCompassAccuracy === "number" ? e.webkitCompassAccuracy : null;
        var target = norm360(360 - e.webkitCompassHeading - e.alpha);
        iosOffset = iosOffset === null ? target : lowpass(iosOffset, target, 0.15);
        alphaAbs = e.alpha + iosOffset;
      } else if (e.absolute === true || e.type === "deviceorientationabsolute") {
        alphaAbs = e.alpha; // Android / Chrome / Firefox: alpha is from magnetic north
      } else {
        return; // relative-only orientation can't tell where north is
      }
      gotAbsolute = true;
      var h = orientationHeadings(alphaAbs, e.beta, e.gamma, screenAngle());
      // Magnetic → true north.
      var top = norm360(h.top + decl), cam = norm360(h.camera + decl);
      smooth.top = lowpass(smooth.top, top, adaptiveK(smooth.top, top));
      smooth.camera = lowpass(smooth.camera, cam, adaptiveK(smooth.camera, cam));
      last = { top: smooth.top, camera: smooth.camera, flat: h.flat, pitch: h.pitch, accuracy: accuracy };
      if (!rafPending) {
        rafPending = true;
        (window.requestAnimationFrame || setTimeout)(function () {
          rafPending = false;
          for (var i = 0; i < listeners.length; i++) listeners[i](last);
        });
      }
    }
    return {
      supported: function () { return typeof window.DeviceOrientationEvent !== "undefined"; },
      /** iOS 13+ asks for motion permission, and only from a tap. */
      needsPermission: function () {
        return !!(window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission === "function") && !listening;
      },
      requestPermission: function () {
        if (!(window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission === "function")) return Promise.resolve("granted");
        return DeviceOrientationEvent.requestPermission().catch(function () { return "denied"; });
      },
      setLocation: function (lat, lng) { decl = declination(lat, lng, new Date()); return decl; },
      declination: function () { return decl; },
      hasReading: function () { return gotAbsolute; },
      last: function () { return last; },
      start: function () {
        if (listening) return;
        evName = "ondeviceorientationabsolute" in window ? "deviceorientationabsolute" : "deviceorientation";
        window.addEventListener(evName, onEvent, true);
        listening = true;
      },
      stop: function () {
        if (listening) window.removeEventListener(evName, onEvent, true);
        listening = false; gotAbsolute = false; iosOffset = null;
        smooth.top = smooth.camera = null; last = null;
      },
      isListening: function () { return listening; },
      on: function (fn) { if (listeners.indexOf(fn) === -1) listeners.push(fn); },
      off: function (fn) { var i = listeners.indexOf(fn); if (i > -1) listeners.splice(i, 1); },
    };
  })();
  SS.compass = compass;


  /* ═══════════ Qibla view ═══════════ */
  var $ = function (id) { return document.getElementById(id); };
  function t(k) { return SS.i18n.t(k); }
  function f(k, v) { return SS.ui.f(k, v); }
  var bearing = null, noSensorTimer = null, loc = null, loadGen = 0;
  var camStream = null, camOpen = false, camPushed = false;
  // Locked on, with hysteresis: lock within LOCK_IN degrees, and stay locked
  // until LOCK_OUT degrees away, so sensor jitter can't make it flicker.
  var LOCK_IN = 4, LOCK_OUT = 8, aligned = false;

  function fmtDeg(d) { return (Math.round(d * 10) / 10).toFixed(1); }
  /** Eight-point compass name for a bearing (N, NE, E, …). */
  function pointName(d) { return t("qibla.dir" + Math.round(norm360(d) / 45) % 8); }
  function turnText(diff) {
    if (aligned) return t("qibla.aligned");
    return f(diff > 0 ? "qibla.turnRight" : "qibla.turnLeft", { n: Math.max(1, Math.round(Math.abs(diff))) });
  }
  /** Write text only when it changes (readings arrive many times a second). */
  function setText(el, s) { if (el.textContent !== s) el.textContent = s; }
  function setHidden(el, on) { if (on) el.setAttribute("hidden", ""); else el.removeAttribute("hidden"); }
  /** The one big instruction at the top of the card ("" once the compass is live:
      the turn / facing-the-Qibla pill takes over). */
  function step(s) { setText($("qb-step"), s); }
  function needStart(on) {
    $("qb-enable").hidden = !on;
    $("qibla-card").classList.toggle("needs-start", on);
    if (on) step(t("qibla.stepStart"));
  }
  function desktopStep() {
    if (bearing !== null) step(f("qibla.stepDesktop", { deg: Math.round(bearing), dir: pointName(bearing) }));
  }

  /** Compass-mode heading: top of the screen when flat-ish, else where the camera faces. */
  function facing(r) { return r.flat >= 0.5 ? r.top : r.camera; }

  function updateLock(diff, quiet) {
    var was = aligned;
    aligned = Math.abs(diff) <= (was ? LOCK_OUT : LOCK_IN);
    if (aligned && !was && !quiet) {
      SS.ui.vibrate(30);
      pulse(camOpen ? $("qb-cam") : $("qibla-card"));
    }
    return aligned;
  }
  var pulseTimer = null;
  function pulse(el) {
    el.classList.remove("qb-lock");
    void el.offsetWidth; // restart the animation
    el.classList.add("qb-lock");
    clearTimeout(pulseTimer);
    pulseTimer = setTimeout(function () { el.classList.remove("qb-lock"); }, 900);
  }

  /* ── Animation: everything on screen glides to the latest reading ──
     Sensor readings set a target; each animation frame eases the shown
     heading toward it (time-based, so it feels the same at 30 or 120 Hz)
     and moves things with transforms only — no layout work per frame. */
  var anim = { target: null, shown: null, pitchT: 0, pitch: 0, raf: 0, last: 0 };
  var TAU = 70; // ms
  function setTarget(h) {
    anim.target = h;
    if (anim.shown === null) anim.shown = h;
    if (!anim.raf) { anim.last = 0; anim.raf = requestAnimationFrame(frame); }
  }
  function resetAnim() {
    if (anim.raf) window.cancelAnimationFrame(anim.raf);
    anim.raf = 0; anim.target = anim.shown = null;
  }
  function frame(ts) {
    anim.raf = 0;
    if (anim.target === null) return;
    var dt = anim.last ? Math.min(64, ts - anim.last) : 16;
    anim.last = ts;
    var k = 1 - Math.exp(-dt / TAU);
    var d = angleDiff(anim.shown, anim.target);
    // "shown" is left unwrapped (it can pass 360) so the dial never spins the long way.
    anim.shown = Math.abs(d) < 0.05 ? anim.shown + d : anim.shown + d * k;
    var dp = anim.pitchT - anim.pitch;
    anim.pitch = Math.abs(dp) < 0.05 ? anim.pitchT : anim.pitch + dp * k;
    if (camOpen) drawCamera(anim.shown); else drawCompass(anim.shown);
    if (Math.abs(d) >= 0.05 || Math.abs(dp) >= 0.05) anim.raf = requestAnimationFrame(frame);
    else anim.last = 0;
  }

  /* ── Compass mode ───────────────────────────────────────────── */
  var KAABA_R = 112, ARC_R = 140;
  function arcPoint(a) {
    return (150 + ARC_R * Math.sin(a * RAD)).toFixed(1) + " " + (150 - ARC_R * Math.cos(a * RAD)).toFixed(1);
  }
  function drawCompass(h) {
    if (SS.currentView() !== "qibla") return;
    $("qb-dial").setAttribute("transform", "rotate(" + (-h).toFixed(2) + " 150 150)");
    if (bearing === null) return;
    // Keep the Kaaba upright whatever the dial's rotation.
    $("qb-kaaba").setAttribute("transform", "translate(150 " + (150 - KAABA_R) + ") rotate(" + (h - bearing).toFixed(2) + ")");
    var diff = angleDiff(h, bearing);
    // Gold arc: from where you face to the Qibla, the way you should turn.
    $("qb-arc").setAttribute("d", Math.abs(diff) < 1 ? "" :
      "M" + arcPoint(norm360(h)) + " A" + ARC_R + " " + ARC_R + " 0 0 " + (diff > 0 ? 1 : 0) + " " + arcPoint(bearing));
    setText($("qb-hub-n"), Math.round(Math.abs(diff)) + "°");
    setText($("qb-hub-l"), aligned ? t("qibla.locked") : Math.round(Math.abs(diff)) === 0 ? "" : t(diff > 0 ? "qibla.toRight" : "qibla.toLeft"));
  }
  /** Before any compass reading (e.g. a laptop): north up, show the bearing. */
  function drawStatic() {
    $("qb-dial").setAttribute("transform", "rotate(0 150 150)");
    $("qb-arc").setAttribute("d", "");
    if (bearing === null) { setText($("qb-hub-n"), "—"); setText($("qb-hub-l"), ""); return; }
    $("qb-kaaba").setAttribute("transform", "translate(150 " + (150 - KAABA_R) + ") rotate(" + (-bearing).toFixed(2) + ")");
    setText($("qb-hub-n"), Math.round(bearing) + "°");
    setText($("qb-hub-l"), t("qibla.fromNorthShort"));
  }

  function sensorState(state) {
    var dot = $("qb-sensor-dot");
    dot.classList.toggle("on", state === "live");
    dot.classList.toggle("warn", state === "low");
    setText($("qb-sensor"), state === "live" ? t("qibla.sensorLive") : state === "low" ? t("qibla.sensorLow")
      : state === "none" ? t("qibla.sensorNone") : "—");
  }

  /** quiet: refresh without the lock-on buzz (e.g. coming back from camera mode). */
  function renderCompass(r, quiet) {
    if (SS.currentView() !== "qibla" || camOpen) return;
    var low = r.accuracy !== null && (r.accuracy < 0 || r.accuracy > 25);
    sensorState(low ? "low" : "live");
    var heading = facing(r);
    if (bearing !== null) {
      var diff = angleDiff(heading, bearing);
      var on = updateLock(diff, quiet === true);
      $("qibla-card").classList.toggle("aligned", on);
      setHidden($("qb-aligned"), !on);
      setHidden($("qb-turn"), on);
      setText($("qb-turn"), on ? "" : turnText(diff));
    }
    setTarget(heading);
    step("");
    setText($("qb-hint"), low ? t("qibla.lowAccuracy") : "");
  }

  function startSensors(fromTap) {
    if (!compass.supported() || window.isSecureContext === false) {
      $("qb-hint").textContent = t("qibla.noCompass"); sensorState("none"); desktopStep(); return Promise.resolve(false);
    }
    if (compass.needsPermission() && !fromTap) { needStart(true); return Promise.resolve(false); }
    var p = compass.needsPermission() ? compass.requestPermission() : Promise.resolve("granted");
    return p.then(function (res) {
      if (res !== "granted") { needStart(true); $("qb-hint").textContent = t("qibla.motionDenied"); return false; }
      needStart(false);
      step(t("qibla.stepTurn"));
      compass.on(renderCompass);
      compass.on(renderCamera);
      compass.start();
      clearTimeout(noSensorTimer);
      noSensorTimer = setTimeout(function () {
        if (!compass.hasReading()) {
          $("qb-hint").textContent = t("qibla.noCompass");
          sensorState("none");
          desktopStep();
          if (camOpen) $("qb-cam-msg").textContent = t("qibla.cameraNoCompass");
        }
      }, 3000);
      return true;
    });
  }
  function stopSensors() {
    clearTimeout(noSensorTimer);
    compass.off(renderCompass); compass.off(renderCamera);
    compass.stop();
    resetAnim();
  }

  function showLocationState(l) {
    var warn = $("qb-locwarn");
    if (l.isFallback) {
      warn.hidden = false;
      $("qb-locwarn-text").textContent = t("qibla.needLocation");
    } else if (l.approx) {
      warn.hidden = false;
      $("qb-locwarn-text").textContent = t("qibla.approxLocation");
    } else {
      warn.hidden = true;
    }
  }

  function load() {
    var gen = ++loadGen;
    SS.geo.resolve().then(function (l) {
      if (gen !== loadGen || SS.currentView() !== "qibla") return;
      loc = l;
      $("qb-loc-label").textContent = SS.ui.locLabel(l);
      showLocationState(l);
      aligned = false;
      $("qibla-card").classList.remove("aligned");
      setHidden($("qb-aligned"), true);
      if (l.isFallback) {
        // No real location: show no direction rather than a made-up one.
        bearing = null;
        $("qb-deg").textContent = "—";
        $("qb-dir").textContent = "";
        setHidden($("qb-needle"), true);
        $("qb-dist").textContent = "—";
        $("qb-coords").textContent = "—";
        $("qb-decl").textContent = "—";
        setHidden($("qb-turn"), true);
        $("qb-compass").setAttribute("aria-label", t("qibla.needLocation"));
        $("qb-mode-camera").disabled = true;
        $("qb-hint").textContent = "";
        step(t("qibla.stepLocation"));
        needStart(false);
        drawStatic();
        if (camOpen) closeCamera();
        return;
      }
      bearing = SS.qiblaBearing(l.lat, l.lng);
      var d = compass.setLocation(l.lat, l.lng);
      $("qb-deg").textContent = fmtDeg(bearing);
      $("qb-dir").textContent = pointName(bearing);
      setHidden($("qb-needle"), false);
      $("qb-needle").setAttribute("transform", "rotate(" + bearing.toFixed(2) + " 150 150)");
      $("qb-compass").setAttribute("aria-label", f("qibla.compassLabel", { deg: bearing.toFixed(0) }));
      $("qb-dist").textContent = SS.formatDistance(distanceKm(l.lat, l.lng), true);
      $("qb-coords").textContent = l.lat.toFixed(2) + ", " + l.lng.toFixed(2);
      $("qb-decl").textContent = Math.abs(d).toFixed(1) + "° " + t(d >= 0 ? "qibla.east" : "qibla.west");
      $("qb-mode-camera").disabled = false;
      if (compass.hasReading() && anim.shown !== null) drawCompass(anim.shown);
      else {
        drawStatic();
        $("qb-hint").textContent = "";
        desktopStep();
      }
      startSensors(false);
    });
  }

  function askLocation() {
    SS.geo.request().then(function (l) { if (!l) SS.toast(t("loc.denied")); load(); });
  }

  /* ── Camera mode ─────────────────────────────────────────────── */
  var HFOV = 62; // typical phone main camera, landscape; portrait uses less
  var PX = 7;    // heading strip: pixels per degree
  var tapeHalf = 25; // degrees visible either side of the strip's centre
  function camSupported() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) && window.isSecureContext !== false;
  }
  // wantCam: camera mode is (about to be) on screen. A stream that arrives
  // after the person has left is stopped at once, so the camera never stays
  // on in the background; one request at a time, so taps can't race.
  var wantCam = false, streamPending = null;
  function stopStream() {
    if (camStream) { camStream.getTracks().forEach(function (tr) { try { tr.stop(); } catch (e) { /* noop */ } }); }
    camStream = null;
    var v = $("qb-video");
    if (v) { try { v.srcObject = null; } catch (e) { /* noop */ } }
  }
  function getStream() {
    if (camStream && camStream.getVideoTracks().some(function (tr) { return tr.readyState === "live"; })) return Promise.resolve(camStream);
    if (streamPending) return streamPending;
    camStream = null;
    streamPending = navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } } })
      .then(function (s) {
        streamPending = null;
        if (!wantCam) { s.getTracks().forEach(function (tr) { tr.stop(); }); throw Object.assign(new Error("closed"), { name: "AbortError" }); }
        camStream = s;
        // The system can take the camera away (a call, another app): bring it back when we can.
        s.getVideoTracks().forEach(function (tr) {
          tr.addEventListener("ended", function () { if (camStream === s && camOpen && !document.hidden) resumeCamera(); });
        });
        return s;
      }, function (err) { streamPending = null; throw err; });
    return streamPending;
  }
  /** Show the live stream in the video element (a fresh srcObject + play, so it's never left black). */
  function attachStream() {
    var v = $("qb-video");
    if (v.srcObject !== camStream) v.srcObject = camStream;
    var p = v.play();
    if (p && p.catch) p.catch(function () { /* muted inline video normally plays; the start button covers the rest */ });
    $("qb-cam-start").hidden = true;
  }
  /** Coming back to camera mode (from another app or tab): restart the camera without a tap when allowed. */
  function resumeCamera() {
    if (!camOpen || !camSupported()) return;
    getStream().then(function () {
      if (!camOpen) return;
      attachStream();
      var last = compass.last();
      if (last) renderCamera(last); else $("qb-cam-msg").textContent = t("qibla.cameraHold");
    }).catch(function (err) {
      if (!camOpen || (err && err.name === "AbortError")) return;
      // Some browsers only allow the camera from a tap: ask for one (a real denial is explained after it).
      $("qb-cam-msg").textContent = t("qibla.cameraPaused");
      showStartButton();
    });
  }
  function showStartButton() {
    var b = $("qb-cam-start");
    b.hidden = false;
    b.onclick = function () {
      var motion = compass.needsPermission() ? compass.requestPermission() : Promise.resolve("granted");
      Promise.all([motion, getStream()]).then(function () {
        attachStream();
        startSensors(true);
        $("qb-cam-msg").textContent = t("qibla.cameraHold");
      }).catch(function (err) { $("qb-cam-msg").textContent = camError(err); });
    };
  }
  function camError(err) {
    var name = err && err.name;
    var key = name === "NotAllowedError" || name === "SecurityError" ? "qibla.cameraDenied"
      : name === "NotFoundError" || name === "OverconstrainedError" ? "qibla.cameraNone"
      : name === "NotReadableError" ? "qibla.cameraBusy" : "qibla.cameraError";
    return t(key);
  }
  /** Heading strip labels: every 10° from -60° to 420° so it can wrap round north. */
  function buildTape() {
    var html = "", d;
    var card = { 0: "qibla.n", 90: "qibla.e", 180: "qibla.s", 270: "qibla.w" };
    for (d = -60; d <= 420; d += 10) {
      var n = norm360(d), c = card[n];
      if (bearing !== null && Math.abs(angleDiff(n, bearing)) < 5) continue; // the Kaaba sits here
      html += '<span class="' + (c ? "cardinal" : "") + '" style="left:' + (d * PX) + 'px">' + (c ? SS.esc(t(c)) : n + "°") + "</span>";
    }
    if (bearing !== null) {
      for (var k = -1; k <= 1; k++) {
        d = bearing + k * 360;
        if (d >= -60 && d <= 420) html += '<span class="qb-tape-k" style="left:' + (d * PX).toFixed(1) + 'px"></span>';
      }
    }
    $("qb-tape-strip").innerHTML = html;
    measureTape();
  }
  function measureTape() {
    var w = $("qb-tape").clientWidth;
    if (w) tapeHalf = w / 2 / PX;
  }
  /** Ask for camera (+ iOS motion) inside the tap, then open the overlay. */
  function enterCamera() {
    if (bearing === null) { askLocation(); return; }
    if (!camSupported()) { SS.toast(t("qibla.cameraUnsupported")); return; }
    wantCam = true;
    var motion = compass.needsPermission() ? compass.requestPermission() : Promise.resolve("granted");
    var cam = getStream().then(function () { return null; }, function (err) { return err; });
    Promise.all([motion, cam]).then(function (res) {
      if (!wantCam) return; // left the Qibla page while the camera was starting
      if (res[1]) { wantCam = false; SS.toast(camError(res[1])); return; }
      camPushed = true;
      location.hash = "#/qibla/camera";
    });
  }
  function openCamera() {
    var el = $("qb-cam");
    if (camOpen) return;
    camOpen = true;
    wantCam = true;
    aligned = false;
    resetAnim();
    el.hidden = false;
    el.classList.remove("aligned");
    document.body.classList.add("qb-cam-open");
    $("qb-cam-msg").textContent = bearing === null ? t("qibla.needLocation") : t("qibla.cameraHold");
    $("qb-cam-sub").textContent = "";
    $("qb-cam-deg").textContent = bearing === null ? "" : Math.round(bearing) + "° " + pointName(bearing);
    $("qb-cam-marker").hidden = true;
    $("qb-cam-arrow").hidden = true;
    $("qb-cam-meter").hidden = true;
    $("qb-cam-done").hidden = true;
    $("qb-tape-l").hidden = $("qb-tape-r").hidden = true;
    buildTape();
    $("qb-cam-start").hidden = true;
    if (!camSupported()) $("qb-cam-msg").textContent = t("qibla.cameraUnsupported");
    else if (camStream) attachStream();
    else resumeCamera(); // opened from a link or reloaded: start straight away if allowed, else offer a button
    startSensors(!compass.needsPermission());
    var last = compass.last();
    if (last) renderCamera(last);
    setTimeout(function () { try { $("qb-cam-exit").focus(); } catch (e) { /* noop */ } }, 30);
  }
  function closeCamera() {
    if (!camOpen) return;
    camOpen = false;
    wantCam = false;
    aligned = false;
    resetAnim();
    stopStream();
    $("qb-cam").hidden = true;
    document.body.classList.remove("qb-cam-open");
    var last = compass.last();
    if (last && SS.currentView() === "qibla") renderCompass(last, true);
    try { $("qb-mode-camera").focus({ preventScroll: true }); } catch (e) { /* noop */ }
  }
  function exitCamera() {
    if (camPushed) { camPushed = false; history.back(); }
    else location.hash = "#/qibla";
  }
  function fov() {
    var portrait = window.innerHeight >= window.innerWidth;
    return { h: portrait ? HFOV * 0.62 : HFOV, v: portrait ? HFOV : HFOV * 0.62 };
  }
  function renderCamera(r) {
    if (!camOpen || bearing === null) return;
    var diff = angleDiff(r.camera, bearing);
    var raise = r.flat > 0.85; // lying flat: the camera sees the floor
    var on = raise ? (aligned = false) : updateLock(diff);
    $("qb-cam").classList.toggle("aligned", on);
    setText($("qb-cam-msg"), raise ? t("qibla.cameraRaise") : turnText(diff));
    setText($("qb-cam-sub"), on ? f("qibla.camSub", { deg: Math.round(bearing) + "° " + pointName(bearing), dist: SS.formatDistance(distanceKm(loc.lat, loc.lng), true) }) : "");
    var arrow = $("qb-cam-arrow");
    arrow.hidden = on || raise;
    arrow.className = "qb-cam-arrow " + (diff > 0 ? "right" : "left");
    $("qb-cam-meter").hidden = raise;
    setText($("qb-cam-meter-l"), on ? t("qibla.locked") : Math.abs(diff) <= 30 ? t("qibla.closer") : "");
    $("qb-cam-done").hidden = !on;
    // AR marker: shown when the Kaaba is inside the camera's view.
    $("qb-cam-marker").hidden = !(Math.abs(diff) < fov().h / 2 + 4);
    anim.pitchT = r.pitch;
    setTarget(r.camera);
  }
  function drawCamera(h) {
    var diff = angleDiff(h, bearing);
    var hn = norm360(h);
    $("qb-tape-strip").style.transform = "translateX(" + (-hn * PX).toFixed(1) + "px)";
    var off = Math.abs(diff) > tapeHalf - 2;
    $("qb-tape-l").hidden = !(off && diff < 0);
    $("qb-tape-r").hidden = !(off && diff > 0);
    var fv = fov(), W = window.innerWidth, H = window.innerHeight;
    var x = Math.max(-W / 2 + 36, Math.min(W / 2 - 36, (diff / (fv.h / 2)) * (W / 2)));
    var y = Math.max(-H * 0.32, Math.min(H * 0.26, (anim.pitch / (fv.v / 2)) * (H / 2))); // horizon moves down as you tilt up
    $("qb-cam-marker").style.transform = "translate(calc(-50% + " + x.toFixed(1) + "px), " + (y - 28).toFixed(1) + "px)";
    $("qb-cam-bar").style.transform = "scaleX(" + (aligned ? 1 : Math.max(0.04, 1 - Math.abs(diff) / 90)).toFixed(3) + ")";
  }

  function wire() {
    $("qb-loc-chip").onclick = askLocation;
    $("qb-locwarn-btn").onclick = askLocation;
    $("qb-enable").onclick = function () { startSensors(true); };
    // How-to and details stay folded on phones; wide screens have room to show them.
    if (window.matchMedia && matchMedia("(min-width: 1100px)").matches) $("qb-info").open = true;
    $("qb-mode-camera").onclick = function () { if (!camOpen) enterCamera(); };
    $("qb-cam-exit").onclick = exitCamera;
    $("qb-cam-done").onclick = exitCamera;
    window.addEventListener("resize", function () { if (camOpen) measureTape(); });
    document.addEventListener("keydown", function (e) {
      if (camOpen && e.key === "Escape") { e.preventDefault(); exitCamera(); }
    });
    // Leaving the app turns the camera off (privacy, battery); coming back turns it on again.
    document.addEventListener("visibilitychange", function () {
      if (!camOpen) return;
      if (document.hidden) stopStream();
      else resumeCamera();
    });
    window.addEventListener("pageshow", function (e) { if (e.persisted && camOpen) resumeCamera(); });
  }


  var wired = false;
  function qiblaInit(params) {
    if (!wired) { wire(); wired = true; }
    if (!camSupported()) $("qb-mode-camera").title = t("qibla.cameraUnsupported");
    var wantCamera = params && params[0] === "camera";
    if (!wantCamera && camOpen) closeCamera();
    if (!loc || !wantCamera) load();
    if (wantCamera) openCamera();
  }
  SS.views = SS.views || {};
  SS.views.qibla = qiblaInit;
  SS.leave = SS.leave || {};
  SS.leave.qibla = function () {
    closeCamera();
    wantCam = false;
    stopStream();
    camPushed = false;
    stopSensors();
    aligned = false;
  };
})(typeof window !== "undefined" ? window : globalThis);
