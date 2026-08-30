/* Shared helpers for the /mtg pages. */

export const DATA = '/mtg/data';

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const COLOR_NAMES = { W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green' };

// Creature types do not all take a plain -s: Elf/Elves, Dwarf/Dwarves, and
// Merfolk is already plural. "40 Elfs" reads badly enough to be worth this.
const IRREGULAR = {
  Merfolk: 'Merfolk', Kithkin: 'Kithkin', Spirit: 'Spirits',
  Human: 'Humans', Fungus: 'Fungi', Mouse: 'Mice', Goose: 'Geese',
};
export function plural(type) {
  if (IRREGULAR[type]) return IRREGULAR[type];
  if (/(?:^|[a-z])f$/.test(type)) return `${type.slice(0, -1)}ves`;   // Elf, Dwarf, Wolf
  if (/fe$/.test(type)) return `${type.slice(0, -2)}ves`;             // Knife-likes
  if (/(?:s|x|z|ch|sh)$/.test(type)) return `${type}es`;
  return `${type}s`;
}

const THEME_LABELS = {
  tokens: 'Tokens', counters: '+1/+1 Counters', graveyard: 'Graveyard',
  sacrifice: 'Sacrifice', artifacts: 'Artifacts', enchantments: 'Enchantments',
  spellslinger: 'Spellslinger', lifegain: 'Lifegain', landfall: 'Landfall',
  equipment: 'Equipment', auras: 'Auras', blink: 'Blink', mill: 'Mill',
  politics: 'Politics', grouphug: 'Group Hug', treasure: 'Treasure',
  ramp: 'Ramp', aggro: 'Aggro', flying: 'Flying', bigcreatures: 'Big Creatures',
};
export const themeLabel = (t) =>
  t.startsWith('tribal:') ? `${t.slice(7)} Tribal` : (THEME_LABELS[t] ?? t);

/* ------------------------------------------------------------------- data  */

let _index = null;
export async function loadIndex() {
  if (!_index) _index = await fetch(`${DATA}/decks/index.json`).then((r) => r.json());
  return _index;
}
export const loadDeck = (id) => fetch(`${DATA}/decks/${id}.json`).then((r) => r.json());

let _refs = null;
export async function loadRefs() {
  if (!_refs) {
    const [b, g] = await Promise.all([
      fetch('/mtg/banned.json').then((r) => r.json()).catch(() => ({ banned: [] })),
      fetch('/mtg/gamechangers.json').then((r) => r.json()).catch(() => ({ gameChangers: [] })),
    ]);
    _refs = { banned: b.banned ?? [], gameChangers: g.gameChangers ?? [] };
  }
  return _refs;
}

/* ----------------------------------------------------------------- status  */

export async function initStatus() {
  const el = $('#server-status');
  if (!el) return;
  try {
    const s = await fetch(`/mtg/status.json?t=${Date.now()}`, { cache: 'no-store' })
      .then((r) => { if (!r.ok) throw new Error('no status'); return r.json(); });
    const age = Date.now() - new Date(s.checkedAt).getTime();
    el.dataset.state = s.up ? 'up' : 'down';
    $('#status-dot', el).className = `dot ${s.up ? 'dot-up' : 'dot-down'}`;
    $('#status-text', el).textContent = s.up ? 'Table is up' : 'Table is down';
    $('#status-sub', el).textContent = `checked ${fmtAgo(age)} ago`;
  } catch {
    el.dataset.state = 'unknown';
    $('#status-text', el).textContent = 'Status unknown';
    $('#status-sub', el).textContent = 'try connecting anyway';
  }
}

function fmtAgo(ms) {
  const m = Math.round(ms / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h} hr` : `${Math.round(h / 24)} d`;
}

/* ------------------------------------------------------------------- copy  */

export function initCopy(root = document) {
  for (const btn of $$('[data-copy]', root)) {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      try {
        await navigator.clipboard.writeText(btn.dataset.copy);
        const old = btn.textContent;
        btn.textContent = 'Copied';
        btn.classList.add('copied');
        setTimeout(() => { btn.textContent = old; btn.classList.remove('copied'); }, 1400);
      } catch { btn.textContent = 'Ctrl+C'; }
    });
  }
}

/* -------------------------------------------------------------- rendering  */

export function pipsHtml(colors) {
  if (!colors?.length) return '<span class="pip pip-C" title="Colorless">C</span>';
  return colors.map((c) => `<span class="pip pip-${c}" title="${COLOR_NAMES[c]}">${c}</span>`).join('');
}

/** Deck card. Links through to the detail/editor page. */
const fmtViews = (n) =>
  n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k views` : `${n} views`;

/** The line along the bottom of a deck card: where it came from. */
function provenance(d) {
  if (d.source === 'archidekt') {
    const bits = [];
    if (d.author) bits.push(`by ${esc(d.author)}`);
    if (d.views) bits.push(fmtViews(d.views));
    return bits.join(' · ') || 'community deck';
  }
  return `${esc(d.setCode ?? '')} · ${(d.date ?? '').slice(0, 4)}`;
}

export function deckCardHtml(d, opts = {}) {
  const themes = (d.themes ?? []).slice(0, 3)
    .map((t) => `<span class="tag">${esc(themeLabel(t))}</span>`).join('');
  const warn = d.bannedInXMage?.length
    ? `<p class="deck-warn">Has ${esc(d.bannedInXMage.join(', '))} — banned here</p>` : '';
  const note = opts.note ? `<p class="deck-cmd">${esc(opts.note)}</p>` : '';
  return `
    <a class="deck" href="/mtg/deck/?id=${encodeURIComponent(d.id)}">
      <div class="deck-head">
        <span class="pips">${pipsHtml(d.colorIdentity)}</span>
        <span class="bracket b${d.bracket}" title="Estimated Commander bracket">B${d.bracket}</span>
      </div>
      <h3>${esc(d.name)}</h3>
      <p class="deck-cmd">${esc((d.commanders ?? []).join(' + '))}</p>
      ${note}
      <div class="tags">${themes}</div>
      ${warn}
      <div class="deck-foot">
        <span class="deck-set">${provenance(d)}</span>
        <span class="deck-set">Open →</span>
      </div>
    </a>`;
}
