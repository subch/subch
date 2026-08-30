import {
  toDck, downloadDck, slug, parseDecklist, resolveCards,
  validateCommanderDeck, normaliseName, isBasicLand,
} from './dck.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const THEME_LABELS = {
  tokens: 'Tokens', counters: '+1/+1 Counters', graveyard: 'Graveyard',
  sacrifice: 'Sacrifice', artifacts: 'Artifacts', enchantments: 'Enchantments',
  spellslinger: 'Spellslinger', lifegain: 'Lifegain', landfall: 'Landfall',
  equipment: 'Equipment', auras: 'Auras', blink: 'Blink', mill: 'Mill',
  politics: 'Politics', grouphug: 'Group Hug', treasure: 'Treasure',
  ramp: 'Ramp', aggro: 'Aggro',
};
const themeLabel = (t) =>
  t.startsWith('tribal:') ? `${t.slice(7)} Tribal` : (THEME_LABELS[t] ?? t);

const COLOR_NAMES = { W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green' };

let BANNED = [];
let GAME_CHANGERS = [];

/* ================================================================= status */

async function initStatus() {
  const el = $('#server-status');
  if (!el) return;

  try {
    // status.json is refreshed by a GitHub Action; cache-bust so we do not read
    // a stale copy out of the CDN.
    const res = await fetch(`/mtg/status.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error('no status file');
    const s = await res.json();

    const age = Date.now() - new Date(s.checkedAt).getTime();
    const stale = age > 20 * 60 * 1000;

    el.dataset.state = s.up ? 'up' : 'down';
    $('#status-dot', el).className = `dot ${s.up ? 'dot-up' : 'dot-down'}`;
    $('#status-text', el).textContent = s.up
      ? 'Table is up — come on in'
      : 'Table is down right now';
    $('#status-sub', el).textContent = stale
      ? `Last checked ${fmtAgo(age)} ago (check may be delayed)`
      : `Checked ${fmtAgo(age)} ago`;
  } catch {
    el.dataset.state = 'unknown';
    $('#status-dot', el).className = 'dot dot-unknown';
    $('#status-text', el).textContent = 'Server status unavailable';
    $('#status-sub', el).textContent = 'Try connecting anyway — it may well be up.';
  }
}

function fmtAgo(ms) {
  const m = Math.round(ms / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h} hr` : `${Math.round(h / 24)} d`;
}

/* ============================================================ copy buttons */

function initCopy() {
  for (const btn of $$('[data-copy]')) {
    btn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(btn.dataset.copy);
        const old = btn.textContent;
        btn.textContent = 'Copied';
        btn.classList.add('copied');
        setTimeout(() => { btn.textContent = old; btn.classList.remove('copied'); }, 1400);
      } catch {
        btn.textContent = 'Press Ctrl+C';
      }
    });
  }
}

/* ================================================================= picker */

const state = { decks: [], colors: new Set(), bracket: 'all', theme: 'all', q: '' };

async function initPicker() {
  const grid = $('#deck-grid');
  if (!grid) return;

  try {
    const [idx, bans, gcs] = await Promise.all([
      fetch('/mtg/decks/index.json').then((r) => r.json()),
      fetch('/mtg/banned.json').then((r) => r.json()).catch(() => ({ banned: [] })),
      fetch('/mtg/gamechangers.json').then((r) => r.json()).catch(() => ({ gameChangers: [] })),
    ]);
    state.decks = idx.decks;
    BANNED = bans.banned ?? [];
    GAME_CHANGERS = gcs.gameChangers ?? [];
    $('#deck-count').textContent = idx.count;
  } catch (err) {
    grid.innerHTML = `<p class="empty">Could not load the deck list. ${err.message}</p>`;
    return;
  }

  buildThemeFilter();
  wirePickerControls();
  renderDecks();
}

