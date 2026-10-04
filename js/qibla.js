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
      smooth.top = lowpass(smooth.top, top, 0.25);
      smooth.camera = lowpass(smooth.camera, cam, 0.25);
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
  var bearing = null, dialAngle = 0, noSensorTimer = null, loc = null, loadGen = 0;
  var camStream = null, camOpen = false, camPushed = false, lastAligned = false;

  function fmtDeg(d) { return (Math.round(d * 10) / 10).toFixed(1); }
  function turnText(diff) {
    var n = Math.round(Math.abs(diff));
    if (n <= 5) return t("qibla.aligned");
    return f(diff > 0 ? "qibla.turnRight" : "qibla.turnLeft", { n: n });
  }

  /** Compass-mode heading: top of the screen when flat-ish, else where the camera faces. */
  function facing(r) { return r.flat >= 0.5 ? r.top : r.camera; }

  function renderCompass(r) {
    if (SS.currentView() !== "qibla") return;
    var heading = facing(r);
    var target = -heading;
    dialAngle += angleDiff(dialAngle, target);
    $("qb-dial").style.transform = "rotate(" + dialAngle + "deg)";
    if (bearing === null) return;
    var diff = angleDiff(heading, bearing);
    var aligned = Math.abs(diff) <= 5;
    $("qibla-card").classList.toggle("aligned", aligned);
    $("qb-aligned").hidden = !aligned;
    $("qb-turn").hidden = aligned;
    $("qb-turn").textContent = aligned ? "" : turnText(diff);
    if (aligned && !lastAligned) SS.ui.vibrate(25);
    lastAligned = aligned;
    if (r.accuracy !== null && (r.accuracy < 0 || r.accuracy > 25)) $("qb-hint").textContent = t("qibla.lowAccuracy");
    else if (!camOpen) $("qb-hint").textContent = t("qibla.calibrate");
  }

  function startSensors(fromTap) {
    if (!compass.supported() || window.isSecureContext === false) { $("qb-hint").textContent = t("qibla.noCompass"); return Promise.resolve(false); }
    if (compass.needsPermission() && !fromTap) { $("qb-enable").hidden = false; return Promise.resolve(false); }
    var p = compass.needsPermission() ? compass.requestPermission() : Promise.resolve("granted");
    return p.then(function (res) {
      if (res !== "granted") { $("qb-enable").hidden = false; $("qb-hint").textContent = t("qibla.motionDenied"); return false; }
      $("qb-enable").hidden = true;
      compass.on(renderCompass);
      compass.on(renderCamera);
      compass.start();
      clearTimeout(noSensorTimer);
      noSensorTimer = setTimeout(function () {
        if (!compass.hasReading()) {
          $("qb-hint").textContent = t("qibla.noCompass");
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
      if (l.isFallback) {
        // No real location: show no direction rather than a made-up one.
        bearing = null;
        $("qb-deg").textContent = "—";
        $("qb-needle").hidden = true;
        $("qb-dist").textContent = "—";
        $("qb-coords").textContent = "—";
        $("qb-decl").textContent = "—";
        $("qb-turn").hidden = true;
        $("qb-aligned").hidden = true;
        $("qibla-card").classList.remove("aligned");
        $("qb-compass").setAttribute("aria-label", t("qibla.needLocation"));
        $("qb-mode-camera").disabled = true;
        $("qb-hint").textContent = "";
        if (camOpen) closeCamera();
        return;
      }
      bearing = SS.qiblaBearing(l.lat, l.lng);
      var d = compass.setLocation(l.lat, l.lng);
      $("qb-deg").textContent = fmtDeg(bearing);
      $("qb-needle").hidden = false;
      $("qb-needle").style.transform = "rotate(" + bearing + "deg)";
      $("qb-compass").setAttribute("aria-label", f("qibla.compassLabel", { deg: bearing.toFixed(0) }));
      $("qb-dist").textContent = SS.formatDistance(distanceKm(l.lat, l.lng), true);
      $("qb-coords").textContent = l.lat.toFixed(2) + ", " + l.lng.toFixed(2);
      $("qb-decl").textContent = Math.abs(d).toFixed(1) + "° " + t(d >= 0 ? "qibla.east" : "qibla.west");
      $("qb-mode-camera").disabled = false;
      if (!compass.hasReading()) {
        $("qb-dial").style.transform = "rotate(0deg)"; dialAngle = 0;
        $("qb-hint").textContent = t("qibla.northUp");
      }
      startSensors(false);
    });
  }

  function askLocation() {
    SS.geo.request().then(function (l) { if (!l) SS.toast(t("loc.denied")); load(); });
  }

  /* ── Camera mode ─────────────────────────────────────────────── */
  var HFOV = 62; // typical phone main camera, landscape; portrait uses less
  function camSupported() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) && window.isSecureContext !== false;
  }
  function stopStream() {
    if (camStream) { camStream.getTracks().forEach(function (tr) { try { tr.stop(); } catch (e) { /* noop */ } }); }
    camStream = null;
    var v = $("qb-video");
    if (v) { try { v.srcObject = null; } catch (e) { /* noop */ } }
  }
  function getStream() {
    if (camStream) return Promise.resolve(camStream);
    return navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } } })
      .then(function (s) { camStream = s; return s; });
  }
  function camError(err) {
    var name = err && err.name;
    var key = name === "NotAllowedError" || name === "SecurityError" ? "qibla.cameraDenied"
      : name === "NotFoundError" || name === "OverconstrainedError" ? "qibla.cameraNone"
      : name === "NotReadableError" ? "qibla.cameraBusy" : "qibla.cameraError";
    return t(key);
  }
  /** Ask for camera (+ iOS motion) inside the tap, then open the overlay. */
  function enterCamera() {
    if (bearing === null) { askLocation(); return; }
    if (!camSupported()) { SS.toast(t("qibla.cameraUnsupported")); return; }
    var motion = compass.needsPermission() ? compass.requestPermission() : Promise.resolve("granted");
    var cam = getStream().then(function () { return null; }, function (err) { return err; });
    Promise.all([motion, cam]).then(function (res) {
      if (res[1]) { SS.toast(camError(res[1])); return; }
      camPushed = true;
      location.hash = "#/qibla/camera";
    });
  }
  function openCamera() {
    var el = $("qb-cam");
    if (camOpen) return;
    camOpen = true;
    el.hidden = false;
    document.body.classList.add("qb-cam-open");
    $("qb-mode-camera").setAttribute("aria-pressed", "true");
    $("qb-mode-compass").setAttribute("aria-pressed", "false");
    $("qb-cam-msg").textContent = bearing === null ? t("qibla.needLocation") : t("qibla.cameraHold");
    $("qb-cam-deg").textContent = bearing === null ? "" : fmtDeg(bearing) + "°";
    $("qb-cam-marker").hidden = true;
    $("qb-cam-arrow").hidden = true;
    var startBtn = $("qb-cam-start");
    startBtn.hidden = true;
    function attach() {
      var v = $("qb-video");
      v.srcObject = camStream;
      var p = v.play();
      if (p && p.catch) p.catch(function () { /* autoplay blocked; muted inline video normally plays */ });
    }
    if (!camSupported()) {
      $("qb-cam-msg").textContent = t("qibla.cameraUnsupported");
    } else if (camStream) {
      attach();
    } else {
      // Opened from a link or after the tab was hidden: needs a tap to start.
      startBtn.hidden = false;
      startBtn.onclick = function () {
        var motion = compass.needsPermission() ? compass.requestPermission() : Promise.resolve("granted");
        Promise.all([motion, getStream()]).then(function () {
          startBtn.hidden = true;
          attach();
          startSensors(true);
          $("qb-cam-msg").textContent = t("qibla.cameraHold");
        }).catch(function (err) { $("qb-cam-msg").textContent = camError(err); });
      };
    }
    startSensors(!compass.needsPermission());
    var last = compass.last();
    if (last) renderCamera(last);
    setTimeout(function () { try { $("qb-cam-exit").focus(); } catch (e) { /* noop */ } }, 30);
  }
  function closeCamera() {
    if (!camOpen) return;
    camOpen = false;
    stopStream();
    $("qb-cam").hidden = true;
    document.body.classList.remove("qb-cam-open");
    $("qb-mode-camera").setAttribute("aria-pressed", "false");
    $("qb-mode-compass").setAttribute("aria-pressed", "true");
    try { $("qb-mode-camera").focus({ preventScroll: true }); } catch (e) { /* noop */ }
  }
  function exitCamera() {
    if (camPushed) { camPushed = false; history.back(); }
    else location.hash = "#/qibla";
  }
  function renderCamera(r) {
    if (!camOpen || bearing === null) return;
    var diff = angleDiff(r.camera, bearing);
    var aligned = Math.abs(diff) <= 5;
    var arrow = $("qb-cam-arrow");
    arrow.hidden = false;
    arrow.style.transform = "rotate(" + diff + "deg)";
    arrow.classList.toggle("on", aligned);
    $("qb-cam-msg").textContent = r.flat > 0.85 ? t("qibla.cameraRaise") : turnText(diff);
    $("qb-cam").classList.toggle("aligned", aligned);
    if (aligned && !lastAligned) SS.ui.vibrate(25);
    lastAligned = aligned;
    // AR marker: place the Kaaba on screen when it's inside the camera's view.
    var portrait = window.innerHeight >= window.innerWidth;
    var hfov = portrait ? HFOV * 0.62 : HFOV, vfov = portrait ? HFOV : HFOV * 0.62;
    var m = $("qb-cam-marker");
    if (Math.abs(diff) < hfov / 2 + 4) {
      var x = 50 + (diff / (hfov / 2)) * 50;
      var y = 50 + (r.pitch / (vfov / 2)) * 50; // horizon moves down as you tilt up
      m.hidden = false;
      m.style.left = Math.max(4, Math.min(96, x)) + "%";
      m.style.top = Math.max(12, Math.min(80, y)) + "%";
    } else {
      m.hidden = true;
    }
  }

  function wire() {
    $("qb-loc-chip").onclick = askLocation;
    $("qb-locwarn-btn").onclick = askLocation;
    $("qb-enable").onclick = function () { startSensors(true); };
    $("qb-mode-compass").onclick = function () { if (camOpen) exitCamera(); };
    $("qb-mode-camera").onclick = function () { if (!camOpen) enterCamera(); };
    $("qb-cam-exit").onclick = exitCamera;
    document.addEventListener("keydown", function (e) {
      if (camOpen && e.key === "Escape") { e.preventDefault(); exitCamera(); }
    });
    document.addEventListener("visibilitychange", function () {
      if (document.hidden && camOpen) { stopStream(); $("qb-cam-start").hidden = false; }
      if (!document.hidden && camOpen && !camStream) openCameraResume();
    });
  }
  function openCameraResume() {
    $("qb-cam-msg").textContent = t("qibla.cameraPaused");
    $("qb-cam-start").hidden = false;
    $("qb-cam-start").onclick = function () {
      getStream().then(function () {
        $("qb-cam-start").hidden = true;
        $("qb-video").srcObject = camStream;
        var p = $("qb-video").play(); if (p && p.catch) p.catch(function () {});
      }).catch(function (err) { $("qb-cam-msg").textContent = camError(err); });
    };
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
    camPushed = false;
    stopSensors();
    lastAligned = false;
  };
})(typeof window !== "undefined" ? window : globalThis);
