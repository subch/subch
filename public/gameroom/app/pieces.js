// The shared piece library, ported from design/theme-preview.html (the
// approved "Up close" renderers). Every piece is an inline SVG built from
// theme tokens: shadow → edge → gradient face → gloss, plus one detail.
// Styling lives in themes.css (.ck) and base.css (.cp/.qp/.pit/.cf/.cb).

// ---------- shared defs (gradients, blur, paper, lattice) ------------------

const DEFS = `
<svg class="svg-defs" aria-hidden="true">
  <defs>
    <filter id="blur" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2.2"/></filter>
    <radialGradient id="gA" cx="36%" cy="30%" r="75%"><stop offset="0" style="stop-color:var(--p1-hi)"/><stop offset=".55" style="stop-color:var(--p1)"/><stop offset="1" style="stop-color:color-mix(in srgb, var(--p1) 70%, #000)"/></radialGradient>
    <radialGradient id="gB" cx="36%" cy="30%" r="75%"><stop offset="0" style="stop-color:var(--p2-hi)"/><stop offset=".55" style="stop-color:var(--p2)"/><stop offset="1" style="stop-color:color-mix(in srgb, var(--p2) 70%, #000)"/></radialGradient>
    <linearGradient id="qL" x1="0" x2="1"><stop offset="0" style="stop-color:var(--q-light-2)"/><stop offset=".35" style="stop-color:var(--q-light)"/><stop offset="1" style="stop-color:var(--q-light-2)"/></linearGradient>
    <linearGradient id="qD" x1="0" x2="1"><stop offset="0" style="stop-color:var(--q-dark-2)"/><stop offset=".35" style="stop-color:var(--q-dark)"/><stop offset="1" style="stop-color:var(--q-dark-2)"/></linearGradient>
    <radialGradient id="bowl" cx="50%" cy="30%" r="70%"><stop offset="0" style="stop-color:color-mix(in srgb, var(--rail-edge) 80%, #000)"/><stop offset=".7" style="stop-color:var(--rail-edge)"/><stop offset="1" style="stop-color:var(--rail-2)"/></radialGradient>
    <pattern id="paper" width="60" height="60" patternUnits="userSpaceOnUse"><circle cx="12" cy="20" r=".6" fill="#000" opacity=".08"/><circle cx="40" cy="8" r=".5" fill="#000" opacity=".07"/><circle cx="50" cy="44" r=".7" fill="#000" opacity=".06"/><circle cx="25" cy="50" r=".5" fill="#000" opacity=".08"/></pattern>
    <pattern id="lattice" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 6 H12 M6 0 V12" class="lattice"/></pattern>
  </defs>
</svg>`;

export function injectDefs() {
  if (!document.querySelector('.svg-defs')) {
    document.body.insertAdjacentHTML('afterbegin', DEFS);
  }
}

// ---------- checkers / connect four discs ----------------------------------

const CROWN_SMALL = 'M30 60 L35 40 L44 50 L50 33 L56 50 L65 40 L70 60 Z';

export function checker(seat, king) {
  return `<svg viewBox="0 0 100 100" class="ck s${seat}${king ? ' king' : ''}">` +
    '<ellipse class="shadow" cx="52" cy="60" rx="41" ry="37"/>' +
    '<circle class="edge" cx="50" cy="56" r="41"/>' +
    '<circle class="face" cx="50" cy="48" r="41"/>' +
    '<g class="groove"><circle cx="50" cy="48" r="33"/><circle cx="50" cy="48" r="25"/><circle cx="50" cy="48" r="17"/></g>' +
    '<g class="groove-hi"><circle cx="50" cy="49.3" r="33"/><circle cx="50" cy="49.3" r="25"/><circle cx="50" cy="49.3" r="17"/></g>' +
    '<circle class="rim" cx="50" cy="48" r="39"/>' +
    '<ellipse class="gloss" cx="38" cy="33" rx="17" ry="9"/>' +
    (king ? `<path class="crown" d="${CROWN_SMALL}"/><rect class="crown" x="30" y="60" width="40" height="6" rx="1.5"/><circle class="crown-j" cx="50" cy="52" r="3"/>` : '') +
    '</svg>';
}

// A flat single-groove disc (trays, connect four).
export function disc(seat) {
  return `<svg viewBox="0 0 100 100" class="ck s${seat}">` +
    '<circle class="edge" cx="50" cy="54" r="44"/><circle class="face" cx="50" cy="48" r="44"/>' +
    '<g class="groove"><circle cx="50" cy="48" r="30"/></g><circle class="rim" cx="50" cy="48" r="42"/>' +
    '<ellipse class="gloss" cx="36" cy="32" rx="16" ry="8"/></svg>';
}

