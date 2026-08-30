/**
 * Deck detail and editor.
 *
 * Loads a precon, enriches it with Scryfall data (types, mana cost, art),
 * lets you cut and add cards, validates continuously against what XMage will
 * actually refuse, and exports a .dck.
 *
 * Edits live in localStorage keyed by deck id, so a reload does not lose work.
 * The original list is never mutated - "Reset" simply drops the saved copy.
 */

import { $, $$, esc, loadDeck, loadRefs, initCopy, pipsHtml, COLOR_NAMES } from './common.js';
import {
  resolveCards, validateCommanderDeck, toDck, downloadDck, slug, isBasicLand, xmageName,
} from './dck.js';

const app = $('#deck-app');
const params = new URLSearchParams(location.search);
const DECK_ID = params.get('id');

let ORIGINAL = null;   // as shipped
let deck = null;       // working copy: { name, commanders[], cards[] }
let ORACLE = new Map();
let REFS = { banned: [], gameChangers: [] };

const storageKey = (id) => `mtg:deck:${id}`;

/* ------------------------------------------------------------- card typing */

// Order matters: a card is filed under the first bucket it matches, so
// "Artifact Creature" lands in Creatures and "Legendary Land" in Lands.
const BUCKETS = [
  ['Creatures', /Creature/],
  ['Planeswalkers', /Planeswalker/],
  ['Instants', /Instant/],
  ['Sorceries', /Sorcery/],
  ['Artifacts', /Artifact/],
  ['Enchantments', /Enchantment/],
  ['Battles', /Battle/],
  ['Lands', /Land/],
];

function bucketOf(name) {
  const t = ORACLE.get(name.toLowerCase())?.typeLine ?? '';
  for (const [label, re] of BUCKETS) if (re.test(t)) return label;
  return 'Other';
}

const manaHtml = (cost) =>
  !cost ? '' : esc(cost).replace(/\{([^}]+)\}/g, (_, s) => `<span class="mana">${esc(s)}</span>`);

/* ------------------------------------------------------------------ state  */

