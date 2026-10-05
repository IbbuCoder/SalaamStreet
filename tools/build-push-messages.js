#!/usr/bin/env node
/* SalaamStreet — copies what the reminder server needs from the app:
 *   · the reminder texts in every interface language → messages.json
 *   · the prayer-time calculator (js/praytimes.js)    → praytimes.js
 * into backend/functions/send-reminders/, so notifications read exactly like
 * the app and use the same times. Run after changing either:
 *   node tools/build-push-messages.js */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "backend/functions/send-reminders");
const KEYS = ["prayer.Fajr", "prayer.Dhuhr", "prayer.Asr", "prayer.Maghrib", "prayer.Isha", "rem.now", "rem.soon",
  "friday.title", "friday.notify", "daily.adhkarRem_morning", "daily.adhkarRem_evening", "daily.adhkarRemBody", "daily.iPrayed"];

const box = { console };
box.window = box;
vm.createContext(box);
vm.runInContext(fs.readFileSync(path.join(ROOT, "js/i18n.js"), "utf8"), box);
const out = {};
const pick = (get) => Object.fromEntries(KEYS.map((k) => [k, get(k)]).filter(([k, v]) => v && v !== k));
out.en = pick((k) => box.SS.i18n.t(k));
const src = fs.readFileSync(path.join(ROOT, "js/i18n.js"), "utf8");
const arBlock = src.slice(src.indexOf("\n    ar: {"));
out.ar = pick((k) => { const m = arBlock.match(new RegExp('"' + k.replace(/\./g, "\\.") + '": ("(?:[^"\\\\]|\\\\.)*")')); return m ? JSON.parse(m[1]) : null; });
for (const code of ["ur", "bn", "id", "tr", "fr"]) {
  let dict = {};
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, "js/lang", code + ".js"), "utf8"), { SS: { i18n: { register: (c, d) => { dict = d; } } } });
  out[code] = pick((k) => dict[k]);
}
fs.writeFileSync(path.join(OUT, "messages.json"), JSON.stringify(out, null, 1) + "\n");
fs.copyFileSync(path.join(ROOT, "js/praytimes.js"), path.join(OUT, "praytimes.js"));
console.log("wrote messages.json (" + Object.keys(out).join(", ") + ") and praytimes.js");