// ---------- chess (Staunton-ish stand-ins; real art = tinted cburnett) -----

export const CHESS_PATHS = {
  king:   'M50 10 v8 M44 14 h12 M50 18 c-6 0-10 4-10 9 0 4 3 7 6 9 h8 c3-2 6-5 6-9 0-5-4-9-10-9 z M40 38 h20 l3 22 h-26 z M35 60 h30 l2 8 h-34 z M31 68 h38 v8 h-38 z',
  queen:  'M50 12 m-3 0 a3 3 0 1 0 6 0 a3 3 0 1 0-6 0 M30 26 l6 18 h28 l6-18 -10 10 -4-14 -6 12 -6-12 -4 14 z M38 44 h24 l2 18 h-28 z M34 62 h32 l2 7 h-36 z M31 69 h38 v7 h-38 z',
  knight: 'M34 76 h32 v-6 c0-10-2-18-6-24 2-5 6-6 8-8 -2-4-6-6-10-6 -3-4-6-7-10-10 -1 3-1 6 0 9 -4 3-8 10-8 16 l8 -2 c-2 6-4 12-4 18 z M44 40 a2 2 0 1 0 4 0 a2 2 0 1 0-4 0',
  rook:   'M32 14 h8 v6 h6 v-6 h8 v6 h6 v-6 h8 v14 h-36 z M36 28 h28 l2 30 h-32 z M33 58 h34 v10 h-34 z M30 68 h40 v8 h-40 z',
  bishop: 'M50 10 a3 3 0 1 0 0.1 0 M50 16 c-8 4-12 12-12 20 0 6 4 10 8 12 h8 c4-2 8-6 8-12 0-8-4-16-12-20 z M42 48 h16 l2 12 h-20 z M36 60 h28 l2 8 h-32 z M32 68 h36 v8 h-36 z',
  pawn:   'M50 18 a7 7 0 1 0 .1 0 M42 34 h16 c2 8 4 14 6 22 h-28 c2-8 4-14 6-22 z M36 56 h28 l2 10 h-32 z M32 66 h36 v10 h-36 z',
};

export function chessPiece(kind, seat) {
  return `<svg viewBox="0 0 100 90" class="cp s${seat}"><ellipse class="shadow" cx="52" cy="80" rx="22" ry="6"/>` +
    `<path class="body" d="${CHESS_PATHS[kind]}" stroke-linejoin="round" stroke-linecap="round"/>` +
    (kind === 'king' ? '<rect class="cross" x="48.5" y="6" width="3" height="12" rx=".8"/><rect class="cross" x="44" y="10.5" width="12" height="3" rx=".8"/>' : '') +
    '</svg>';
}

// ---------- quarto ---------------------------------------------------------

export function quarto(tall, dark, round, hollow) {
  const h = tall ? 62 : 36, top = 80 - h, ry = 9;
  let s = `<svg viewBox="0 0 100 100" class="qp ${dark ? 'dark' : 'light'}">`;
  s += '<ellipse class="shadow" cx="52" cy="86" rx="30" ry="7"/>';
  if (round) {
    s += `<path class="side" d="M22 ${top} v${h} a28 ${ry} 0 0 0 56 0 v-${h} z"/>`;
    s += `<ellipse class="top" cx="50" cy="${top}" rx="28" ry="${ry}"/><ellipse class="top-edge" cx="50" cy="${top}" rx="28" ry="${ry}"/>`;
    if (hollow) s += `<ellipse class="hole" cx="50" cy="${top}" rx="12" ry="4"/>`;
    s += `<ellipse class="gloss" cx="34" cy="${top + 14}" rx="4" ry="${h * 0.35}"/>`;
  } else {
    const t8 = top + 8;
    s += `<path class="side" d="M22 ${t8} v${h} h52 v-${h} z"/>`;
    s += `<path class="side-r" d="M74 ${t8} l10-8 v${h} l-10 8 z"/>`;
    s += `<path class="top" d="M22 ${t8} l10-8 h52 l-10 8 z"/><path class="top-edge" d="M22 ${t8} l10-8 h52 l-10 8 z"/>`;
    if (hollow) s += `<path class="hole" d="M40 ${t8 - 2} l5-4 h20 l-5 4 z"/>`;
    s += `<rect class="gloss" x="26" y="${t8 + 6}" width="5" height="${h * 0.7}" rx="2"/>`;
  }
  return s + '</svg>';
}

// ---------- mancala pit ----------------------------------------------------

