#!/usr/bin/env node
/**
 * Builds the deck data behind /mtg.
 *
 * Sources, all free and authoritative:
 *   - MTGJSON  : official Commander precon decklists, with set code + collector
 *                number per card, and the commander broken out separately.
 *                This maps 1:1 onto XMage's .dck format.
 *   - Scryfall : oracle text, colour identity, and the `game_changer` flag that
 *                the official Commander Brackets rules are defined against.
 *   - XMage    : the ban list is parsed straight out of Commander.java so it
 *                tracks whatever the server actually enforces.
 *
 * Output (all static, served from GitHub Pages):
 *   public/mtg/data/decks/index.json  lightweight catalogue for the picker
 *   public/mtg/data/decks/<id>.json   full list, fetched only when a deck is opened
 *   public/mtg/banned.json        XMage's Commander ban list
 *   public/mtg/gamechangers.json  the 50-odd Game Changers, for bracket scoring
 *
 * Run: node scripts/build-mtg-decks.mjs
 */

import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'public', 'mtg');
const DECK_OUT = path.join(OUT, 'data', 'decks');
const CACHE = path.join(ROOT, '.cache', 'mtg');

const UA = {
  'User-Agent': 'subch.us-mtg-builder/1.0 (+https://subch.us/mtg)',
  Accept: 'application/json',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJSON(url, cacheKey, tries = 4) {
  const cacheFile = cacheKey ? path.join(CACHE, cacheKey) : null;
  if (cacheFile && existsSync(cacheFile)) {
    return JSON.parse(await readFile(cacheFile, 'utf8'));
  }

  let res;
  for (let attempt = 1; ; attempt++) {
    res = await fetch(url, { headers: UA });
    // Archidekt rate-limits in bursts. Back off and retry rather than dropping
    // the deck - losing them silently is how we ended up with 9 bracket-4s.
    if (res.status !== 429 || attempt >= tries) break;
    const retryAfter = Number(res.headers.get('retry-after'));
    const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
      ? retryAfter * 1000
      : 2000 * attempt ** 2;
    await sleep(waitMs);
  }
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  const json = await res.json();
  if (cacheFile) {
    await mkdir(path.dirname(cacheFile), { recursive: true });
    await writeFile(cacheFile, JSON.stringify(json));
  }
  return json;
}

/* ---------------------------------------------------------------- ban list */

async function fetchXMageBanList() {
  const url =
    'https://raw.githubusercontent.com/magefree/mage/master/Mage.Server.Plugins/Mage.Deck.Constructed/src/mage/deck/Commander.java';
  const res = await fetch(url, { headers: { 'User-Agent': UA['User-Agent'] } });
  if (!res.ok) throw new Error(`ban list fetch failed: ${res.status}`);
  const src = await res.text();
  const banned = [...src.matchAll(/banned\.add\("([^"]+)"\)/g)].map((m) => m[1]);
  const bannedCompanion = [...src.matchAll(/bannedCompanion\.add\("([^"]+)"\)/g)].map((m) => m[1]);
  if (banned.length < 20) throw new Error('ban list parse looks wrong - Commander.java shape changed');
  return { banned: banned.sort(), bannedCompanion };
}

/* ----------------------------------------------------------- game changers */

async function fetchGameChangers() {
  const names = [];
  let url = 'https://api.scryfall.com/cards/search?q=is%3Agamechanger&unique=cards&order=name';
  while (url) {
    const page = await getJSON(url, null);
    names.push(...page.data.map((c) => c.name));
    url = page.has_more ? page.next_page : null;
    if (url) await sleep(120);
  }
  return names.sort();
}

/* ------------------------------------------------------------- deck source */

async function fetchCommanderDecks() {
  const list = await getJSON('https://mtgjson.com/api/v5/DeckList.json', 'DeckList.json');
  let decks = list.data.filter((d) => d.type === 'Commander Deck');

  // "Collector's Edition" entries are the same 100 cards in fancy printings.
  // Keeping both would show every deck twice in the picker.
  decks = decks.filter((d) => !/CollectorSEdition/i.test(d.fileName));

  const out = [];
  const CONCURRENCY = 6;
  for (let i = 0; i < decks.length; i += CONCURRENCY) {
    const batch = decks.slice(i, i + CONCURRENCY);
    const got = await Promise.all(
      batch.map(async (meta) => {
        try {
          const d = await getJSON(
            `https://mtgjson.com/api/v5/decks/${meta.fileName}.json`,
            `decks/${meta.fileName}.json`
          );
          return { meta, data: d.data };
        } catch (err) {
          console.warn(`  ! skipped ${meta.fileName}: ${err.message}`);
          return null;
        }
      })
    );
    out.push(...got.filter(Boolean));
    process.stdout.write(`\r  decks fetched: ${out.length}/${decks.length}`);
    await sleep(80);
  }
  process.stdout.write('\n');
  return out;
}



// Precons and Archidekt decks arrive in different shapes; both are flattened to
// { meta, commanders, cards } so the rest of the pipeline sees one thing.
function normalisePrecon({ meta, data }) {
  const pick = (c) => ({
    name: c.name,
    faceName: c.faceName,
    layout: c.layout,
    setCode: c.setCode,
    number: c.number,
  });
  const commanders = (data.commander ?? []).map(pick);
  if (!commanders.length) return null;

  const cards = (data.mainBoard ?? []).map((c) => ({ ...pick(c), count: c.count }));
  const total = cards.reduce((n, c) => n + c.count, 0) + commanders.length;
  if (total !== 100) {
    console.warn(`  ! ${meta.name} (${meta.code}) has ${total} cards, not 100 - skipping`);
    return null;
  }

  return {
    meta: {
      source: 'precon',
      name: meta.name,
      code: meta.code,
      date: meta.releaseDate ?? '',
      views: 0,
      author: null,
      url: meta.source ?? null,
      declaredBracket: null,
    },
    commanders,
    cards,
  };
}

/* ------------------------------------------------------- archidekt source */

// Precons only ever reach bracket 3, so the strong end of the range has to come
// from real player decks. Archidekt exposes a public search API with view
// counts and dates, which is what "popular right now" needs.
//
// We keep the author's name and a link back on every deck - these are other
// people's lists and should be credited as such.
const ARCHIDEKT_API = 'https://archidekt.com/api';
const ARCHIDEKT_PAGES = 8;
const ARCHIDEKT_WANTED = 220;

async function fetchArchidektCandidates() {
  const seen = new Map();
  // Two orderings: what people look at most, and what has been touched
  // recently, so the set is not purely a hall of fame from 2021.
  for (const order of ['-viewCount', '-updatedAt']) {
    for (let page = 1; page <= ARCHIDEKT_PAGES; page++) {
      let body;
      try {
        body = await getJSON(
          `${ARCHIDEKT_API}/decks/v3/?formats=3&orderBy=${order}&size=100&page=${page}`,
          `archidekt/search-${order}-${page}.json`
        );
      } catch (err) {
        console.warn(`  ! archidekt search ${order} p${page}: ${err.message}`);
        break;
      }
      const rows = body.results ?? [];
      if (!rows.length) break;
      for (const r of rows) {
        // Only whole decks. A lot of public "decks" are 3-card commander
        // shortlists or work in progress.
        if (r.size !== 100 || r.private || r.unlisted) continue;
        if (!seen.has(r.id)) seen.set(r.id, r);
      }
      process.stdout.write(`\r  archidekt candidates: ${seen.size}`);
      await sleep(250);
      if (seen.size >= ARCHIDEKT_WANTED * 2) break;
    }
  }
  process.stdout.write('\n');
  return [...seen.values()]
    .sort((a, b) => (b.viewCount ?? 0) - (a.viewCount ?? 0))
    .slice(0, ARCHIDEKT_WANTED);
}

async function fetchArchidektDecks() {
  const candidates = await fetchArchidektCandidates();
  const out = [];
  for (const [i, meta] of candidates.entries()) {
    let raw;
    try {
      raw = await getJSON(`${ARCHIDEKT_API}/decks/${meta.id}/`, `archidekt/deck-${meta.id}.json`);
    } catch (err) {
      console.warn(`  ! archidekt deck ${meta.id}: ${err.message}`);
      continue;
    }
    const deck = normaliseArchidekt(raw);
    if (deck) out.push(deck);
    process.stdout.write(`\r  archidekt decks: ${out.length}/${i + 1}`);
    await sleep(650);
  }
  process.stdout.write('\n');
  return out;
}

function normaliseArchidekt(raw) {
  // A deck's own categories say which buckets actually count; Maybeboard and
  // friends come through with includedInDeck false.
  const excluded = new Set(
    (raw.categories ?? []).filter((c) => c.includedInDeck === false).map((c) => c.name)
  );

  const commanders = [];
  const cards = [];

  for (const entry of raw.cards ?? []) {
    const cats = entry.categories ?? [];
    if (cats.some((c) => excluded.has(c))) continue;

    const card = entry.card ?? {};
    const oracle = card.oracleCard ?? {};
    const name = oracle.name;
    if (!name) continue;

    const rec = {
      name,
      setCode: (card.edition?.editioncode ?? '').toUpperCase() || null,
      number: card.collectorNumber ?? null,
      count: entry.quantity ?? 1,
    };
    if (cats.includes('Commander')) commanders.push({ ...rec, count: undefined });
    else cards.push(rec);
  }

  if (!commanders.length || commanders.length > 2) return null;
  const total = cards.reduce((n, c) => n + c.count, 0) + commanders.length;
  if (total !== 100) return null;

  return {
    meta: {
      source: 'archidekt',
      name: raw.name?.trim() || `Deck ${raw.id}`,
      code: 'ARCH',
      date: (raw.updatedAt ?? raw.createdAt ?? '').slice(0, 10),
      views: raw.viewCount ?? 0,
      author: raw.owner?.username ?? null,
      url: `https://archidekt.com/decks/${raw.id}`,
      declaredBracket: raw.edhBracket ?? null,
    },
    commanders,
    cards,
  };
}

/* ------------------------------------------------------------ card oracle  */

// XMage resolves a card by name when it cannot match the exact printing, so
// name accuracy is what matters. We pull oracle data per unique name to drive
// theme tagging and bracket scoring.
async function fetchOracle(names) {
  const unique = [...new Set(names)];
  const map = new Map();
  const BATCH = 75;
  for (let i = 0; i < unique.length; i += BATCH) {
    const chunk = unique.slice(i, i + BATCH);
    const cacheFile = path.join(CACHE, 'oracle', `${i}-${chunk.length}.json`);
    let body;
    if (existsSync(cacheFile)) {
      body = JSON.parse(await readFile(cacheFile, 'utf8'));
    } else {
      const res = await fetch('https://api.scryfall.com/cards/collection', {
        method: 'POST',
        headers: { ...UA, 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifiers: chunk.map((n) => ({ name: n })) }),
      });
      if (!res.ok) throw new Error(`scryfall collection ${res.status}`);
      body = await res.json();
      await mkdir(path.dirname(cacheFile), { recursive: true });
      await writeFile(cacheFile, JSON.stringify(body));
      await sleep(120);
    }
    for (const c of body.data ?? []) {
      const faces = c.card_faces ?? [c];
      const info = {
        name: c.name,
        layout: c.layout ?? 'normal',
        frontFace: c.card_faces?.[0]?.name ?? c.name,
        type_line: c.type_line ?? faces.map((f) => f.type_line).join(' // '),
        oracle: faces.map((f) => f.oracle_text ?? '').join(' \n '),
        ci: c.color_identity ?? [],
        gc: c.game_changer === true,
        cmc: c.cmc ?? 0,
      };
      // Register under the combined name and every face name, so a later
      // lookup hits whichever form is in hand.
      for (const alias of new Set([c.name, ...(c.card_faces ?? []).map((f) => f.name)])) {
        if (alias) map.set(alias, info);
      }
    }
    process.stdout.write(`\r  oracle: ${map.size}/${unique.length}`);
  }
  process.stdout.write('\n');
  return map;
}

/* ----------------------------------------------------------------- themes  */

// These match "this card CARES about X", not "this card mentions X". The
// difference matters: every Commander deck contains mana rocks, so a rule like
// /artifact/ tags all 174 decks as an artifact deck and the filter becomes
// noise. Payoff and enabler wording only.
const THEME_RULES = [
  ['tokens', /(create[s]? [^.]*?\btoken|whenever [^.]*token [^.]*enters|tokens you control get)/i],
  ['counters', /\+1\/\+1 counter/i],
  ['graveyard', /(return [^.]*?from your graveyard to the battlefield|whenever [^.]*enters[^.]*from (a|your) graveyard|from your graveyard: |cards? in your graveyard)/i],
  ['sacrifice', /(sacrifice (a|another) (creature|permanent|artifact)|whenever [^.]*you control dies|whenever another creature you control dies)/i],
  ['artifacts', /(artifacts? you control|whenever [^.]*artifact enters|whenever you cast an artifact|metalcraft|affinity for artifacts|artifact creature you control)/i],
  ['enchantments', /(enchantments? you control|whenever you cast an enchantment|constellation|whenever an enchantment enters)/i],
  ['spellslinger', /(whenever you cast an instant or sorcery|magecraft|prowess|instant and sorcery cards? in your graveyard|copy target (instant|sorcery))/i],
  ['lifegain', /(whenever you gain life|if you would gain life|whenever a creature you control with lifelink)/i],
  ['landfall', /(landfall|whenever a land (you control )?enters|whenever a land enters the battlefield under your control)/i],
  ['equipment', /(equipped creature|equip \{|whenever [^.]*becomes equipped|attach)/i],
  ['auras', /(enchanted creature|whenever you cast an aura|aura you control)/i],
  ['blink', /(exile [^.]*?then return (it|them|that card) to the battlefield|exile [^.]*?return (it|them) to the battlefield under (your|its owner's) control)/i],
  ['mill', /(mills? \w+ cards?|whenever [^.]*mills)/i],
  ['politics', /(goad|the monarch|becomes the monarch|will of the council|council's dilemma|vote)/i],
  ['grouphug', /each player draws/i],
  ['treasure', /(treasure token|whenever you sacrifice a treasure)/i],
  ['ramp', /(search your library for (a|up to \w+) basic land|search your library for a land card)/i],
  ['aggro', /(whenever [^.]*?you control attacks|attacks? each combat if able|can't be blocked|must be blocked)/i],
  ['flying', /(creatures? you control with flying|whenever [^.]*with flying (attacks|deals))/i],
  ['bigcreatures', /(power 4 or greater|power 5 or greater|trample|whenever [^.]*with power \d+)/i],
];

const TRIBE_SKIP = new Set(['Creature', 'Legendary', 'Artifact', 'Enchantment', 'Token', 'Snow']);
const EM_DASH = '—';

// Pass 1: raw counts per deck. Thresholding happens later, once we can see
// how each theme is distributed across the whole set of decks.
function themeScores(cards, oracle) {
  const scores = Object.create(null);
  const tribes = Object.create(null);
  const tribeRefs = Object.create(null);
  let bodies = 0;

  for (const entry of cards) {
    const info = oracle.get(entry.name);
    if (!info) continue;
    const text = `${info.type_line}\n${info.oracle}`;
    for (const [tag, re] of THEME_RULES) {
      if (re.test(text)) scores[tag] = (scores[tag] ?? 0) + entry.count;
    }
    if (/Creature/.test(info.type_line)) {
      bodies += entry.count;
      const sub = info.type_line.split(EM_DASH)[1];
      if (sub) {
        for (const t of sub.trim().split(/\s+/)) {
          if (!TRIBE_SKIP.has(t) && /^[A-Z][a-z]+$/.test(t)) {
            tribes[t] = (tribes[t] ?? 0) + entry.count;
          }
        }
      }
    }
    // A real tribal deck has cards that name the tribe in their rules text
    // ("other Elves you control get +1/+1"), not just a pile of the same type.
    for (const m of info.oracle.matchAll(/\b([A-Z][a-z]{2,})s?\b(?= (?:you control|creatures?|spells?))/g)) {
      const t = m[1];
      if (!TRIBE_SKIP.has(t)) tribeRefs[t] = (tribeRefs[t] ?? 0) + entry.count;
    }
  }
  return { scores, tribes, tribeRefs, bodies };
}

function quantile(sorted, q) {
  if (!sorted.length) return 0;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

// Pass 2: a theme sticks to a deck only if that deck is meaningfully above the
// corpus for it. This is what stops "every deck runs mana rocks" from becoming
// "every deck is an artifact deck".
function assignThemes(records) {
  const cutoffs = new Map();
  for (const [tag] of THEME_RULES) {
    const values = records.map((r) => r.scores[tag] ?? 0).sort((a, b) => a - b);
    const p70 = quantile(values, 0.7);
    const max = values[values.length - 1] ?? 0;
    // Absolute floor of 6 cards so a tiny corpus cannot promote noise, and a
    // theme present in nearly every deck gets a high bar automatically.
    cutoffs.set(tag, Math.max(6, p70, max * 0.45));
  }

  for (const rec of records) {
    const hits = [];
    for (const [tag] of THEME_RULES) {
      const score = rec.scores[tag] ?? 0;
      const cut = cutoffs.get(tag);
      if (score >= cut) hits.push([tag, score / cut]);
    }
    hits.sort((a, b) => b[1] - a[1]);
    const themes = hits.slice(0, 4).map(([t]) => t);

    // Rather than loosen the cutoffs for everyone, give a deck that cleared no
    // bar its single strongest leaning, so it is still findable by theme.
    if (!themes.length) {
      const best = Object.entries(rec.scores)
        .filter(([, n]) => n >= 8)
        .sort((a, b) => b[1] / cutoffs.get(b[0]) - a[1] / cutoffs.get(a[0]))[0];
      if (best) themes.push(best[0]);
    }

    const topTribe = Object.entries(rec.tribes).sort((a, b) => b[1] - a[1])[0];
    if (
      topTribe &&
      topTribe[1] >= Math.max(10, rec.bodies * 0.4) &&
      (rec.tribeRefs[topTribe[0]] ?? 0) >= 2
    ) {
      themes.unshift(`tribal:${topTribe[0]}`);
    }
    rec.themes = themes.slice(0, 5);
  }
}

/* ------------------------------------------------------------ card naming */

// XMage registers cards under specific names, verified against its set files:
//   split      -> "Fire // Ice"          (full name kept)
//   adventure  -> "Brazen Borrower"      (front face only)
//   transform  -> "Delver of Secrets"    (front face only)
// Handing the importer a back-face name gets an explicit "you can't use night
// card in deck" error, so everything but split collapses to the front face.
// MTGJSON hands us layout and faceName directly, so no guessing is needed.
// MTGJSON hands us layout and faceName outright. Archidekt does not, so for
// those we fall back to Scryfall's layout, resolved during the oracle pass.
function xmageName(c, oracle) {
  if (c.faceName) return c.layout === 'split' ? c.name : c.faceName;
  if (!c.name.includes(' // ')) return c.name;
  const info = oracle?.get(lookupName(c));
  if (info?.layout === 'split') return c.name;
  return info?.frontFace ?? c.name.split(' // ')[0];
}

// Scryfall's collection endpoint matches on the FACE name and returns
// not_found for the combined "A // B" form, so every lookup uses the face.
const lookupName = (c) =>
  c.faceName ?? (c.name.includes(' // ') ? c.name.split(' // ')[0] : c.name);

/* ---------------------------------------------------------------- brackets */

// Straight from the official bracket definitions. We can measure Game
// Changers, mass land denial and extra turns; we cannot measure a player's
// intent, so bracket 5 (cEDH) is never assigned automatically.
const MASS_LAND_DENIAL = [
  'Armageddon', 'Ravages of War', 'Catastrophe', 'Jokulhaups', 'Obliterate',
  'Decree of Annihilation', 'Winter Orb', 'Static Orb', 'Stasis',
  'Blood Moon', 'Back to Basics', 'Boil', 'Impending Disaster',
  'Wildfire', 'Burning of Xinye', 'Cataclysm', 'Global Ruin', 'Land Equilibrium',
];
const EXTRA_TURNS = /take an extra turn|takes an extra turn|extra turn after this one/i;

function estimateBracket(cards, oracle, gameChangerSet) {
  const gcs = [];
  let mld = 0;
  let extraTurns = 0;

  for (const entry of cards) {
    // Game Changers and the MLD list are keyed on plain card names; check both
    // the combined and face forms so split/DFC cards are not missed.
    const names = [entry.name, entry.faceName].filter(Boolean);
    const hit = names.find((n) => gameChangerSet.has(n));
    if (hit) gcs.push(hit);
    if (names.some((n) => MASS_LAND_DENIAL.includes(n))) mld += entry.count;
    const info = oracle.get(lookupName(entry));
    if (info && EXTRA_TURNS.test(info.oracle)) extraTurns += entry.count;
  }

  let bracket;
  if (mld > 0) bracket = 4; // MLD is barred below bracket 4
  else if (gcs.length === 0 && extraTurns <= 1) bracket = 2;
  else if (gcs.length <= 3) bracket = 3;
  else bracket = 4;

  return { bracket, gameChangers: gcs.sort(), massLandDenial: mld, extraTurns };
}

/* -------------------------------------------------------------------- main */

const slug = (s) =>
  s
    .toLowerCase()
    .replace(/[‘’']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

async function main() {
  await mkdir(DECK_OUT, { recursive: true });
  await mkdir(CACHE, { recursive: true });

  console.log('Fetching XMage ban list...');
  const bans = await fetchXMageBanList();
  console.log(`  ${bans.banned.length} banned cards`);

  console.log('Fetching Game Changers...');
  const gameChangers = await fetchGameChangers();
  const gcSet = new Set(gameChangers);
  console.log(`  ${gameChangers.length} game changers`);

  console.log('Fetching Commander precons from MTGJSON...');
  const precons = (await fetchCommanderDecks()).map(normalisePrecon).filter(Boolean);
  console.log(`  ${precons.length} precons`);

  console.log('Fetching popular decks from Archidekt...');
  const community = await fetchArchidektDecks();
  console.log(`  ${community.length} community decks`);

  const decks = [...precons, ...community];

  const allNames = [];
  for (const d of decks) {
    for (const c of [...d.commanders, ...d.cards]) allNames.push(lookupName(c));
  }
  console.log(`Fetching oracle data for ${new Set(allNames).size} unique cards...`);
  const oracle = await fetchOracle(allNames);

  const index = [];
  const seenIds = new Set();

  for (const { meta, commanders, cards } of decks) {
    if (!commanders.length) continue;

    let id = slug(`${meta.name}-${meta.code}`);
    while (seenIds.has(id)) id += '-x';
    seenIds.add(id);

    const ci = [...new Set(commanders.flatMap((c) => oracle.get(lookupName(c))?.ci ?? []))];
    const order = { W: 0, U: 1, B: 2, R: 3, G: 4 };
    ci.sort((a, b) => order[a] - order[b]);

    const all = [...cards, ...commanders.map((c) => ({ ...c, count: 1 }))];
    const { bracket: estimated, ...bracketInfo } = estimateBracket(all, oracle, gcSet);

    // Brackets are meant to be self-declared, so an author's own label wins
    // where there is one. Undeclared decks fall back to what the contents say.
    const declared = [2, 3, 4, 5].includes(meta.declaredBracket) ? meta.declaredBracket : null;
    const bracket = declared ?? estimated;

    const bannedHere = [...cards, ...commanders]
      .map((c) => xmageName(c, oracle))
      .filter((n) => bans.banned.includes(n));

    // Scoring uses Scryfall's full names so oracle lookups hit; only the
    // written file gets the XMage-facing name.
    const forXMage = (c) => ({
      name: xmageName(c, oracle),
      setCode: c.setCode,
      number: c.number,
      ...(c.count === undefined ? {} : { count: c.count }),
    });

    await writeFile(
      path.join(DECK_OUT, `${id}.json`),
      JSON.stringify({
        id,
        name: meta.name,
        setCode: meta.code,
        source: meta.source,
        author: meta.author,
        url: meta.url,
        commanders: commanders.map(forXMage),
        cards: cards.map(forXMage),
      })
    );

    index.push({
      id,
      name: meta.name,
      setCode: meta.code,
      source: meta.source,
      author: meta.author,
      url: meta.url,
      views: meta.views ?? 0,
      date: meta.date ?? '',
      commanders: commanders.map((c) => xmageName(c, oracle)),
      colorIdentity: ci,
      themes: [],
      ...themeScores(all, oracle),
      bracket,
      estimatedBracket: estimated,
      bracketSource: declared ? 'declared' : 'estimated',
      ...bracketInfo,
      bannedInXMage: bannedHere,
    });
  }

  // Themes are relative to the corpus, so they can only be settled once every
  // deck has been scored.
  assignThemes(index);
  for (const rec of index) {
    // Top creature types by card count, so the site can rank decks by tribe
    // rather than relying on the much stricter tribal:X tag.
    rec.tribeCounts = Object.fromEntries(
      Object.entries(rec.tribes)
        .filter(([, n]) => n >= 3)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
    );
    delete rec.scores;
    delete rec.tribes;
    delete rec.tribeRefs;
    delete rec.bodies;
  }

  index.sort((a, b) => (b.views ?? 0) - (a.views ?? 0) || (b.date ?? '').localeCompare(a.date ?? ''));

  await writeFile(
    path.join(DECK_OUT, 'index.json'),
    JSON.stringify({ generated: new Date().toISOString(), count: index.length, decks: index })
  );
  await writeFile(path.join(OUT, 'banned.json'), JSON.stringify(bans));
  await writeFile(path.join(OUT, 'gamechangers.json'), JSON.stringify({ gameChangers }));

  const tally = (key) =>
    index.reduce((acc, d) => ((acc[d[key]] = (acc[d[key]] ?? 0) + 1), acc), {});
  console.log('');
  console.log(`Wrote ${index.length} decks to public/mtg/data/decks/`);
  console.log('  by bracket:', tally('bracket'));
  console.log('  by source :', tally('source'));
  console.log('  bracket from:', tally('bracketSource'));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
