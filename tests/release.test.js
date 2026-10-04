/* Release checks: things that are easy to forget when shipping a version.
   Run: node --test tests/release.test.js */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

// content.js and i18n.js are browser scripts; give them just enough of a window.
const sandbox = { console };
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(read("js/content.js"), sandbox);
vm.runInContext(read("js/i18n.js"), sandbox);
const SS = sandbox.SS;

test("version is the same in package.json, the app and the newest release notes", () => {
  const pkg = JSON.parse(read("package.json"));
  assert.equal(SS.VERSION, pkg.version);
  assert.equal(SS.CHANGELOG[0].v, pkg.version);
  assert.ok(SS.CHANGELOG[0].items.length > 0, "release notes list what changed");
  for (const item of SS.CHANGELOG[0].items) assert.ok(item.en && item.ar, "every note has English and Arabic: " + JSON.stringify(item));
});

test("light and dark manifests differ only in colour, and match the page backgrounds", () => {
  const light = JSON.parse(read("manifest.webmanifest"));
  const dark = JSON.parse(read("manifest-dark.webmanifest"));
  const css = read("css/styles.css");
  const bg = (sel) => css.match(new RegExp(sel + "\\s*\\{[^}]*?--bg:(#[0-9a-f]{6})"))[1];
  assert.equal(light.background_color, bg(":root"));
  assert.equal(light.theme_color, bg(":root"));
  assert.equal(dark.background_color, bg('html\\[data-theme="dark"\\]'));
  assert.equal(dark.theme_color, bg('html\\[data-theme="dark"\\]'));
  const strip = (m) => Object.assign({}, m, { background_color: "", theme_color: "" });
  assert.deepEqual(strip(dark), strip(light));
  assert.equal(light.id, "./", "a fixed id keeps installed apps the same app whichever manifest they read");
});

test("every file the offline cache lists exists", () => {
  const shell = read("sw.js").match(/var SHELL = \[([\s\S]*?)\];/)[1].match(/"([^"]+)"/g).map((s) => s.slice(1, -1));
  for (const f of shell) {
    if (f === "./") continue;
    assert.ok(fs.existsSync(path.join(ROOT, f)), "sw.js caches a missing file: " + f);
  }
});

test("every data-i18n key in the page has English text", () => {
  const keys = new Set([...read("index.html").matchAll(/data-i18n="([^"]+)"/g)].map((m) => m[1]));
  const missing = [...keys].filter((k) => SS.i18n.t(k) === k);
  assert.deepEqual(missing, []);
});
