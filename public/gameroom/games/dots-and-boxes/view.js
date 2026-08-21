// Dots & Boxes view: one SVG, fat invisible tap targets on every undrawn
// edge (≥44px), drawn edges in the drawer's color, claimed boxes tinted with
// the owner's initial.
const CSS = `
.dbv { display: grid; gap: 10px; width: 100%; }
.db-scores { display: flex; justify-content: center; gap: 18px; font: 700 15px var(--font-body); color: var(--ink); text-shadow: 0 1px 3px rgba(0,0,0,.35); }
:root[data-theme="candy"] .db-scores { text-shadow: none; }
.db-scores i { display: inline-block; width: 12px; height: 12px; border-radius: 3px; margin-right: 6px; }
.db-paper { background: var(--sq-light); border-radius: 8px; box-shadow: inset 0 0 0 1px rgba(0,0,0,.25), inset 0 -6px 14px rgba(0,0,0,.12); }
.dbv svg { width: 100%; height: auto; display: block; }
.dbv .dot { fill: var(--ink-2); }
.dbv .hit { stroke: transparent; stroke-width: 44; cursor: pointer; pointer-events: stroke; }
.dbv .ghost { stroke: var(--sq-dark); stroke-width: 6; stroke-linecap: round; opacity: .18; pointer-events: none; }
.dbv .edge { stroke-width: 7; stroke-linecap: round; pointer-events: none; }
.dbv .edge.fresh { stroke-dasharray: 130; stroke-dashoffset: 130; animation: dbdraw .18s ease-out forwards; }
@keyframes dbdraw { to { stroke-dashoffset: 0; } }
.dbv .boxfill { opacity: .35; }
.dbv .boxtag { font: 700 34px var(--font-display); text-anchor: middle; fill: #fff; paint-order: stroke; stroke: rgba(0,0,0,.35); stroke-width: 2px; }
`;

export function mount(rootEl, ctx) {
  if (!document.querySelector('style[data-db]')) {
    const style = document.createElement('style');
    style.dataset.db = '';
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  let cur = null;
  let built = false;
  let svg = null;

  const P = 30; // padding
  const U = 100;

  function build(n) {
    const size = n * U + P * 2;
    let dots = '';
    for (let r = 0; r <= n; r++) {
      for (let c = 0; c <= n; c++) {
        dots += `<circle class="dot" cx="${P + c * U}" cy="${P + r * U}" r="6"/>`;
      }
    }
    let hits = '';
    for (let r = 0; r <= n; r++) {
      for (let c = 0; c < n; c++) {
        const i = r * n + c;
        hits += `<line class="ghost" data-g="h${i}" x1="${P + c * U + 12}" y1="${P + r * U}" x2="${P + (c + 1) * U - 12}" y2="${P + r * U}"/>`;
        hits += `<line class="hit" data-o="h" data-i="${i}" x1="${P + c * U}" y1="${P + r * U}" x2="${P + (c + 1) * U}" y2="${P + r * U}"/>`;
      }
    }
    for (let r = 0; r < n; r++) {
      for (let c = 0; c <= n; c++) {
        const i = r * (n + 1) + c;
        hits += `<line class="ghost" data-g="v${i}" x1="${P + c * U}" y1="${P + r * U + 12}" x2="${P + c * U}" y2="${P + (r + 1) * U - 12}"/>`;
        hits += `<line class="hit" data-o="v" data-i="${i}" x1="${P + c * U}" y1="${P + r * U}" x2="${P + c * U}" y2="${P + (r + 1) * U}"/>`;
      }
    }
    rootEl.innerHTML = `
      <div class="dbv">
        <div class="db-scores" data-scores></div>
        <div class="db-paper">
          <svg viewBox="0 0 ${size} ${size}">
            <g data-boxes></g>
            <g data-edges></g>
            ${dots}
            ${hits}
          </svg>
        </div>
      </div>`;
    svg = rootEl.querySelector('svg');
    built = true;
  }

  rootEl.addEventListener('click', (e) => {
    const hit = e.target.closest('.hit');
    if (!hit || !cur || !ctx.localSeats.includes(cur.turn)) return;
    const o = hit.dataset.o, i = Number(hit.dataset.i);
    if (cur[o][i] === null) ctx.onMove({ type: 'edge', o, i });
  });

  const color = (seat) => ctx.players[seat]?.color || 'var(--accent)';

  function update(state, legalMoves, lastMove) {
    cur = state;
    if (!built) build(state.n);
    const n = state.n;

    // drawn edges
    const edgesEl = svg.querySelector('[data-edges]');
    let edges = '';
    state.h.forEach((owner, i) => {
      if (owner === null) return;
      const r = Math.floor(i / n), c = i % n;
      const fresh = lastMove?.o === 'h' && lastMove?.i === i;
      edges += `<line class="edge ${fresh ? 'fresh' : ''}" stroke="${color(owner)}" x1="${P + c * U}" y1="${P + r * U}" x2="${P + (c + 1) * U}" y2="${P + r * U}"/>`;
    });
    state.v.forEach((owner, i) => {
      if (owner === null) return;
      const r = Math.floor(i / (n + 1)), c = i % (n + 1);
      const fresh = lastMove?.o === 'v' && lastMove?.i === i;
      edges += `<line class="edge ${fresh ? 'fresh' : ''}" stroke="${color(owner)}" x1="${P + c * U}" y1="${P + r * U}" x2="${P + c * U}" y2="${P + (r + 1) * U}"/>`;
    });
    edgesEl.innerHTML = edges;

    // ghosts only where undrawn
    state.h.forEach((owner, i) => {
      svg.querySelector(`[data-g="h${i}"]`)?.setAttribute('opacity', owner === null ? '' : '0');
    });
    state.v.forEach((owner, i) => {
      svg.querySelector(`[data-g="v${i}"]`)?.setAttribute('opacity', owner === null ? '' : '0');
    });

    // claimed boxes
    const boxesEl = svg.querySelector('[data-boxes]');
    let boxes = '';
    state.boxes.forEach((owner, i) => {
      if (owner === null) return;
      const r = Math.floor(i / n), c = i % n;
      const x = P + c * U, y = P + r * U;
      boxes += `<rect class="boxfill" fill="${color(owner)}" x="${x + 5}" y="${y + 5}" width="${U - 10}" height="${U - 10}" rx="8"/>` +
        `<text class="boxtag" x="${x + U / 2}" y="${y + U / 2 + 12}">${(ctx.players[owner]?.name || '?')[0]}</text>`;
    });
    boxesEl.innerHTML = boxes;

    // score row
    const scores = Array(state.players).fill(0);
    for (const b of state.boxes) if (b !== null) scores[b] += 1;
    rootEl.querySelector('[data-scores]').innerHTML = ctx.players.map((p) =>
      `<span><i style="background:${p.color || '#888'}"></i>${p.name} ${scores[p.seat]}</span>`).join('');
  }

  return { update, destroy() { rootEl.innerHTML = ''; } };
}