function buildThemeFilter() {
  const counts = new Map();
  for (const d of state.decks) {
    for (const t of d.themes) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  const sel = $('#filter-theme');
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  for (const [t, n] of sorted) {
    if (n < 2) continue;
    const opt = document.createElement('option');
    opt.value = t;
    opt.textContent = `${themeLabel(t)} (${n})`;
    sel.appendChild(opt);
  }
}

function wirePickerControls() {
  for (const btn of $$('.color-btn')) {
    btn.addEventListener('click', () => {
      const c = btn.dataset.color;
      if (state.colors.has(c)) state.colors.delete(c); else state.colors.add(c);
      btn.classList.toggle('on', state.colors.has(c));
      renderDecks();
    });
  }
  $('#filter-bracket').addEventListener('change', (e) => {
    state.bracket = e.target.value; renderDecks();
  });
  $('#filter-theme').addEventListener('change', (e) => {
    state.theme = e.target.value; renderDecks();
  });
  $('#filter-q').addEventListener('input', (e) => {
    state.q = e.target.value.trim().toLowerCase(); renderDecks();
  });
  $('#filter-reset').addEventListener('click', () => {
    state.colors.clear(); state.bracket = 'all'; state.theme = 'all'; state.q = '';
    $$('.color-btn').forEach((b) => b.classList.remove('on'));
    $('#filter-bracket').value = 'all';
    $('#filter-theme').value = 'all';
    $('#filter-q').value = '';
    renderDecks();
  });
}

function matches(d) {
  if (state.bracket !== 'all' && String(d.bracket) !== state.bracket) return false;
  if (state.theme !== 'all' && !d.themes.includes(state.theme)) return false;
  // Colour filter is "fits within these colours", which is how you actually
  // shop for a deck - pick your colours, see what you could play.
  if (state.colors.size && !d.colorIdentity.every((c) => state.colors.has(c))) return false;
  if (state.q) {
    const hay = `${d.name} ${d.commanders.join(' ')} ${d.themes.map(themeLabel).join(' ')}`.toLowerCase();
    if (!hay.includes(state.q)) return false;
  }
  return true;
}

function renderDecks() {
  const grid = $('#deck-grid');
  const list = state.decks.filter(matches);
  $('#deck-shown').textContent = list.length;

  if (!list.length) {
    grid.innerHTML = `<p class="empty">No decks match those filters. <button class="link" id="clear-inline">Clear them</button></p>`;
    $('#clear-inline')?.addEventListener('click', () => $('#filter-reset').click());
    return;
  }

  grid.innerHTML = list.map(deckCard).join('');
  for (const btn of $$('.deck-get', grid)) {
    btn.addEventListener('click', () => grabDeck(btn.dataset.id, btn));
  }
}

function deckCard(d) {
  const pips = d.colorIdentity.length
    ? d.colorIdentity.map((c) => `<span class="pip pip-${c}" title="${COLOR_NAMES[c]}">${c}</span>`).join('')
    : '<span class="pip pip-C" title="Colorless">C</span>';
  const themes = d.themes.slice(0, 3).map((t) => `<span class="tag">${themeLabel(t)}</span>`).join('');
  const warn = d.bannedInXMage?.length
    ? `<p class="deck-warn">Contains ${d.bannedInXMage.join(', ')}, banned on this server — swap before playing.</p>`
    : '';
  return `
    <article class="deck">
      <div class="deck-head">
        <div class="pips">${pips}</div>
        <span class="bracket b${d.bracket}" title="Estimated Commander bracket">B${d.bracket}</span>
      </div>
      <h3>${esc(d.name)}</h3>
      <p class="deck-cmd">${d.commanders.map(esc).join(' + ')}</p>
      <div class="tags">${themes}</div>
      ${warn}
      <div class="deck-foot">
        <span class="deck-set">${esc(d.setCode)} · ${(d.releaseDate ?? '').slice(0, 4)}</span>
        <button class="deck-get" data-id="${d.id}">Download .dck</button>
      </div>
    </article>`;
}

async function grabDeck(id, btn) {
  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Building...';
  try {
    const deck = await fetch(`/mtg/decks/${id}.json`).then((r) => r.json());
    downloadDck(deck, `${slug(deck.name)}.dck`);
    btn.textContent = 'Downloaded';
    setTimeout(() => { btn.textContent = original; btn.disabled = false; }, 1600);
  } catch (err) {
    btn.textContent = 'Failed';
    console.error(err);
    setTimeout(() => { btn.textContent = original; btn.disabled = false; }, 1600);
  }
}

/* ============================================================== converter */

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
  out.innerHTML = `<p class="working">Looking up cards on Scryfall...</p>`;

  const { entries, problems } = parseDecklist(text);
  if (!entries.length) {
    out.innerHTML = `<div class="result bad"><h3>Nothing to convert</h3><p>No card lines were recognised.</p></div>`;
    return;
  }

  // Make sure the reference data is loaded even if the picker never ran.
  if (!BANNED.length) {
    BANNED = await fetch('/mtg/banned.json').then((r) => r.json()).then((b) => b.banned).catch(() => []);
  }
  if (!GAME_CHANGERS.length) {
    GAME_CHANGERS = await fetch('/mtg/gamechangers.json').then((r) => r.json())
      .then((g) => g.gameChangers).catch(() => []);
  }

  let resolved, notFound;
  try {
    const r = await resolveCards(entries.map((e) => e.name), (done, total) => {
      out.innerHTML = `<p class="working">Looking up cards on Scryfall... ${done}/${total}</p>`;
    });
    resolved = r.found;
    notFound = r.notFound;
  } catch (err) {
    out.innerHTML = `<div class="result bad"><h3>Card lookup failed</h3><p>${esc(err.message)}</p></div>`;
    return;
  }

  let commanders = entries.filter((e) => e.zone === 'commander');
  let cards = entries.filter((e) => e.zone === 'main');

  // Nothing marked as commander: if the list is 100 cards, the commander is in
  // there somewhere - offer the legendary creatures to choose from.
  if (!commanders.length) {
    const legends = cards.filter((e) => {
      const r = resolved.get(e.name.toLowerCase());
      return r && /Legendary/.test(r.typeLine) &&
        (/Creature/.test(r.typeLine) || /can be your commander/i.test(r.typeLine));
    });
    if (legends.length) {
      renderCommanderPicker(out, legends, name, entries, resolved, notFound);
      return;
    }
  }

  finishConvert(out, { name, commanders, cards, resolved, notFound, problems });
}

