// Memory Match view: a grid of card backs; taps flip, pairs stay claimed in
// the finder's color. After a miss the mismatched pair lingers face-up for a
// beat before this view sends {type:'continue'} (presentation timing only —
// the engine owns the rules).
import { cardFace, cardBack } from '/app/pieces.js';

const RANK_NAMES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const SUIT_LETTER = 'shdc';

const CSS = `
.rail.cards { background: none; box-shadow: none; padding: 0; width: min(100%, 640px); }
.mm { display: grid; gap: 12px; width: 100%; }
.mm-scores { display: flex; justify-content: center; gap: 16px; font: 700 14px var(--font-body); color: var(--ink); flex-wrap: wrap; text-shadow: 0 1px 3px rgba(0,0,0,.35); }
:root[data-theme="candy"] .mm-scores { text-shadow: none; }
.mm-scores .on { color: var(--accent); }
.mm-grid { display: grid; gap: 8px; }
.mm-cell { position: relative; border: none; padding: 0; background: none; cursor: pointer;
  aspect-ratio: 5/7; perspective: 600px; }
.mm-cell .inner { position: absolute; inset: 0; transform-style: preserve-3d; transition: transform .3s cubic-bezier(.2,.8,.2,1); }
.mm-cell.up .inner { transform: rotateY(180deg); }
.mm-cell .side { position: absolute; inset: 0; backface-visibility: hidden; border-radius: 8px; overflow: hidden;
  box-shadow: 0 3px 8px rgba(0,0,0,.35), 0 0 0 1px rgba(0,0,0,.18); }
.mm-cell .front { transform: rotateY(180deg); background: var(--card-face); }
.mm-cell .side svg { width: 100%; height: 100%; display: block; }
.mm-cell.owned { cursor: default; }
.mm-cell.owned .front { opacity: .75; }
.mm-cell.owned::after { content: ""; position: absolute; inset: -3px; border-radius: 10px;
  border: 3px solid var(--own-color, var(--accent)); pointer-events: none; }
.mm-cell.miss .inner { animation: mmshake .3s; }
@keyframes mmshake { 0%,100% { transform: rotateY(180deg) translateX(0) } 33% { transform: rotateY(180deg) translateX(-4px) } 66% { transform: rotateY(180deg) translateX(4px) } }
@media (prefers-reduced-motion: reduce) { .mm-cell .inner { transition: none; } }
`;

export function mount(rootEl, ctx) {
  if (!document.querySelector('style[data-mm]')) {
    const style = document.createElement('style');
    style.dataset.mm = '';
    style.textContent = CSS;
    document.head.appendChild(style);
  }
  rootEl.closest('.rail')?.classList.add('cards');

  let cur = null;
  let legal = [];
  let built = false;
  let continueTimer = null;
  let continueKey = '';

  function build(state) {
    const n = state.cells.length;
    const cols = n <= 12 ? 4 : n <= 20 ? 5 : 6;
    rootEl.innerHTML = `
      <div class="mm">
        <div class="mm-scores" data-scores></div>
        <div class="mm-grid" style="grid-template-columns:repeat(${cols},1fr)">
          ${state.cells.map((_, i) => `
            <button class="mm-cell" data-i="${i}">
              <span class="inner">
                <span class="side back">${cardBack()}</span>
                <span class="side front" data-face></span>
              </span>
            </button>`).join('')}
        </div>
      </div>`;
    built = true;
  }

  rootEl.addEventListener('click', (e) => {
    const cell = e.target.closest('.mm-cell');
    if (!cell || !cur || !ctx.localSeats.includes(cur.turn)) return;
    const i = Number(cell.dataset.i);
    if (legal.some((m) => m.type === 'flip' && m.cell === i)) {
      ctx.onMove({ type: 'flip', cell: i });
    }
  });

  function update(state, legalMoves) {
    cur = state;
    legal = legalMoves;
    if (!built) build(state);

    for (const cell of rootEl.querySelectorAll('.mm-cell')) {
      const i = Number(cell.dataset.i);
      const owned = state.owner[i] !== null;
      const up = owned || state.up.includes(i);
      cell.classList.toggle('up', up);
      cell.classList.toggle('owned', owned);
      cell.classList.toggle('miss', state.phase === 'memorize' && state.up.includes(i));
      if (owned) {
        cell.style.setProperty('--own-color', ctx.players[state.owner[i]]?.color || 'var(--accent)');
      }
      const face = cell.querySelector('[data-face]');
      if (up && !face.dataset.done) {
        const r = state.cells[i];
        face.innerHTML = cardFace(RANK_NAMES[r], SUIT_LETTER[r % 4]);
        face.dataset.done = '1';
      } else if (!up && face.dataset.done) {
        face.innerHTML = '';
        delete face.dataset.done;
      }
    }

    rootEl.querySelector('[data-scores]').innerHTML = ctx.players.map((p) =>
      `<span class="${state.turn === p.seat && legalMoves.length ? 'on' : ''}">${p.name}: ${state.scores[p.seat]}</span>`).join('');

    // linger on a miss, then continue (only the acting device sends it)
    const key = `${state.turn}:${state.up.join(',')}`;
    if (state.phase === 'memorize' && ctx.localSeats.includes(state.turn) && key !== continueKey) {
      continueKey = key;
      clearTimeout(continueTimer);
      continueTimer = setTimeout(() => {
        if (cur?.phase === 'memorize') ctx.onMove({ type: 'continue' });
      }, 1300);
    }
  }

  return {
    update,
    destroy() {
      clearTimeout(continueTimer);
      rootEl.closest('.rail')?.classList.remove('cards');
      rootEl.innerHTML = '';
    },
  };
}