const BEAD_COLORS = ['var(--p1)', 'var(--p2)', 'var(--accent)', 'var(--accent-2)', 'var(--p1-hi)', 'var(--q-light-2)'];

// Deterministic jitter from (pit index, bead index) so layouts are stable.
function beadPos(pitIndex, i) {
  const a = Math.sin(pitIndex * 37.1 + i * 17.7) * 0.5 + 0.5;
  const b = Math.sin(pitIndex * 61.3 + i * 29.9) * 0.5 + 0.5;
  const ring = Math.floor(i / 7);
  const angle = (i % 7) / 7 * Math.PI * 2 + a * 0.9;
  const rx = 12 + ring * 13 + a * 8, ryr = 6 + ring * 6 + b * 4;
  return [80 + Math.cos(angle) * rx, 52 + Math.sin(angle) * ryr];
}

export function pit(count, pitIndex = 0) {
  let s = '<svg viewBox="0 0 160 100" class="pit"><ellipse class="bowl" cx="80" cy="54" rx="56" ry="30"/><ellipse class="rim" cx="80" cy="54" rx="56" ry="30"/>';
  for (let i = 0; i < Math.min(count, 24); i++) {
    const [x, y] = beadPos(pitIndex, i);
    s += `<circle class="bead" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="9" fill="${BEAD_COLORS[i % BEAD_COLORS.length]}"/>` +
      `<ellipse class="bead-hl" cx="${(x - 3).toFixed(1)}" cy="${(y - 4).toFixed(1)}" rx="3" ry="2"/>`;
  }
  return s + `<text class="count" x="80" y="96" text-anchor="middle">${count}</text></svg>`;
}

// ---------- cards ----------------------------------------------------------

export const SUITS = { s: '♠', h: '♥', d: '♦', c: '♣' };

export function cardFace(rank, suit) {
  const red = suit === 'h' || suit === 'd';
  const court = /^[KQJ]$/.test(rank);
  let s = `<svg viewBox="0 0 100 140" class="cf${red ? ' red' : ''}"><rect class="paper" width="100" height="140" rx="8"/><rect width="100" height="140" rx="8" fill="url(#paper)" opacity=".5"/>`;
  s += `<text class="ink idx" x="8" y="18">${rank}</text><text class="ink idx" x="8" y="32">${SUITS[suit]}</text>`;
  s += `<g transform="rotate(180 50 70)"><text class="ink idx" x="8" y="18">${rank}</text><text class="ink idx" x="8" y="32">${SUITS[suit]}</text></g>`;
  if (court) {
    s += '<rect class="frame" x="22" y="30" width="56" height="80" rx="3"/><rect class="frame" x="25" y="33" width="50" height="74" rx="2"/>';
    s += `<text class="ink mono" x="50" y="84" text-anchor="middle">${rank}</text>`;
    s += `<text class="ink" x="50" y="50" text-anchor="middle" font-size="14">${SUITS[suit]}</text><text class="ink" x="50" y="104" text-anchor="middle" font-size="14">${SUITS[suit]}</text>`;
  } else {
    s += `<text class="ink" x="50" y="86" text-anchor="middle" font-size="46">${SUITS[suit]}</text>`;
  }
  return s + '</svg>';
}

export function cardBack() {
  return '<svg viewBox="0 0 100 140" class="cb"><rect class="base" width="100" height="140" rx="8"/>' +
    '<rect x="8" y="8" width="84" height="124" rx="4" fill="url(#lattice)"/>' +
    '<rect class="border" x="8" y="8" width="84" height="124" rx="4"/><rect class="border2" x="12" y="12" width="76" height="116" rx="3"/>' +
    '<circle class="medal" cx="50" cy="70" r="18"/><circle class="border2" cx="50" cy="70" r="14"/>' +
    '<text class="medal-ink" x="50" y="77" text-anchor="middle" font-size="20">♠</text></svg>';
}

// ---------- crown (result card, kings) -------------------------------------

export function crownIcon(size = 64) {
  return `<svg viewBox="0 0 100 100" style="width:${size}px;height:${size}px;overflow:visible"><g class="ck">` +
    '<path class="crown" d="M20 70 L28 35 L42 52 L50 22 L58 52 L72 35 L80 70 Z"/>' +
    '<rect class="crown" x="20" y="70" width="60" height="9" rx="2"/>' +
    '<circle class="crown-j" cx="50" cy="60" r="5"/></g></svg>';
}

// ---------- hub tile icons -------------------------------------------------

