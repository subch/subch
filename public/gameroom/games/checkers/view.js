// Checkers view. Tap a piece → it lifts and the landing squares pulse; tap a
// pulsing square to move. Multi-jumps keep the jumping piece locked and
// selected. Rules stay in the engine; this only paints state + legal moves.
import { checker, disc } from '/app/pieces.js';

const CSS = `
.ckv { display: grid; gap: 10px; width: 100%; }
/* min-width:0 everywhere: otherwise long tray content stretches the grid and
   the BOARD resizes mid-game (the owner's phone bug) */
.ckv > * { min-width: 0; }
.ckv .board { grid-template-columns: repeat(8, 1fr); width: 100%; max-width: 100%; }
.ckv .sq { border: none; padding: 0; cursor: default; }
.ckv .sq.from { cursor: pointer; }
.ckv .sq.hint { cursor: pointer; }
.ckv .pc.settle { animation: cksettle .2s cubic-bezier(.2,.8,.2,1); }
@keyframes cksettle { from { transform: translateY(-14%) scale(1.06); } }
.ck-trays { display: flex; justify-content: space-between; gap: 10px; height: 26px; }
.ck-tray { display: flex; align-items: center; gap: 4px; flex: 1 1 0; min-width: 0;
  overflow: hidden; white-space: nowrap;
  font: 700 12px var(--font-body); color: var(--ink); text-shadow: 0 1px 3px rgba(0,0,0,.4); }
.ck-tray:last-child { justify-content: flex-end; }
:root[data-theme="candy"] .ck-tray { text-shadow: none; }
.ck-tray i { width: 18px; height: 18px; display: block; }
.ck-tray svg { width: 100%; height: 100%; overflow: visible; }
`;

export function mount(rootEl, ctx) {
  if (!document.querySelector('style[data-checkers]')) {
    const style = document.createElement('style');
    style.dataset.checkers = '';
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  // On a device that only owns seat 1, rotate the board so that player sits
  // at the bottom (nobody plays upside-down on their own phone).
  const flip = ctx.localSeats.length === 1 && ctx.localSeats[0] === 1;
  const files = 'abcdefgh';
  let cellsHtml = '';
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const i = flip ? 63 - (r * 8 + c) : r * 8 + c;
      const dark = (r + c) % 2 === 1;
      const coord = (r === 7 ? `<span class="coord f">${files[i % 8]}</span>` : '') +
                    (c === 0 ? `<span class="coord r">${8 - ((i / 8) | 0)}</span>` : '');
      cellsHtml += `<button class="sq${dark ? ' d' : ''}" data-i="${i}">${coord}</button>`;
    }
  }
  rootEl.innerHTML = `
    <div class="ckv">
      <div class="ck-trays">
        <div class="ck-tray" data-tray="0"></div>
        <div class="ck-tray" data-tray="1"></div>
      </div>
      <div class="board" aria-label="checkers board">${cellsHtml}</div>
    </div>`;
  const cells = [...rootEl.querySelectorAll('.sq')];

  let cur = null;
  let legal = [];
  let sel = null;
  let lastFromTo = [];

  const myTurn = () => cur && ctx.localSeats.includes(cur.turn);

  function paint() {
    const froms = new Set(legal.map((m) => m.from));
    if (sel !== null && !froms.has(sel)) sel = null;
    if (cur.phase === 'continue' && froms.size === 1) sel = [...froms][0];
    const hints = sel === null ? new Set()
      : new Set(legal.filter((m) => m.from === sel).map((m) => m.to));

    cells.forEach((sq) => {
      const i = Number(sq.dataset.i); // display order may be flipped
      const piece = cur.board[i];
      const key = piece ? `${piece.p}${piece.k ? 'k' : ''}` : '';
      if (sq.dataset.pc !== key) {
        sq.dataset.pc = key;
        sq.querySelector('.pc')?.remove();
        if (piece) {
          sq.insertAdjacentHTML('beforeend',
            `<div class="pc settle">${checker(piece.p, piece.k)}</div>`);
        }
      }
      sq.classList.toggle('sel', sel === i);
      sq.querySelector('.pc')?.classList.toggle('lift', sel === i);
      sq.classList.toggle('hint', hints.has(i));
      sq.classList.toggle('from', myTurn() && froms.has(i));
      sq.classList.toggle('last', lastFromTo.includes(i));
    });

    for (const seat of [0, 1]) {
      const captured = 12 - cur.board.filter((p) => p && p.p === (1 - seat)).length;
      const tray = rootEl.querySelector(`[data-tray="${seat}"]`);
      const name = ctx.players[seat].name;
      tray.innerHTML = captured === 0
        ? `<span style="opacity:.6">${name}: no captures yet</span>`
        : `<span>${name} ×${captured}</span>` +
          Array.from({ length: Math.min(captured, 6) }, () => `<i>${disc(1 - seat)}</i>`).join('');
    }
  }

  rootEl.addEventListener('click', (e) => {
    const sq = e.target.closest('.sq');
    if (!sq || !cur || !myTurn()) return;
    const i = Number(sq.dataset.i);
    const froms = new Set(legal.map((m) => m.from));
    if (froms.has(i)) {
      sel = sel === i && cur.phase !== 'continue' ? null : i;
      paint();
      return;
    }
    if (sel !== null && legal.some((m) => m.from === sel && m.to === i)) {
      ctx.onMove({ type: 'move', from: sel, to: i });
      return;
    }
    if (cur.phase !== 'continue') { sel = null; paint(); }
  });

  function update(state, legalMoves, lastMove) {
    cur = state;
    legal = legalMoves;
    if (lastMove && lastMove.type === 'move') {
      lastFromTo = [lastMove.from, lastMove.to];
      sel = null;
    } else if (!lastMove) {
      lastFromTo = [];
      sel = null;
    }
    paint();
  }

  return { update, destroy() { rootEl.innerHTML = ''; } };
}
