import {
  $, esc, loadIndex, loadRefs, initStatus, initCopy, deckCardHtml,
} from './common.js';
import {
  parseDecklist, resolveCards, validateCommanderDeck, toDck, downloadDck, slug,
} from './dck.js';

const FAVOURITES = ['Elf', 'Goblin', 'Merfolk', 'Angel', 'Vampire'];
const BRACKET_NAMES = { 1: 'Exhibition', 2: 'Core', 3: 'Upgraded', 4: 'Optimized', 5: 'cEDH' };

/* ------------------------------------------------------------------ tribes */

function fillTribeCounts(decks) {
  for (const el of document.querySelectorAll('[data-tribe]')) {
    const tribe = el.dataset.tribe;
    // Creature types do not pluralise by adding an s (Elves, Merfolk), so the
    // page supplies the correct plural rather than us guessing.
    const plural = el.dataset.plural ?? `${tribe}s`;
    const matches = decks.filter((d) => (d.tribeCounts ?? {})[tribe]);
    const best = Math.max(0, ...matches.map((d) => d.tribeCounts[tribe]));
    el.innerHTML = matches.length
      ? `<b>${matches.length}</b> deck${matches.length === 1 ? '' : 's'} · up to <b>${best}</b> ${esc(plural)} in one`
      : 'no decks yet';
  }
}

/* ---------------------------------------------------------------- featured */

// Show a handful per bracket rather than the whole catalogue. Decks built
// around one of the house tribes come first, then the most recent.
function featuredFor(decks, bracket, n = 5) {
  const favScore = (d) =>
    Math.max(0, ...FAVOURITES.map((t) => (d.tribeCounts ?? {})[t] ?? 0));
  return decks
    .filter((d) => d.bracket === bracket)
    .map((d) => ({ d, fav: favScore(d) }))
    .sort((a, b) => b.fav - a.fav || (b.d.releaseDate ?? '').localeCompare(a.d.releaseDate ?? ''))
    .slice(0, n)
    .map((x) => x.d);
}

function renderFeatured(decks) {
  const host = $('#featured-decks');
  const brackets = [...new Set(decks.map((d) => d.bracket))].sort();
  host.innerHTML = brackets.map((b) => {
    const picks = featuredFor(decks, b);
    if (!picks.length) return '';
    const total = decks.filter((d) => d.bracket === b).length;
    return `
      <div style="margin-bottom:1.8rem">
        <div class="section-head" style="margin-bottom:0.7rem">
          <div>
            <h3 style="font-family:var(--display);font-size:1.15rem">
              Bracket ${b} · ${esc(BRACKET_NAMES[b] ?? '')}
            </h3>
            <p style="margin:0;color:var(--muted);font-size:0.88rem">${total} decks at this level</p>
          </div>
          <a class="btn ghost tiny" href="/mtg/decks/?bracket=${b}">See all ${total} →</a>
        </div>
        <div class="deck-grid">${picks.map((d) => deckCardHtml(d)).join('')}</div>
      </div>`;
  }).join('');
}

/* --------------------------------------------------------------- converter */

let REFS = { banned: [], gameChangers: [] };

function initConverter() {
  const form = $('#convert-form');
  if (!form) return;
  form.addEventListener('submit', (e) => { e.preventDefault(); runConvert(); });
  $('#convert-clear').addEventListener('click', () => {
    $('#decklist').value = '';
    $('#convert-out').innerHTML = '';
  });
}

async function runConvert() {
  const out = $('#convert-out');
  const text = $('#decklist').value;
  if (!text.trim()) { out.innerHTML = ''; return; }
  const name = $('#deckname').value.trim() || 'My Commander Deck';

  out.innerHTML = '<p class="working">Looking up cards…</p>';
  const { entries, problems } = parseDecklist(text);
  if (!entries.length) {
    out.innerHTML = '<div class="result bad"><h3>Nothing to convert</h3><p>No card lines were recognised.</p></div>';
    return;
  }

  let found, notFound;
  try {
    const r = await resolveCards(entries.map((e) => e.name), (done, total) => {
      out.innerHTML = `<p class="working">Looking up cards… ${done}/${total}</p>`;
    });
    found = r.found; notFound = r.notFound;
  } catch (err) {
    out.innerHTML = `<div class="result bad"><h3>Card lookup failed</h3><p>${esc(err.message)}</p></div>`;
    return;
  }

  const commanders = entries.filter((e) => e.zone === 'commander');
  const cards = entries.filter((e) => e.zone === 'main');

  if (!commanders.length) {
    const legends = cards.filter((e) => {
      const r = found.get(e.name.toLowerCase());
      return r && /Legendary/.test(r.typeLine) &&
        (/Creature/.test(r.typeLine) || /can be your commander/i.test(r.typeLine));
    });
    if (legends.length) { pickCommander(out, legends, name, entries, found, notFound); return; }
  }
  finish(out, { name, commanders, cards, found, notFound, problems });
}

