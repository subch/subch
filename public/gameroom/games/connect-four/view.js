// Connect Four view: tap a column, the disc falls from above the frame with
// a visible bounce (plan §6b). The winning four glow.
import { disc } from '/app/pieces.js';

const CSS = `
.c4v { width: 100%; }
.c4-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; padding: 10px;
  border-radius: 12px; background-color: var(--rail);
  background-image: var(--grain), linear-gradient(135deg, var(--rail-2), var(--rail-edge));
  background-blend-mode: multiply, normal; background-size: 400px 120px, auto;
  box-shadow: 0 10px 24px rgba(0,0,0,.4), inset 0 1px 0 rgba(255,255,255,.15); }
.c4-hole { position: relative; aspect-ratio: 1; border-radius: 50%; border: none; padding: 0; cursor: pointer;
  background: radial-gradient(circle at 50% 60%, color-mix(in srgb, var(--rail-edge) 60%, #000), color-mix(in srgb, var(--rail-edge) 30%, #000));
  box-shadow: inset 0 3px 6px rgba(0,0,0,.6); }
.c4-hole .pcd { position: absolute; inset: 7%; }
.c4-hole .pcd svg { width: 100%; height: 100%; overflow: visible; }
.c4-hole .pcd.fall { animation: c4drop .55s cubic-bezier(.3,1.4,.5,1); }
.c4-hole.winhl { animation: c4win .7s ease-in-out 3; }
@keyframes c4drop { from { transform: translateY(calc(-110% * var(--rows, 6))); } to { transform: translateY(0); } }
@keyframes c4win { 0%,100% { box-shadow: inset 0 3px 6px rgba(0,0,0,.6), 0 0 0 0 transparent; }
  50% { box-shadow: inset 0 3px 6px rgba(0,0,0,.6), 0 0 14px 4px var(--accent); } }
:root[data-theme="candy"] .c4-grid { background-image: none; }
`;

export function mount(rootEl, ctx) {
  if (!document.querySelector('style[data-c4]')) {
    const style = document.createElement('style');
    style.dataset.c4 = '';
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  let cellsHtml = '';
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 7; c++) {
      cellsHtml += `<button class="c4-hole" data-i="${r * 7 + c}" data-col="${c}" aria-label="column ${c + 1}"></button>`;
    }
  }
  rootEl.innerHTML = `<div class="c4v"><div class="c4-grid">${cellsHtml}</div></div>`;
  const holes = [...rootEl.querySelectorAll('.c4-hole')];

  let cur = null;
  let legal = [];

  rootEl.addEventListener('click', (e) => {
    const hole = e.target.closest('.c4-hole');
    if (!hole || !cur || !ctx.localSeats.includes(cur.turn)) return;
    const col = Number(hole.dataset.col);
    if (legal.some((m) => m.col === col)) ctx.onMove({ type: 'drop', col });
  });

  function update(state, legalMoves, lastMove, status) {
    cur = state;
    legal = legalMoves;
    const lastCell = lastMove && lastMove.type === 'drop'
      ? (() => {
          // the disc that just landed is the highest filled cell in that column
          for (let r = 0; r < 6; r++) {
            if (state.board[r * 7 + lastMove.col] !== null) return r * 7 + lastMove.col;
          }
          return -1;
        })()
      : -1;

    holes.forEach((hole, i) => {
      const p = state.board[i];
      const key = p === null ? '' : String(p);
      if (hole.dataset.pc !== key) {
        hole.dataset.pc = key;
        hole.querySelector('.pcd')?.remove();
        if (p !== null) {
          const row = (i / 7) | 0;
          hole.insertAdjacentHTML('beforeend',
            `<div class="pcd ${i === lastCell ? 'fall' : ''}" style="--rows:${row + 1}">${disc(p)}</div>`);
        }
      }
      hole.classList.toggle('winhl', !!status?.line && status.line.includes(i));
    });
  }

  return { update, destroy() { rootEl.innerHTML = ''; } };
}
