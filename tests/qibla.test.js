/* Qibla maths: bearing to the Kaaba, magnetic declination (WMM2025), and
   device-orientation → heading. Run: node --test tests/qibla.test.js */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

// core.js is a browser script; give it just enough of a window.
const sandbox = { localStorage: { getItem: () => null, setItem() {}, removeItem() {}, key: () => null, length: 0 }, console };
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, "../js/core.js"), "utf8"), sandbox);
const SS = sandbox.SS;
global.SS = { KAABA: SS.KAABA };
const Q = require("../js/qibla.js");

const near = (a, b, tol, msg) => assert.ok(Math.abs(Q.angleDiff(a, b)) <= tol, `${msg}: ${a.toFixed(2)} vs ${b} (±${tol})`);

test("great-circle bearing to the Kaaba matches published Qibla directions", () => {
  // Reference values (true north) from standard Qibla tables / NOAA great-circle calculators.
  near(SS.qiblaBearing(40.7128, -74.006), 58.48, 0.1, "New York");
  near(SS.qiblaBearing(51.5074, -0.1278), 118.99, 0.1, "London");
  near(SS.qiblaBearing(-6.2088, 106.8456), 295.15, 0.1, "Jakarta");
  near(SS.qiblaBearing(41.8781, -87.6298), 48.6, 0.3, "Chicago");
  near(SS.qiblaBearing(24.8607, 67.0011), 267.6, 0.5, "Karachi");
  near(SS.qiblaBearing(-33.8688, 151.2093), 277.5, 0.5, "Sydney");
  near(SS.qiblaBearing(30.0444, 31.2357), 136.1, 0.5, "Cairo");
});

test("distance to Makkah", () => {
  const km = Q.distanceKm(51.5074, -0.1278);
  assert.ok(Math.abs(km - 4790) < 25, "London ≈ 4,790 km, got " + km.toFixed(0));
});

test("magnetic declination (WMM2025) — sign and size at known places", () => {
  // Seattle has strong east declination, the US Gulf/Great Lakes slight west,
  // London ~1°E in 2026, eastern Australia ~12-13°E.
  const seattle = Q.declination(47.61, -122.33, 2026.75);
  const chicago = Q.declination(41.88, -87.63, 2026.75);
  const london = Q.declination(51.51, -0.13, 2026.75);
  const sydney = Q.declination(-33.87, 151.21, 2026.75);
  assert.ok(seattle > 14 && seattle < 16, "Seattle " + seattle);
  assert.ok(chicago < -3 && chicago > -5.5, "Chicago " + chicago);
  assert.ok(london > 0.5 && london < 2, "London " + london);
  assert.ok(sydney > 12 && sydney < 14, "Sydney " + sydney);
  // Dates outside the model window are clamped, not extrapolated wildly.
  assert.equal(Q.declination(47.61, -122.33, 2040), Q.declination(47.61, -122.33, 2030));
});

test("phone flat, portrait: heading of the top edge is 360 - alpha", () => {
  for (const a of [0, 30, 90, 200, 359]) {
    const h = Q.orientationHeadings(a, 0, 0, 0);
    near(h.top, (360 - a) % 360, 1e-6, "alpha " + a);
    assert.ok(h.flat > 0.999);
  }
});

test("tilting the phone doesn't change where its top edge points", () => {
  near(Q.orientationHeadings(300, 40, 25, 0).top, 60, 1e-6, "tilted");
});

test("landscape: screen rotation is accounted for", () => {
  // Rotated 90° counter-clockwise: the top of the SCREEN is the device's right edge.
  near(Q.orientationHeadings(0, 0, 0, 90).top, 90, 1e-6, "landscape-primary");
  near(Q.orientationHeadings(0, 0, 0, 270).top, 270, 1e-6, "landscape-secondary");
});

test("phone upright: the camera looks the way the top edge would point if laid flat", () => {
  const h = Q.orientationHeadings(330, 90, 0, 0);
  near(h.camera, 30, 1e-6, "upright camera");
  assert.ok(h.flat < 0.01);
  assert.ok(Math.abs(h.pitch) < 1e-6, "camera level with the horizon");
  // Tilted back 30° from upright: camera aims 30° above the horizon, same heading.
  const up = Q.orientationHeadings(330, 120, 0, 0);
  near(up.camera, 30, 1e-6, "tilted upright camera");
  assert.ok(Math.abs(up.pitch - 30) < 1e-6, "pitch " + up.pitch);
});

test("turn guidance takes the short way round", () => {
  assert.equal(Q.angleDiff(350, 10), 20);
  assert.equal(Q.angleDiff(10, 350), -20);
  assert.equal(Q.angleDiff(0, 180), 180);
});