function save() {
  try { localStorage.setItem(storageKey(DECK_ID), JSON.stringify(deck)); } catch { /* private mode */ }
  markEdited();
}
function clearSaved() {
  try { localStorage.removeItem(storageKey(DECK_ID)); } catch { /* ignore */ }
}
function loadSaved() {
  try {
    const raw = localStorage.getItem(storageKey(DECK_ID));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
const isEdited = () => JSON.stringify(deck) !== JSON.stringify(ORIGINAL);

function markEdited() {
  const el = $('#edited-flag');
  if (el) el.hidden = !isEdited();
}

/* ------------------------------------------------------------------ oracle */

async function enrich(names) {
  const missing = names.filter((n) => !ORACLE.has(n.toLowerCase()));
  if (!missing.length) return;
  const { found } = await resolveCards(missing);
  for (const [k, v] of found) ORACLE.set(k, v);
}

/* ------------------------------------------------------------------ render */

function render() {
  const total = deck.cards.reduce((n, c) => n + c.count, 0) + deck.commanders.length;
  const v = validateCommanderDeck({
    commanders: deck.commanders, cards: deck.cards, resolved: ORACLE,
    banned: REFS.banned, gameChangers: REFS.gameChangers,
  });

  const groups = new Map();
  for (const c of deck.cards) {
    const b = bucketOf(c.name);
    if (!groups.has(b)) groups.set(b, []);
    groups.get(b).push(c);
  }
  const order = [...BUCKETS.map(([l]) => l), 'Other'];

  app.innerHTML = `
    <div class="deck-page">
      <div class="deck-main">
        <a class="back" href="/mtg/decks/">← All decks</a>
        <h1 class="deck-title">${esc(deck.name)}</h1>
        <p class="deck-sub">
          <span class="pips">${pipsHtml(v.colorIdentity)}</span>
          <span class="bracket b${v.bracket}">Bracket ${v.bracket}</span>
          <span class="deck-set">${esc(ORIGINAL.setCode ?? '')}</span>
          <span id="edited-flag" class="edited" hidden>edited</span>
        </p>

        <section class="cardgroup">
          <h2>Commander</h2>
          <ul class="cardlist">
            ${deck.commanders.map((c) => row(c, true)).join('')}
          </ul>
        </section>

        ${order.filter((b) => groups.has(b)).map((b) => {
          const list = groups.get(b).sort((a, z) => a.name.localeCompare(z.name));
          const n = list.reduce((s, c) => s + c.count, 0);
          return `
            <section class="cardgroup">
              <h2>${esc(b)} <span class="grp-count">${n}</span></h2>
              <ul class="cardlist">${list.map((c) => row(c, false)).join('')}</ul>
            </section>`;
        }).join('')}
      </div>

      <aside class="deck-side">
        <div class="side-card">
          <div class="count-big ${total === 100 ? 'ok' : 'bad'}">
            ${total}<span>/100</span>
          </div>
          ${v.errors.length
            ? `<div class="issues"><strong>Will be rejected</strong><ul>${v.errors.slice(0, 8).map((e) => `<li>${esc(e)}</li>`).join('')}</ul>${v.errors.length > 8 ? `<p class="muted">…and ${v.errors.length - 8} more</p>` : ''}</div>`
            : '<p class="all-good">Legal — XMage will take this.</p>'}
          ${v.gameChangers.length
            ? `<details class="issues"><summary>${v.gameChangers.length} Game Changer${v.gameChangers.length > 1 ? 's' : ''}</summary><ul>${v.gameChangers.map((g) => `<li>${esc(g)}</li>`).join('')}</ul></details>`
            : ''}
          <div class="result-actions">
            <button id="dl">Download .dck</button>
            <button id="reset" class="ghost" ${isEdited() ? '' : 'disabled'}>Reset</button>
          </div>
        </div>

        <div class="side-card">
          <h3>Add a card</h3>
          <input type="search" id="add-q" placeholder="Card name…" autocomplete="off" />
          <div id="add-results"></div>
        </div>

        <div class="side-card preview" id="preview-card">
          <p class="muted">Hover a card to see it.</p>
        </div>
      </aside>
    </div>`;

  wire();
  markEdited();
}

function row(c, isCommander) {
  const o = ORACLE.get(c.name.toLowerCase());
  const banned = REFS.banned.includes(c.name);
  const gc = REFS.gameChangers.includes(c.name);
  return `
    <li class="card-row${banned ? ' is-banned' : ''}" data-name="${esc(c.name)}">
      <span class="qty">${c.count ?? 1}</span>
      <span class="cname">${esc(c.name)}</span>
      ${gc ? '<span class="flag gc" title="On the Game Changers list">GC</span>' : ''}
      ${banned ? '<span class="flag ban" title="Banned on this server">banned</span>' : ''}
      <span class="cost">${manaHtml(o?.manaCost)}</span>
      <span class="row-actions">
        ${isBasicLand(c.name) ? `<button class="tiny ghost" data-act="dec" title="One fewer">−</button>
        <button class="tiny ghost" data-act="inc" title="One more">+</button>` : ''}
        ${isCommander ? '' : '<button class="tiny ghost" data-act="cut" title="Remove">×</button>'}
      </span>
    </li>`;
}

/* ------------------------------------------------------------------- wiring */

function wire() {
  initCopy(app);

  for (const li of $$('.card-row', app)) {
    const name = li.dataset.name;
    li.addEventListener('mouseenter', () => showPreview(name));
    li.addEventListener('focusin', () => showPreview(name));
    for (const btn of $$('button[data-act]', li)) {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const act = btn.dataset.act;
        const card = deck.cards.find((c) => c.name === name);
        if (!card) return;
        if (act === 'cut') deck.cards = deck.cards.filter((c) => c !== card);
        if (act === 'inc') card.count += 1;
        if (act === 'dec') {
          card.count -= 1;
          if (card.count <= 0) deck.cards = deck.cards.filter((c) => c !== card);
        }
        save();
        render();
      });
    }
  }

  $('#dl').addEventListener('click', () =>
    downloadDck(deck, `${slug(deck.name)}${isEdited() ? '-edited' : ''}.dck`));

  $('#reset').addEventListener('click', () => {
    if (!confirm('Discard your changes and go back to the original list?')) return;
    clearSaved();
    deck = structuredClone(ORIGINAL);
    render();
  });

  const q = $('#add-q');
  let timer;
  q.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => searchCards(q.value.trim()), 280);
  });
}

