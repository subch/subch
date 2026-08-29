/**
 * XMage .dck format: build, parse, and validate.
 *
 * Format, confirmed against XMage's own DckDeckImporter/AbstractCommander:
 *
 *   NAME:My Deck
 *   1 [LCI:123] Sol Ring          <- main deck
 *   SB: 1 [WOC:2] Ellivere        <- the COMMANDER goes in the sideboard
 *
 * Two rules that trip people up:
 *   1. XMage reads commanders from the sideboard, not from a marker on the
 *      card line. AbstractCommander does `deck.getSideboard()`.
 *   2. maindeck + sideboard must total exactly 100 (101 with a companion),
 *      so it is 99 main + 1 commander, never 100 main + 1.
 *
 * The importer falls back to matching by NAME when it cannot find the exact
 * [SET:number] printing, so set codes are a nicety - the card name is what
 * has to be right.
 */

const BASICS = new Set([
  'Plains', 'Island', 'Swamp', 'Mountain', 'Forest', 'Wastes',
  'Snow-Covered Plains', 'Snow-Covered Island', 'Snow-Covered Swamp',
  'Snow-Covered Mountain', 'Snow-Covered Forest', 'Snow-Covered Wastes',
]);

export const isBasicLand = (name) => BASICS.has(name);

/* ------------------------------------------------------------------ build */

export function toDck({ name, commanders = [], cards = [] }) {
  const lines = [];
  if (name) lines.push(`NAME:${name}`);
  for (const c of cards) {
    lines.push(`${c.count} ${ref(c)}${c.name}`);
  }
  for (const c of commanders) {
    lines.push(`SB: 1 ${ref(c)}${c.name}`);
  }
  // CRLF: the file is nearly always opened on Windows.
  return lines.join('\r\n') + '\r\n';
}

function ref(c) {
  return c.setCode && c.number ? `[${c.setCode}:${c.number}] ` : '';
}

export function downloadDck(deck, filename) {
  const blob = new Blob([toDck(deck)], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `${slug(deck.name || 'deck')}.dck`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const slug = (s) =>
  String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'deck';

/* ------------------------------------------------------------------ parse */

// Handles the shapes people actually paste:
//   1 Sol Ring
//   1x Sol Ring
//   1 Sol Ring (LCI) 123
//   1 Sol Ring (lci) 123 *CMDR*                 <- Moxfield
//   1x Sol Ring (lci) 123 [Commander{top}]      <- Archidekt
//   1 [LCI:123] Sol Ring                        <- already .dck
const SECTION_RE = /^(?:\/\/\s*)?(commanders?|companion|deck|mainboard|main|sideboard|maybeboard|tokens?)\b[\s:()0-9]*$/i;
const DCK_RE = /^(SB:)?\s*(\d+)\s*\[([^\]:]+):([^\]]+)\]\s*(.+)$/;
const LINE_RE = /^(\d+)\s*[xX]?\s+(.+)$/;

export function parseDecklist(text) {
  const entries = [];
  const problems = [];
  let section = 'main';

  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    if (/^(NAME|AUTHOR|LAYOUT)\s*:/i.test(line)) continue;

    const sec = line.match(SECTION_RE);
    if (sec) {
      const s = sec[1].toLowerCase();
      section = s.startsWith('commander') ? 'commander'
        : s === 'companion' ? 'companion'
        : s.startsWith('side') || s.startsWith('maybe') || s.startsWith('token') ? 'skip'
        : 'main';
      continue;
    }
    if (/^\/\//.test(line)) continue;

    let count, name, setCode = null, number = null, zone = section;

    const dck = line.match(DCK_RE);
    if (dck) {
      // An existing .dck: SB: means commander, per XMage's own convention.
      if (dck[1]) zone = 'commander';
      count = parseInt(dck[2], 10);
      setCode = dck[3].trim();
      number = dck[4].trim();
      name = dck[5].trim();
    } else {
      const m = line.match(LINE_RE);
      if (!m) {
        problems.push(`Could not read line: "${line}"`);
        continue;
      }
      count = parseInt(m[1], 10);
      let rest = m[2].trim();

      // Trailing markers from Moxfield / Archidekt / TappedOut.
      if (/\*CMDR\*|\[Commander|\*Commander\*|!Commander/i.test(rest)) zone = 'commander';
      if (/\[Companion|\*Companion\*/i.test(rest)) zone = 'companion';
      rest = rest.replace(/\s*[\[(]\s*(Commander|Companion)[^\])]*[\])]\s*/gi, ' ');
      rest = rest.replace(/\s*\*[A-Za-z]+\*\s*/g, ' ').trim();

      // "(SET) 123" printing hint
      const printing = rest.match(/^(.*?)\s*\(([A-Za-z0-9]{2,6})\)\s*([A-Za-z0-9\-★]+)?\s*$/);
      if (printing) {
        name = printing[1].trim();
        setCode = printing[2].toUpperCase();
        number = printing[3] ? printing[3].trim() : null;
      } else {
        name = rest.trim();
      }
    }

    if (zone === 'skip') continue;
    name = normaliseName(name);
    if (!name) continue;
    entries.push({ count, name, setCode, number, zone });
  }

  return { entries, problems };
}

