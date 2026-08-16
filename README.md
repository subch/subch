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
