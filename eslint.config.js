/* ESLint (flat config). The app is classic browser scripts (no modules);
   tests and tools run in Node. Vendored code is not linted. */
"use strict";
const browser = {
  window: "readonly", document: "readonly", navigator: "readonly", location: "readonly", history: "readonly",
  localStorage: "readonly", sessionStorage: "readonly", screen: "readonly", console: "readonly",
  setTimeout: "readonly", clearTimeout: "readonly", setInterval: "readonly", clearInterval: "readonly",
  requestAnimationFrame: "readonly", fetch: "readonly", AbortController: "readonly", URL: "readonly",
  URLSearchParams: "readonly", Blob: "readonly", Event: "readonly", CustomEvent: "readonly", Audio: "readonly",
  MediaMetadata: "readonly", IntersectionObserver: "readonly", DeviceOrientationEvent: "readonly",
  Notification: "readonly", matchMedia: "readonly", getComputedStyle: "readonly", confirm: "readonly",
  alert: "readonly", self: "readonly", caches: "readonly", Image: "readonly", globalThis: "readonly",
  module: "writable", Promise: "readonly", Intl: "readonly", performance: "readonly", SS: "writable",
  speechSynthesis: "readonly", SpeechSynthesisUtterance: "readonly", File: "readonly",
  indexedDB: "readonly", IDBKeyRange: "readonly", IDBObjectStore: "readonly", Response: "readonly", Cache: "readonly", DOMException: "readonly",
};
const node = { Request: "readonly", require: "readonly", module: "writable", process: "readonly", __dirname: "readonly", Buffer: "readonly", console: "readonly", setTimeout: "readonly", URL: "readonly", globalThis: "readonly" };
module.exports = [
  { ignores: ["node_modules/**", "js/vendor/**", "surah/**", "prayer-times/**", "duas/**", "names-of-allah/**", "about/**"] },
  {
    files: ["js/**/*.js", "sw.js"],
    languageOptions: { ecmaVersion: 2017, sourceType: "script", globals: browser },
    rules: { "no-undef": "error", "no-unused-vars": ["warn", { args: "none", caughtErrors: "none" }], "no-redeclare": "error", "no-dupe-keys": "error", "no-unreachable": "error" },
  },
  {
    // Edge Function code shared with the tests (ES modules, run by Deno and Node).
    files: ["backend/functions/**/*.js"],
    languageOptions: { ecmaVersion: 2022, sourceType: "module", globals: Object.assign({}, browser, {
      crypto: "readonly", TextEncoder: "readonly", Request: "readonly" }) },
    rules: { "no-undef": "error", "no-unused-vars": ["warn", { args: "none", caughtErrors: "none" }], "no-dupe-keys": "error", "no-unreachable": "error" },
  },
  {
    files: ["tests/**/*.js", "tools/**/*.js", "eslint.config.js"],
    languageOptions: { ecmaVersion: 2022, sourceType: "commonjs", globals: Object.assign({}, node, browser) },
    rules: { "no-undef": "error", "no-unused-vars": ["warn", { args: "none", caughtErrors: "none" }], "no-dupe-keys": "error" },
  },
];