function pickCommander(out, legends, name, entries, found, notFound) {
  out.innerHTML = `
    <div class="result warn">
      <h3>Which one is your commander?</h3>
      <p style="color:var(--muted)">Your list did not mark one, so pick the legend that leads the deck.</p>
      <div class="hero-actions" style="margin-top:0.6rem">
        ${legends.map((l, i) => `<button class="ghost tiny" data-i="${i}">${esc(l.name)}</button>`).join('')}
      </div>
    </div>`;
  for (const btn of out.querySelectorAll('button[data-i]')) {
    btn.addEventListener('click', () => {
      const chosen = legends[Number(btn.dataset.i)];
      const cards = entries.filter((e) => e.zone === 'main')
        .map((e) => (e.name === chosen.name ? { ...e, count: e.count - 1 } : e))
        .filter((e) => e.count > 0);
      finish(out, { name, commanders: [{ ...chosen, count: 1 }], cards, found, notFound, problems: [] });
    });
  }
}

function finish(out, { name, commanders, cards, found, notFound, problems }) {
  const withPrinting = (e) => {
    const r = found.get(e.name.toLowerCase());
    return {
      name: r?.name ?? e.name,
      setCode: e.setCode ?? r?.setCode ?? null,
      number: e.number ?? r?.number ?? null,
      count: e.count,
    };
  };
  const deck = { name, commanders: commanders.map(withPrinting), cards: cards.map(withPrinting) };
  const v = validateCommanderDeck({
    commanders: deck.commanders, cards: deck.cards, resolved: found,
    banned: REFS.banned, gameChangers: REFS.gameChangers,
  });

  const errors = [...v.errors, ...notFound.map((n) => `Scryfall does not know a card called "${esc(n)}".`)];
  const warnings = [...v.warnings, ...problems];
  const ok = errors.length === 0;

  out.innerHTML = `
    <div class="result ${ok ? 'good' : 'bad'}">
      <h3>${ok ? 'Ready to play' : 'Needs a fix first'}</h3>
      <div class="summary">
        <span><strong>${v.total}</strong> cards</span>
        <span class="pips">${v.colorIdentity.length
          ? v.colorIdentity.map((c) => `<span class="pip pip-${c}">${c}</span>`).join('')
          : '<span class="pip pip-C">C</span>'}</span>
        <span class="bracket b${v.bracket}">Bracket ${v.bracket}</span>
      </div>
      ${errors.length ? `<div class="issues"><strong>XMage will reject this</strong><ul>${errors.map((e) => `<li>${e}</li>`).join('')}</ul></div>` : ''}
      ${warnings.length ? `<details class="issues"><summary>${warnings.length} thing${warnings.length > 1 ? 's' : ''} worth a look</summary><ul>${warnings.map((w) => `<li>${w}</li>`).join('')}</ul></details>` : ''}
      <div class="result-actions">
        <button id="dl">${ok ? 'Download .dck' : 'Download anyway'}</button>
        <button id="show" class="ghost">Show the file</button>
      </div>
      <pre class="dck" id="preview" hidden></pre>
    </div>`;

  $('#dl').addEventListener('click', () => downloadDck(deck, `${slug(name)}.dck`));
  $('#show').addEventListener('click', () => {
    const pre = $('#preview');
    pre.hidden = !pre.hidden;
    if (!pre.hidden) pre.textContent = toDck(deck);
  });
}

/* -------------------------------------------------------------------- boot */

(async function () {
  initStatus();
  initCopy();
  initConverter();
  try {
    const [idx, refs] = await Promise.all([loadIndex(), loadRefs()]);
    REFS = refs;
    fillTribeCounts(idx.decks);
    renderFeatured(idx.decks);
    const all = $('#all-count');
    if (all) all.textContent = idx.count;
  } catch (err) {
    const host = $('#featured-decks');
    if (host) host.innerHTML = `<p class="empty">Could not load decks. ${esc(err.message)}</p>`;
  }
})();