export const TILE_ICONS = {
  'tic-tac-toe': '<svg viewBox="0 0 100 100" fill="none" stroke-width="8" stroke-linecap="round"><path d="M36 8v84M64 8v84M8 36h84M8 64h84" stroke="var(--ink-2)" opacity=".5"/><path d="M14 14l16 16M30 14L14 30" stroke="var(--p1)"/><circle cx="50" cy="50" r="9" stroke="var(--p2)"/><path d="M70 70l16 16M86 70L70 86" stroke="var(--p1)"/></svg>',
  checkers: `<svg viewBox="0 0 100 100"><g class="ck s0"><circle class="edge" cx="38" cy="60" r="26"/><circle class="face" cx="38" cy="54" r="26"/><g class="groove"><circle cx="38" cy="54" r="17"/></g></g><g class="ck s1"><circle class="edge" cx="66" cy="46" r="26"/><circle class="face" cx="66" cy="40" r="26"/><g class="groove"><circle cx="66" cy="40" r="17"/></g></g></svg>`,
  chess: `<svg viewBox="0 0 100 90" class="cp s1"><path class="body" d="${CHESS_PATHS.knight}"/></svg>`,
  quarto: '<svg viewBox="0 0 100 100" class="qp dark"><path class="side" d="M30 40 v40 a20 7 0 0 0 40 0 v-40 z"/><ellipse class="top" cx="50" cy="40" rx="20" ry="7"/><ellipse class="hole" cx="50" cy="40" rx="9" ry="3"/></svg>',
  war: cardBack(),
  'crazy-8s': '<svg viewBox="0 0 100 100"><rect x="24" y="10" width="52" height="76" rx="7" fill="var(--card-face)" stroke="rgba(0,0,0,.3)" stroke-width="2" transform="rotate(-6 50 50)"/><text x="47" y="62" text-anchor="middle" font-family="var(--font-display)" font-weight="700" font-size="40" fill="var(--card-red)" transform="rotate(-6 50 50)">8</text><text x="34" y="30" font-size="13" fill="var(--card-ink)" transform="rotate(-6 50 50)">♠</text><text x="62" y="80" font-size="13" fill="var(--card-red)" transform="rotate(-6 50 50)">♥</text></svg>',
  'connect-four': '<svg viewBox="0 0 100 100"><rect width="100" height="100" rx="10" fill="var(--rail)"/><g class="ck s0"><circle class="face" cx="28" cy="72" r="14"/></g><g class="ck s1"><circle class="face" cx="72" cy="72" r="14"/></g><g class="ck s0"><circle class="face" cx="28" cy="28" r="14"/></g><circle cx="72" cy="28" r="14" fill="rgba(0,0,0,.35)"/></svg>',
  mancala: '<svg viewBox="0 0 160 100"><ellipse cx="80" cy="54" rx="56" ry="30" fill="url(#bowl)"/><circle cx="66" cy="52" r="10" fill="var(--p1)"/><circle cx="90" cy="46" r="10" fill="var(--p2)"/><circle cx="82" cy="64" r="10" fill="var(--accent)"/></svg>',
  'dots-and-boxes': '<svg viewBox="0 0 100 100" stroke-linecap="round"><g fill="var(--ink-2)"><circle cx="15" cy="15" r="5"/><circle cx="50" cy="15" r="5"/><circle cx="85" cy="15" r="5"/><circle cx="15" cy="50" r="5"/><circle cx="50" cy="50" r="5"/><circle cx="85" cy="50" r="5"/><circle cx="15" cy="85" r="5"/><circle cx="50" cy="85" r="5"/><circle cx="85" cy="85" r="5"/></g><path d="M15 15h35v35h-35z" fill="var(--p1)" opacity=".35" stroke="var(--p1)" stroke-width="5"/><path d="M50 50h35M85 50v35" stroke="var(--p2)" stroke-width="5"/></svg>',
  'math-duel': '<svg viewBox="0 0 100 100"><text x="50" y="64" text-anchor="middle" font-family="var(--font-display)" font-weight="700" font-size="46" fill="var(--accent)">24</text><text x="18" y="30" font-size="18" fill="var(--p1)" font-weight="700">+</text><text x="70" y="30" font-size="18" fill="var(--p2)" font-weight="700">×</text></svg>',
  go: '<svg viewBox="0 0 100 100"><path d="M20 20h60M20 50h60M20 80h60M20 20v60M50 20v60M80 20v60" stroke="var(--ink-2)" stroke-width="2" opacity=".6"/><circle cx="50" cy="50" r="13" fill="var(--p2)"/><circle cx="80" cy="20" r="13" fill="var(--sq-light)"/></svg>',
};

export function tileIcon(gameId) {
  return TILE_ICONS[gameId] || TILE_ICONS.go;
}