// Whitespace only. The "A // B" form is deliberately preserved here: Scryfall
// resolves it, and which half XMage wants depends on the card's layout, which
// we only know after the lookup. See xmageName().
export function normaliseName(name) {
  return String(name).replace(/\s+/g, ' ').trim();
}

// Verified against XMage's own set files:
//   split     -> "Fire // Ice"       (full name)
//   adventure -> "Brazen Borrower"   (front face)
//   transform -> "Delver of Secrets" (front face)
export function xmageName(card) {
  if (card.layout === 'split') return card.name;
  return card.card_faces?.[0]?.name ?? card.name;
}

/* --------------------------------------------------------------- resolve  */

const SCRYFALL = 'https://api.scryfall.com/cards/collection';

/**
 * Look up every distinct name on Scryfall to get a real printing, colour
 * identity and the game_changer flag. Returns a Map of name -> card, plus the
 * names Scryfall did not recognise.
 */
export async function resolveCards(names, onProgress) {
  const unique = [...new Set(names)];
  const found = new Map();
  const notFound = [];

  for (let i = 0; i < unique.length; i += 75) {
    const chunk = unique.slice(i, i + 75);
    const res = await fetch(SCRYFALL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifiers: chunk.map((n) => ({ name: n })) }),
    });
    if (!res.ok) throw new Error(`Scryfall returned ${res.status}`);
    const body = await res.json();

    for (const c of body.data ?? []) {
      const face = c.card_faces?.[0];
      const entry = {
        name: xmageName(c),
        setCode: (c.set ?? '').toUpperCase(),
        number: c.collector_number,
        colorIdentity: c.color_identity ?? [],
        typeLine: c.type_line ?? face?.type_line ?? '',
        gameChanger: c.game_changer === true,
        legal: c.legalities?.commander ?? 'not_legal',
        image: c.image_uris?.small ?? face?.image_uris?.small ?? null,
        scryfallUri: c.scryfall_uri,
      };
      // Register under every name the card is known by - what the user typed,
      // the full "A // B" form, and the XMage form - so later lookups hit
      // whichever one is in hand.
      for (const alias of new Set([c.name, entry.name, ...(c.card_faces ?? []).map((f) => f.name)])) {
        if (alias) found.set(normaliseName(alias).toLowerCase(), entry);
      }
    }
    for (const nf of body.not_found ?? []) notFound.push(nf.name);
    onProgress?.(Math.min(i + 75, unique.length), unique.length);
  }

  return { found, notFound };
}

/* -------------------------------------------------------------- validate  */

/**
 * Checks the things XMage will reject the deck for, plus the bracket signals.
 * Returns { errors, warnings, info } - errors mean XMage will refuse the deck.
 */
export function validateCommanderDeck({ commanders, cards, resolved, banned = [], gameChangers = [] }) {
  const errors = [];
  const warnings = [];
  const bannedSet = new Set(banned);
  const gcSet = new Set(gameChangers);

  const mainCount = cards.reduce((n, c) => n + c.count, 0);
  const total = mainCount + commanders.reduce((n, c) => n + c.count, 0);

  if (!commanders.length) {
    errors.push('No commander identified. Mark one with a "Commander" section or pick one below.');
  } else if (commanders.length > 2) {
    errors.push(`${commanders.length} commanders found. XMage allows one, or two with Partner.`);
  }

  if (total !== 100) {
    errors.push(
      `Deck is ${total} cards, must be exactly 100 (99 + commander). ` +
      (total > 100 ? `Remove ${total - 100}.` : `Add ${100 - total}.`)
    );
  }

  // Colour identity, the single most common reason XMage rejects a deck.
  const ci = new Set();
  for (const c of commanders) {
    const r = resolved.get(c.name.toLowerCase());
    for (const col of r?.colorIdentity ?? []) ci.add(col);
  }
  if (commanders.length) {
    for (const c of cards) {
      const r = resolved.get(c.name.toLowerCase());
      if (!r) continue;
      const bad = (r.colorIdentity ?? []).filter((col) => !ci.has(col));
      if (bad.length) {
        errors.push(`${c.name} is outside your commander's colour identity (${bad.join('')}).`);
      }
    }
  }

  // Singleton, basics exempt.
  for (const c of [...cards, ...commanders]) {
    if (c.count > 1 && !isBasicLand(c.name)) {
      errors.push(`${c.name} appears ${c.count} times. Commander is singleton.`);
    }
  }

  // XMage's own ban list, which is stricter than paper in places.
  for (const c of [...cards, ...commanders]) {
    if (bannedSet.has(c.name)) errors.push(`${c.name} is banned on this XMage server.`);
  }

  for (const c of [...cards, ...commanders]) {
    const r = resolved.get(c.name.toLowerCase());
    if (r && r.legal !== 'legal' && r.legal !== 'restricted' && !bannedSet.has(c.name)) {
      warnings.push(`${c.name} is not Commander-legal on Scryfall (${r.legal}).`);
    }
  }

  const foundGc = [...cards, ...commanders].filter((c) => gcSet.has(c.name)).map((c) => c.name);
  const bracket = foundGc.length === 0 ? 2 : foundGc.length <= 3 ? 3 : 4;

  return {
    errors,
    warnings,
    total,
    colorIdentity: [...ci],
    gameChangers: foundGc,
    bracket,
  };
}