/* ------------------------------------------------------------------ preview */

let previewSeq = 0;
async function showPreview(name) {
  const host = $('#preview-card');
  if (!host) return;
  const seq = ++previewSeq;
  const o = ORACLE.get(name.toLowerCase());
  const img = o?.image?.replace('/small/', '/normal/') ?? o?.image;
  if (!img) { host.innerHTML = `<p class="muted">${esc(name)}</p>`; return; }
  // Guard against a slow image landing after the pointer has moved on.
  if (seq !== previewSeq) return;
  host.innerHTML = `<img src="${esc(img)}" alt="${esc(name)}" loading="lazy" />`;
}

/* ------------------------------------------------------------------- adding */

async function searchCards(term) {
  const host = $('#add-results');
  if (!term || term.length < 2) { host.innerHTML = ''; return; }
  host.innerHTML = '<p class="muted">Searching…</p>';

  // Restrict to the commander's colour identity so the results are cards you
  // can actually legally play here.
  const ci = [...new Set(deck.commanders.flatMap((c) => ORACLE.get(c.name.toLowerCase())?.colorIdentity ?? []))];
  const idParam = ci.length ? `+id<=${ci.join('')}` : '+id=C';
  const url = `https://api.scryfall.com/cards/search?q=${encodeURIComponent(term)}${idParam}+f:commander&unique=cards&order=name`;

  try {
    const res = await fetch(url);
    if (res.status === 404) { host.innerHTML = '<p class="muted">Nothing found in your colours.</p>'; return; }
    if (!res.ok) throw new Error(`Scryfall ${res.status}`);
    const body = await res.json();
    const hits = body.data.slice(0, 8);
    host.innerHTML = `<ul class="addlist">${hits.map((c) => `
      <li>
        <button class="add-hit" data-name="${esc(xmageName(c))}" data-set="${esc((c.set ?? '').toUpperCase())}" data-num="${esc(c.collector_number)}">
          <span>${esc(xmageName(c))}</span>
          <span class="cost">${manaHtml(c.mana_cost ?? c.card_faces?.[0]?.mana_cost)}</span>
        </button>
      </li>`).join('')}</ul>`;

    for (const btn of $$('.add-hit', host)) {
      btn.addEventListener('click', async () => {
        const name = btn.dataset.name;
        const existing = deck.cards.find((c) => c.name === name);
        if (existing && !isBasicLand(name)) {
          host.innerHTML = '<p class="muted">Already in the deck — Commander is singleton.</p>';
          return;
        }
        if (existing) existing.count += 1;
        else deck.cards.push({ name, setCode: btn.dataset.set, number: btn.dataset.num, count: 1 });
        await enrich([name]);
        save();
        render();
        $('#add-q').focus();
      });
    }
  } catch (err) {
    host.innerHTML = `<p class="muted">Search failed: ${esc(err.message)}</p>`;
  }
}

/* --------------------------------------------------------------------- boot */

(async function () {
  if (!DECK_ID) {
    app.innerHTML = '<p class="empty">No deck specified. <a href="/mtg/decks/">Browse all decks</a>.</p>';
    return;
  }
  try {
    const [original, refs] = await Promise.all([loadDeck(DECK_ID), loadRefs()]);
    ORIGINAL = original;
    REFS = refs;

    const saved = loadSaved();
    deck = saved ?? structuredClone(original);

    app.innerHTML = '<p class="working" style="padding:3rem 0">Looking up cards…</p>';
    await enrich([...deck.cards, ...deck.commanders].map((c) => c.name));
    render();
  } catch (err) {
    app.innerHTML = `<p class="empty">Could not load that deck. ${esc(err.message)}
      <br><a href="/mtg/decks/">Back to all decks</a></p>`;
  }
})();
