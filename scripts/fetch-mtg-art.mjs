#!/usr/bin/env node
/**
 * Pulls one piece of art per tribe for the /mtg landing page.
 *
 * The images are downloaded rather than hot-linked: Scryfall asks that you not
 * lean on their image CDN for page furniture, and five local files load faster
 * and cannot break when a printing changes.
 *
 * Artist credit is written alongside so the page can attribute properly.
 *
 * Run: node scripts/fetch-mtg-art.mjs
 */

import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const OUT = path.resolve(import.meta.dirname, '..', 'public', 'mtg', 'img');

const UA = {
  'User-Agent': 'subch.us-mtg-builder/1.0 (+https://subch.us/mtg)',
  Accept: 'application/json',
};

// One recognisable lord/leader per tribe, in that tribe's colour.
const TRIBES = [
  { key: 'elf',     color: 'G', tribe: 'Elf',     card: 'Elvish Archdruid' },
  { key: 'goblin',  color: 'R', tribe: 'Goblin',  card: 'Krenko, Mob Boss' },
  { key: 'merfolk', color: 'U', tribe: 'Merfolk', card: 'Lord of Atlantis' },
  { key: 'angel',   color: 'W', tribe: 'Angel',   card: 'Serra Angel' },
  { key: 'vampire', color: 'B', tribe: 'Vampire', card: 'Bloodline Keeper' },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  await mkdir(OUT, { recursive: true });
  const credits = [];

  for (const t of TRIBES) {
    const url = `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(t.card)}`;
    const res = await fetch(url, { headers: UA });
    if (!res.ok) throw new Error(`${t.card}: Scryfall ${res.status}`);
    const card = await res.json();

    const face = card.card_faces?.[0];
    const art = card.image_uris?.art_crop ?? face?.image_uris?.art_crop;
    if (!art) throw new Error(`${t.card}: no art_crop available`);

    const img = await fetch(art, { headers: { 'User-Agent': UA['User-Agent'] } });
    if (!img.ok) throw new Error(`${t.card}: image ${img.status}`);
    const buf = Buffer.from(await img.arrayBuffer());
    await writeFile(path.join(OUT, `${t.key}.jpg`), buf);

    credits.push({
      key: t.key,
      color: t.color,
      tribe: t.tribe,
      card: card.name,
      artist: card.artist ?? 'Unknown',
      scryfall: card.scryfall_uri,
    });
    console.log(`  ${t.key.padEnd(8)} ${card.name} - ${card.artist} (${(buf.length / 1024).toFixed(0)} KB)`);
    await sleep(120);
  }

  await writeFile(path.join(OUT, 'credits.json'), JSON.stringify({ credits }, null, 2) + '\n');
  console.log(`\nWrote ${credits.length} images + credits.json to public/mtg/img/`);
}

main().catch((e) => { console.error(e); process.exit(1); });
