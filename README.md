# Bagel Sunrise Sets

Warm, lo-fi sunrise DJ sets in New York bagel shops. We bring the lights and the decks. The shop
brings a corner and keeps the ovens on. Every set starts before sunrise and plays through it.
Manhattan first, then Brooklyn, Queens, the Bronx and Staten Island.

Ships to **https://datarail.org/bagel/**.

The page is built the same way as [nypizza](https://github.com/fvtale/nypizza): one static page, a
JSON feed next to it, a generated fallback copy, checks in CI, and a publish job that copies into
`datarail-site`. It takes its look from the [DataRail Library](https://datarail.org/library/):
system type, hairlines, mono labels and rows that glow on hover. On top of that it adds a lo-fi
layer of scanlines, film grain, a colour split on the headline, a live NYC tape clock and a striped
sun on the horizon. The shared circuit rails are tinted dawn amber.

## What's in here

| Path | Purpose |
| --- | --- |
| `site/index.html` | The whole page: markup, styles and logic in one file. |
| `site/events.json` | The dates. The only file to edit to post or confirm a set. |
| `scripts/validate.mjs` | Checks `events.json`: shape, real dates, morning hours, and that each set is playing at sunrise. |
| `scripts/sync-seed.mjs` | Regenerates the page's fallback copy of `events.json`. `--check` fails if it is stale. |
| `.github/workflows/` | CI, and the publish job that copies `site/` into `datarail-site/public/bagel`. |

There's no build step and there are no dependencies. Node is only needed for the two scripts.

## Sections

1. **Hero:** the pitch, plus a tape-deck card showing the live New York time, the next set (or the
   next open slot), its sunrise time and a countdown. Under it, a striped sun rises over a flat
   skyline.
2. **Calendar:** a month grid and the upcoming list, filtered by borough. Dashed dates are
   **open slots**, mornings we want to fill. Open slots get a *Host this date* email button.
   Solid dates are **confirmed** and get *Add to calendar* (`.ics`) and a map link.
3. **Route:** the five boroughs in order. Click one to filter the calendar.
4. **For bagel shops:** what we bring, what the shop brings, the footprint spec, and a form that
   writes a pre-filled email. The form never sends anything itself.

## Posting a date

Add an object to `events` in `site/events.json` (its `_howto` block shows the shape), then run:

```bash
node scripts/sync-seed.mjs && node scripts/validate.mjs
```

Commit and push. CI checks it again and the publish job ships it.

- `status: "open"` is a morning we want to fill. It can't have a venue, address, lineup or RSVP link.
- `status: "confirmed"` means a shop said yes. It needs `venue` and `address`.

Times are New York wall clock. A set starts at 04:00 or later, ends by 12:00, and runs one to four
hours. `validate.mjs` works out sunrise for the date and refuses a set that isn't playing when the
sun comes up. The page and the validator use the same sunrise equation (a lower Manhattan
coordinate, good to a minute or two). If you change one, change the other.

Only mark a date confirmed once the shop has agreed. Leave `lineup` empty rather than guessing; the
page then says *Lineup TBA*.

## Local preview

Serve `site/` with any static server, e.g.:

```bash
npx serve site
```

`/assets/circuit.css` and `/assets/circuit.js` are root-relative and only resolve on datarail.org.
They're just the decorative rail layer, so locally the page falls back to its flat background.

## Deploy

This repository never touches the web server. `publish.yml` uses a write deploy key to copy `site/`
into `fvtale/datarail-site` at `public/bagel/`. That repository's own deploy workflow then ships it
to IONOS.

Publishing needs the repository variable `PUBLISH_TO_SITE=true` and the secret
`DATARAIL_SITE_DEPLOY_KEY` (the private half of a write deploy key on `fvtale/datarail-site`).
Without them, every push still validates but nothing ships.

## To confirm before launch

The footprint numbers on the page (≈ 6 × 4 ft, one outlet, ≈ 30 min setup, a 2–3 hour set, low
volume) are working figures for the rig. Correct them in `site/index.html` once the rig is final.
Corrections → contact@datarail.org
