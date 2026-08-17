# subch.us

Hub site for Travis Schaefer's projects, built with [Astro](https://astro.build). Deployed to GitHub Pages at [subch.us](https://subch.us).

## Structure

- `src/pages/` — hub homepage + one page per project category (RC, 3D printing, ESP32/Arduino, weather, data)
- `src/data/repos.json` — hand-maintained list of which repos belong to which category, plus separately-hosted projects and forks. Add a project here when you start it.
- `src/layouts/Base.astro` — shared nav/layout

## Local dev

```bash
npm install
npm run dev
```

## Adding a project

Edit `src/data/repos.json` and add an entry under the relevant category:

```json
{ "name": "My Project", "repo": "subch/my-project", "description": "What it does.", "status": "active" }
```

`status` is one of `active`, `planned`, or `archived` and controls how it's styled on the category page.

## The RC fleet

Vehicles on the RC page come from `src/data/rc-fleet.json`, separate from `repos.json`.
Each entry generates a card on `/rc/` and a full build-sheet page at `/rc/<slug>/`.

- `slug` — URL segment; also the photo folder name.
- `kind` — `car`, `plane`, `boat`, or `other`. Groups the cards on `/rc/`.
- `status` — `runner`, `project`, `shelf`, `parts`, or `retired`. Labels live in `statusLabels`.
- `photos` — array of `{ src, caption }`. Put images in `public/img/rc/<slug>/`; the
  first entry is the card thumbnail.
- `manufacturerUrl` — link to the manufacturer/product page for the identified model. This
  is the source of truth for stock specs — when it's wrong or missing, fix it here first,
  then correct any spec fields that were guessed from it.
- `upgrades` — array of `{ component, stock, upgraded, notes }`, for parts swapped from
  stock (e.g. `{ "component": "Power system", "stock": "Brushed motor/ESC", "upgraded": "All-in-one brushless system", "notes": "" }`).
  Separate from `mods`, which stays a freeform list (paint, wraps, cosmetic changes).

**Every spec field is optional.** Empty strings, `null`, and empty arrays render as a
muted *TBD* on the build sheet, and the card shows a "% spec'd" meter — so an entry with
nothing but a name and a photo still looks intentional. Fill in motor/ESC/battery details
as you get to them.

Copy the `example-buggy` entry as a template; `src/lib/fleet.js` defines which fields land
in which section of the build sheet.
