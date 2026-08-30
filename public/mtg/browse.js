import { $, $$, esc, loadIndex, themeLabel, deckCardHtml, plural } from './common.js';

const state = { decks: [], colors: new Set(), bracket: 'all', theme: 'all', tribe: 'all', q: '', sort: 'new' };

/* Filters live in the URL so a filtered view can be linked and shared - the
   landing page's tribe tiles rely on this. */
function readUrl() {
  const p = new URLSearchParams(location.search);
  if (p.get('tribe')) state.tribe = p.get('tribe');
  if (p.get('bracket')) state.bracket = p.get('bracket');
  if (p.get('theme')) state.theme = p.get('theme');
  if (p.get('q')) state.q = p.get('q').toLowerCase();
  for (const c of (p.get('colors') ?? '')) if ('WUBRG'.includes(c)) state.colors.add(c);
}

function writeUrl() {
  const p = new URLSearchParams();
  if (state.tribe !== 'all') p.set('tribe', state.tribe);
  if (state.bracket !== 'all') p.set('bracket', state.bracket);
  if (state.theme !== 'all') p.set('theme', state.theme);
  if (state.q) p.set('q', state.q);
  if (state.colors.size) p.set('colors', [...state.colors].join(''));
  const qs = p.toString();
  history.replaceState(null, '', qs ? `?${qs}` : location.pathname);
}

function buildSelects() {
  const themes = new Map();
  const tribes = new Map();
  for (const d of state.decks) {
    for (const t of d.themes ?? []) themes.set(t, (themes.get(t) ?? 0) + 1);
    // Count every deck the filter would actually return, so the number in the
    // dropdown matches the number of results. tribeCounts is already pruned to
    // types with at least 3 cards, so this is not noise.
    for (const t of Object.keys(d.tribeCounts ?? {})) {
      tribes.set(t, (tribes.get(t) ?? 0) + 1);
    }
  }
  fill($('#filter-theme'), themes, themeLabel, 2);
  fill($('#filter-tribe'), tribes, plural, 2);
}

function fill(sel, map, label, min) {
  const sorted = [...map.entries()]
    .filter(([, n]) => n >= min)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  for (const [value, n] of sorted) {
    const o = document.createElement('option');
    o.value = value;
    o.textContent = `${label(value)} (${n})`;
    sel.appendChild(o);
  }
}

function syncControls() {
  $('#filter-bracket').value = state.bracket;
  $('#filter-theme').value = [...$('#filter-theme').options].some((o) => o.value === state.theme) ? state.theme : 'all';
  $('#filter-tribe').value = [...$('#filter-tribe').options].some((o) => o.value === state.tribe) ? state.tribe : 'all';
  $('#filter-q').value = state.q;
  $('#filter-sort').value = state.sort;
  for (const b of $$('.color-btn')) b.classList.toggle('on', state.colors.has(b.dataset.color));
}

function wire() {
  for (const btn of $$('.color-btn')) {
    btn.addEventListener('click', () => {
      const c = btn.dataset.color;
      state.colors.has(c) ? state.colors.delete(c) : state.colors.add(c);
      btn.classList.toggle('on', state.colors.has(c));
      render();
    });
  }
  const on = (sel, key, transform = (v) => v) =>
    $(sel).addEventListener(sel === '#filter-q' ? 'input' : 'change', (e) => {
      state[key] = transform(e.target.value); render();
    });
  on('#filter-bracket', 'bracket');
  on('#filter-theme', 'theme');
  on('#filter-tribe', 'tribe');
  on('#filter-sort', 'sort');
  on('#filter-q', 'q', (v) => v.trim().toLowerCase());

  $('#filter-reset').addEventListener('click', () => {
    state.colors.clear();
    Object.assign(state, { bracket: 'all', theme: 'all', tribe: 'all', q: '', sort: 'new' });
    syncControls();
    render();
  });
}

function matches(d) {
  if (state.bracket !== 'all' && String(d.bracket) !== state.bracket) return false;
  if (state.theme !== 'all' && !(d.themes ?? []).includes(state.theme)) return false;
  if (state.tribe !== 'all' && !(d.tribeCounts ?? {})[state.tribe]) return false;
  if (state.colors.size && !(d.colorIdentity ?? []).every((c) => state.colors.has(c))) return false;
  if (state.q) {
    const hay = `${d.name} ${(d.commanders ?? []).join(' ')} ${(d.themes ?? []).map(themeLabel).join(' ')}`.toLowerCase();
    if (!hay.includes(state.q)) return false;
  }
  return true;
}

function sorted(list) {
  const by = {
    new: (a, b) => (b.releaseDate ?? '').localeCompare(a.releaseDate ?? ''),
    old: (a, b) => (a.releaseDate ?? '').localeCompare(b.releaseDate ?? ''),
    az: (a, b) => a.name.localeCompare(b.name),
  }[state.sort];
  // When filtering by tribe, the decks with the most of that tribe are the
  // interesting ones, so they lead regardless of the chosen sort.
  if (state.tribe !== 'all') {
    return [...list].sort((a, b) =>
      (b.tribeCounts[state.tribe] ?? 0) - (a.tribeCounts[state.tribe] ?? 0) || by(a, b));
  }
  return [...list].sort(by);
}

function render() {
  writeUrl();
  const list = sorted(state.decks.filter(matches));
  $('#deck-shown').textContent = list.length;
  const grid = $('#deck-grid');
  if (!list.length) {
    grid.innerHTML = '<p class="empty">Nothing matches those filters. <button class="link" id="clear">Clear them</button></p>';
    $('#clear')?.addEventListener('click', () => $('#filter-reset').click());
    return;
  }
  grid.innerHTML = list.map((d) => deckCardHtml(d, {
    note: state.tribe !== 'all' ? `${d.tribeCounts[state.tribe]} ${plural(state.tribe)}` : null,
  })).join('');
}

(async function () {
  try {
    const idx = await loadIndex();
    state.decks = idx.decks;
    $('#deck-total').textContent = idx.count;
    readUrl();
    buildSelects();
    syncControls();
    wire();
    render();
  } catch (err) {
    $('#deck-grid').innerHTML = `<p class="empty">Could not load decks. ${esc(err.message)}</p>`;
  }
})();