function renderCommanderPicker(out, legends, name, entries, resolved, notFound) {
  out.innerHTML = `
    <div class="result warn">
      <h3>Which one is your commander?</h3>
      <p>Your list did not mark a commander, so pick the legendary creature that leads the deck.</p>
      <div class="cmd-picker">
        ${legends.map((l, i) => `<button class="cmd-opt" data-i="${i}">${esc(l.name)}</button>`).join('')}
      </div>
    </div>`;
  for (const btn of $$('.cmd-opt', out)) {
    btn.addEventListener('click', () => {
      const chosen = legends[Number(btn.dataset.i)];
      const commanders = [{ ...chosen, count: 1 }];
      const cards = entries
        .filter((e) => e.zone === 'main')
        .map((e) => (e.name === chosen.name ? { ...e, count: e.count - 1 } : e))
        .filter((e) => e.count > 0);
      finishConvert(out, { name, commanders, cards, resolved, notFound, problems: [] });
    });
  }
}

function finishConvert(out, { name, commanders, cards, resolved, notFound, problems }) {
  const withPrinting = (e) => {
    const r = resolved.get(e.name.toLowerCase());
    return {
      name: r?.name ?? e.name,
      // Trust an explicit printing from the paste; otherwise take Scryfall's.
      setCode: e.setCode ?? r?.setCode ?? null,
      number: e.number ?? r?.number ?? null,
      count: e.count,
    };
  };

  const deck = {
    name,
    commanders: commanders.map(withPrinting),
    cards: cards.map(withPrinting),
  };

  const v = validateCommanderDeck({
    commanders: deck.commanders,
    cards: deck.cards,
    resolved,
    banned: BANNED,
    gameChangers: GAME_CHANGERS,
  });

  const unknown = notFound.map((n) => `Scryfall does not know a card called "${esc(n)}".`);
  const errors = [...v.errors, ...unknown];
  const warnings = [...v.warnings, ...problems];
  const ok = errors.length === 0;

  const pips = v.colorIdentity.length
    ? v.colorIdentity.map((c) => `<span class="pip pip-${c}">${c}</span>`).join('')
    : '<span class="pip pip-C">C</span>';

  out.innerHTML = `
    <div class="result ${ok ? 'good' : 'bad'}">
      <h3>${ok ? 'Ready to play' : 'Needs a fix first'}</h3>
      <div class="summary">
        <span><strong>${v.total}</strong> cards</span>
        <span class="pips">${pips}</span>
        <span class="bracket b${v.bracket}">Bracket ${v.bracket}</span>
        ${v.gameChangers.length ? `<span class="gc">${v.gameChangers.length} Game Changer${v.gameChangers.length > 1 ? 's' : ''}</span>` : ''}
      </div>
      ${errors.length ? `<div class="issues"><h4>XMage will reject this</h4><ul>${errors.map((e) => `<li>${e}</li>`).join('')}</ul></div>` : ''}
      ${warnings.length ? `<details class="issues soft"><summary>${warnings.length} thing${warnings.length > 1 ? 's' : ''} worth a look</summary><ul>${warnings.map((w) => `<li>${w}</li>`).join('')}</ul></details>` : ''}
      ${v.gameChangers.length ? `<details class="issues soft"><summary>Game Changers in this deck</summary><ul>${v.gameChangers.map((g) => `<li>${esc(g)}</li>`).join('')}</ul></details>` : ''}
      <div class="result-actions">
        <button id="dl-dck" ${ok ? '' : 'class="secondary"'}>Download .dck${ok ? '' : ' anyway'}</button>
        <button id="show-dck" class="secondary">Show the file</button>
      </div>
      <pre id="dck-preview" hidden></pre>
    </div>`;

  $('#dl-dck').addEventListener('click', () => downloadDck(deck, `${slug(name)}.dck`));
  $('#show-dck').addEventListener('click', () => {
    const pre = $('#dck-preview');
    pre.hidden = !pre.hidden;
    if (!pre.hidden) pre.textContent = toDck(deck);
  });
}

/* =================================================================== util */

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* =================================================================== boot */

initStatus();
initCopy();
initPicker();
initConverter();
