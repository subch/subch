// Tic-tac-toe view: taps → onMove, rules stay in the engine. X and O draw on
// with a 200ms stroke animation; the winning line pulses.
const CSS = `
.board.ttt { gap: 10px; background: transparent; box-shadow: none; aspect-ratio: 1; padding: 2px; }
.ttt .sq { border-radius: var(--radius-s); background: var(--sq-light); border: none; cursor: pointer;
  box-shadow: inset 0 0 0 1px rgba(0,0,0,.25), inset 0 -5px 0 rgba(0,0,0,.12); }
.ttt .sq:active { transform: scale(.97); }
.ttt .mark { position: absolute; inset: 12%; pointer-events: none; }
/* base state is FULLY DRAWN — the animation only plays the draw-on effect,
   so reduced-motion devices (and anything that skips animations) still see
   the marks. Never gate visibility on an animation finishing. */
.ttt .mark path, .ttt .mark circle { fill: none; stroke-width: 9; stroke-linecap: round;
  stroke-dasharray: 300; stroke-dashoffset: 0; animation: tttdraw .2s ease-out; }
.ttt .mark.x path { stroke: var(--p1); }
.ttt .mark.o circle { stroke: var(--p2); }
.ttt .mark.x path:nth-child(2) { animation-duration: .32s; }
:root[data-theme="arcade"] .ttt .mark.x path { filter: drop-shadow(0 0 8px var(--p1)); }
:root[data-theme="arcade"] .ttt .mark.o circle { filter: drop-shadow(0 0 8px var(--p2)); }
@keyframes tttdraw { from { stroke-dashoffset: 300; } }
`;

const X = '<svg class="mark x" viewBox="0 0 100 100"><path d="M18 18 L82 82"/><path d="M82 18 L18 82"/></svg>';
const O = '<svg class="mark o" viewBox="0 0 100 100"><circle cx="50" cy="50" r="34"/></svg>';

export function mount(rootEl, ctx) {
  if (!document.querySelector('style[data-ttt]')) {
    const style = document.createElement('style');
    style.dataset.ttt = '';
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  rootEl.innerHTML = `
    <div class="board ttt" style="grid-template-columns:repeat(3,1fr)">
      ${Array.from({ length: 9 }, (_, i) => `<button class="sq" data-cell="${i}" aria-label="square ${i + 1}"></button>`).join('')}
    </div>`;
  const cells = [...rootEl.querySelectorAll('.sq')];
  let currentState = null;
  let currentLegal = [];

  rootEl.addEventListener('click', (e) => {
    const sq = e.target.closest('.sq');
    if (!sq || !currentState) return;
    if (!ctx.localSeats.includes(currentState.turn)) return;
    const cell = Number(sq.dataset.cell);
    if (currentLegal.some((m) => m.cell === cell)) {
      ctx.onMove({ type: 'place', cell });
    }
  });

  function update(state, legalMoves, lastMove, status) {
    currentState = state;
    currentLegal = legalMoves;
    cells.forEach((sq, i) => {
      const mark = state.board[i];
      const want = mark === null ? '' : mark === 0 ? X : O;
      const key = mark === null ? '' : String(mark);
      if (sq.dataset.mark !== key) {
        sq.dataset.mark = key;
        sq.innerHTML = want;
      }
      sq.classList.toggle('last', !!lastMove && lastMove.cell === i);
      sq.classList.toggle('win', !!status?.line && status.line.includes(i));
    });
  }

  return { update, destroy() { rootEl.innerHTML = ''; } };
}
