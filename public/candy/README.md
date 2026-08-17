# Wyatt & Heidi's Candy Adventure — public demo

A candy-collecting browser game built for a four-year-old. This is the
**public demo build**: no server, no accounts, nothing about my family in it.
Progress is stored in the visitor's own browser.

## Deploying to GitHub Pages

Drop this whole folder into the repo that serves your site, commit, push.

```bash
# from the root of your subch.us repo
cp -r candy .          # or: git mv the folder in
git add candy
git commit -m "Add Candy Adventure demo"
git push
```

It'll be live at **`https://subch.us/candy/`** within a minute or so.

The folder name is up to you — everything inside uses relative paths, so
`candy/`, `games/candy/`, whatever works. If Pages serves your site from
`/docs` instead of the repo root, put the folder inside `docs/`.

Nothing to build, no dependencies, no server. Six files.

## Linking it from your landing page

```html
<a href="/candy/">🍬 Wyatt &amp; Heidi's Candy Adventure</a>
```

`share-card.html` in this folder is a ready-made card you can paste into
your landing page instead, if you'd like something with a bit more presence.

## What's in the demo

- Drag anywhere on screen to move (arrow keys / WASD on a laptop).
- 3600 × 2700 blocky candy world across four regions, split by a chocolate
  river. Collect candy and coins; they respawn as you go.
- **Heidi** trots along behind you and grabs treats she runs over.
- **Creepers** waddle over, light a fuse, and pop — costing 3 candy and 2
  coins, which get flung a few hundred pixels away for you to go collect
  again. Nothing can kill you; there is no fail state anywhere.
- **Shop** with 5 heroes, 9 hats and 8 shirt colors.
- Three **hidden notes** placed around the world, to show off the feature
  where parents hide messages and presents for their kids.

Two links on the title screen: **Unlock everything (demo)** so visitors can
see the whole cast without grinding 3,000 coins, and **Start over**.

`?creepers=0` on the URL turns the creepers off.

## What is deliberately *not* in this build

The private family version, which runs in Docker at home, adds:

- Per-player logins with 4-digit codes and server-side saves
- Parent accounts (Mom and Dad) that can walk into the world and hide real
  notes and presents for the kids to find

None of that is here. There are no API calls, no player list, and the three
notes are hardcoded placeholder text.

## Technical notes

- One self-contained `index.html`. All art is drawn in canvas code — no
  sprite sheets, no image assets, no web fonts, no libraries. Works offline
  once loaded.
- Terrain, props, treats and creepers render on a voxel grid; the characters
  are drawn smooth.
- Sound is generated with the Web Audio API, so there are no audio files.
  It stays silent until the first tap, per browser autoplay rules.
- Progress is a single `localStorage` key (`candy-adventure-demo-v2`), and
  the game degrades gracefully to a no-save session if storage is blocked.
- On iOS, Safari → Share → **Add to Home Screen** launches it fullscreen
  with its own icon.

## Files

```
index.html                the whole game
manifest.webmanifest      makes Add to Home Screen behave
icon-180.png              apple-touch-icon
icon-192.png icon-512.png PWA / favicon
share-card.html           optional promo card for your landing page
```
