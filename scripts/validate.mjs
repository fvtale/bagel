// Checks site/events.json. A wrong time on this page gets a DJ and a crew of
// lights to a bagel shop at 5am for nothing, so the rules are strict.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const file = fileURLToPath(new URL("../site/events.json", import.meta.url));
const errors = [];
const fail = (where, msg) => errors.push(`${where}: ${msg}`);

let data;
try {
  data = JSON.parse(readFileSync(file, "utf8"));
} catch (e) {
  console.error(`events.json does not parse: ${e.message}`);
  process.exit(1);
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const BOROUGHS = ["manhattan", "brooklyn", "queens", "bronx", "staten-island"];
const FIELDS = ["id", "status", "title", "date", "time", "endTime", "borough", "area", "venue", "address", "lineup", "note", "rsvpUrl"];

// A morning set: no earlier than 4am, done by noon, one to four hours long.
const EARLIEST = 4 * 60;
const LATEST = 12 * 60;

// Sunrise over Manhattan, as New York wall-clock minutes. The same sunrise
// equation the page runs (keep the two in step); good to a minute or two,
// which is all a set that starts well before dawn needs.
const LAT = 40.7128, LON = -74.0060;
function sunriseMinutes(y, m, d) {
  const r = Math.PI / 180;
  const n = Date.UTC(y, m - 1, d, 12) / 864e5 + 2440587.5 - 2451545;
  const J = n - LON / 360;
  const M = (357.5291 + 0.98560028 * J) % 360;
  const C = 1.9148 * Math.sin(M * r) + 0.02 * Math.sin(2 * M * r) + 0.0003 * Math.sin(3 * M * r);
  const L = (M + C + 180 + 102.9372) % 360;
  const transit = 2451545 + J + 0.0053 * Math.sin(M * r) - 0.0069 * Math.sin(2 * L * r);
  const dec = Math.asin(Math.sin(L * r) * Math.sin(23.4397 * r));
  const w = Math.acos((Math.sin(-0.833 * r) - Math.sin(LAT * r) * Math.sin(dec)) / (Math.cos(LAT * r) * Math.cos(dec)));
  const t = (transit - w / (2 * Math.PI) - 2440587.5) * 864e5;
  const p = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "numeric", hourCycle: "h23" }).formatToParts(new Date(t));
  const g = k => +p.find(x => x.type === k).value;
  return g("hour") * 60 + g("minute");
}

if (data.updatedAt != null && !DATE.test(data.updatedAt)) fail("updatedAt", "must be YYYY-MM-DD");
if (!Array.isArray(data.events)) fail("events", "must be an array");

const seen = new Set();
for (const [i, ev] of (data.events || []).entries()) {
  const at = `events[${i}]${ev && ev.id ? ` (${ev.id})` : ""}`;
  for (const k of ["id", "status", "date", "time", "endTime", "borough"]) {
    if (typeof ev[k] !== "string" || !ev[k].trim()) fail(at, `missing ${k}`);
  }
  for (const k of Object.keys(ev)) if (!FIELDS.includes(k)) fail(at, `unknown field '${k}'`);

  if (ev.id && !ID.test(ev.id)) fail(at, "id must be a lowercase slug");
  if (seen.has(ev.id)) fail(at, "duplicate id");
  seen.add(ev.id);

  if (ev.borough && !BOROUGHS.includes(ev.borough)) fail(at, `borough must be one of ${BOROUGHS.join(", ")}`);

  if (ev.status === "confirmed") {
    for (const k of ["venue", "address"]) {
      if (typeof ev[k] !== "string" || !ev[k].trim()) fail(at, `a confirmed set needs ${k}`);
    }
  } else if (ev.status === "open") {
    // An open slot has no shop yet, so nothing that implies one.
    for (const k of ["venue", "address", "lineup", "rsvpUrl"]) {
      if (ev[k] != null) fail(at, `an open slot cannot have ${k}; confirm it first`);
    }
  } else if (ev.status) {
    fail(at, "status must be 'open' or 'confirmed'");
  }

  for (const k of ["title", "area", "venue", "address", "note"]) {
    if (ev[k] != null && (typeof ev[k] !== "string" || !ev[k].trim())) fail(at, `${k} must be text`);
  }
  if (ev.lineup != null && (!Array.isArray(ev.lineup) || ev.lineup.some(n => typeof n !== "string" || !n.trim()))) {
    fail(at, "lineup must be an array of names");
  }
  if (ev.rsvpUrl != null && !/^https:\/\//.test(ev.rsvpUrl)) fail(at, "rsvpUrl must be https or null");

  if (!DATE.test(ev.date || "")) { fail(at, "date must be YYYY-MM-DD"); continue; }
  const [y, m, d] = ev.date.split("-").map(Number);
  const real = new Date(Date.UTC(y, m - 1, d));
  if (real.getUTCMonth() !== m - 1 || real.getUTCDate() !== d) { fail(at, `${ev.date} is not a real date`); continue; }

  if (!TIME.test(ev.time || "")) { fail(at, "time must be HH:MM, 24-hour"); continue; }
  if (!TIME.test(ev.endTime || "")) { fail(at, "endTime must be HH:MM, 24-hour"); continue; }

  const toMin = t => { const [h, mi] = t.split(":").map(Number); return h * 60 + mi; };
  const start = toMin(ev.time);
  const end = toMin(ev.endTime);
  if (start < EARLIEST) fail(at, `starts at ${ev.time}; a sunrise set starts at 04:00 or later`);
  if (end > LATEST) fail(at, `ends at ${ev.endTime}; a sunrise set is done by 12:00`);
  if (end <= start) { fail(at, "endTime must be after time, the same morning"); continue; }
  if (end - start < 60 || end - start > 4 * 60) fail(at, "a set runs between one and four hours");

  const sun = sunriseMinutes(y, m, d);
  const sunText = `${Math.floor(sun / 60)}:${String(sun % 60).padStart(2, "0")}`;
  if (sun < start || sun >= end) fail(at, `sunrise on ${ev.date} is ${sunText}, outside ${ev.time}–${ev.endTime}`);
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
const open = data.events.filter(e => e.status === "open").length;
console.log(`events.json ok: ${data.events.length} date(s), ${data.events.length - open} confirmed, ${open} open`);
