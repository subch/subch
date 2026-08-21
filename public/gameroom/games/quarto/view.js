// Quarto view. Give phase: tap a tray piece to hand it over — it floats
// above the board until the opponent places it. Place phase: tap any empty
// recess. The winning four glow.
import { quarto } from '/app/pieces.js';
import { isTall, isDark, isRound, isHollow, traitsOf } from '/shared/games/quarto/engine.js';

const pieceSvg = (p) => quarto(isTall(p), isDark(p), isRound(p), isHollow(p));

const CSS = `
.rail.qrail { width: auto; max-width: 100%; }
.qv { display: grid; grid-template-columns: minmax(0, calc(100dvh - 385px)) 168px; gap: 14px; align-items: start; }
.qv-side { display: grid; gap: 12px; }
@media (max-width: 820px) {
  .qv { grid-template-columns: 1fr; }
  .qv-side { order: -1; }
}
.qv-given { display: flex; align-items: center; justify-content: center; gap: 14px; min-height: 96px; }
.qv-given .qp { width: 64px; height: 84px; filter: drop-shadow(0 16px 12px rgba(0,0,0,.45)); animation: qfloat 1.6s ease-in-out infinite; }
.qv-given .qp svg { width: 100%; height: 100%; overflow: visible; }
.qv-given .lbl { font: 700 14px var(--font-body); color: var(--ink); text-shadow: 0 1px 3px rgba(0,0,0,.4); max-width: 180px; }
:root[data-theme="candy"] .qv-given .lbl { text-shadow: none; }
@keyframes qfloat { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-6px) } }
.qv .board { grid-template-columns: repeat(4, 1fr); width: 100%; }
.qv .sq { border: none; padding: 0; background: var(--sq-light); }
.qv .sq::before { content: ""; position: absolute; inset: 12%; border-radius: 50%;
  background: radial-gradient(circle at 50% 42%, rgba(0,0,0,.28), rgba(0,0,0,.1) 65%, transparent 72%);
  box-shadow: inset 0 2px 5px rgba(0,0,0,.3); }
.qv .sq.hint::before { inset: 12%; }
.qv .pc { inset: 4%; }
.qv .sq.win { animation: winpulse .7s ease-in-out 3; }
.qv-tray { display: flex; flex-wrap: wrap; gap: 4px; justify-content: center; padding: 10px;
  border-radius: var(--radius-s); background: color-mix(in srgb, var(--rail-edge) 40%, transparent); }
.qv-tray button { width: 44px; height: 58px; border: none; padding: 0; background: none; cursor: default; border-radius: 8px; }
.qv-tray button svg { width: 100%; height: 100%; overflow: visible; }
.qv-tray.picking button { cursor: pointer; }
.qv-tray.picking button:hover, .qv-tray.picking button:focus-visible { background: color-mix(in srgb, var(--accent) 25%, transparent); }
`;

export function mount(rootEl, ctx) {
  if (!document.querySelector('style[data-quarto]')) {
    const style = document.createElement('style');
    style.dataset.quarto = '';
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  rootEl.closest('.rail')?.classList.add('qrail');
  rootEl.innerHTML = `
    <div class="qv">
      <div class="board" aria-label="quarto board">
        ${Array.from({ length: 16 }, (_, i) => `<button class="sq" data-i="${i}"></button>`).join('')}
      </div>
      <div class="qv-side">
        <div class="qv-given" data-given></div>
        <div class="qv-tray" data-tray></div>
      </div>
    </div>`;
  const cells = [...rootEl.querySelectorAll('.sq')];
  const givenEl = rootEl.querySelector('[data-given]');
  const trayEl = rootEl.querySelector('[data-tray]');

  let cur = null;
  let legal = [];

  const myTurn = () => cur && ctx.localSeats.includes(cur.turn);

  rootEl.addEventListener('click', (e) => {
    if (!cur || !myTurn()) return;
    const tray = e.target.closest('[data-piece]');
    if (tray && cur.phase === 'give') {
      ctx.onMove({ type: 'give', piece: Number(tray.dataset.piece) });
      return;
    }
    const sq = e.target.closest('.sq');
    if (sq && cur.phase === 'place') {
      const cell = Number(sq.dataset.i);
      if (legal.some((m) => m.cell === cell)) ctx.onMove({ type: 'place', cell });
    }
  });

  function update(state, legalMoves, lastMove, status) {
    cur = state;
    legal = legalMoves;
    const over = !!status?.over;

    cells.forEach((sq, i) => {
      const p = state.board[i];
      const key = p === null ? '' : String(p);
      if (sq.dataset.pc !== key) {
        sq.dataset.pc = key;
        sq.querySelector('.pc')?.remove();
        if (p !== null) sq.insertAdjacentHTML('beforeend', `<div class="pc">${pieceSvg(p)}</div>`);
      }
      sq.classList.toggle('hint', !over && state.phase === 'place' && myTurn() && p === null);
      sq.classList.toggle('last', lastMove?.type === 'place' && lastMove.cell === i);
      sq.classList.toggle('win', !!status?.line && status.line.includes(i));
    });

    if (state.given !== null) {
      const placer = ctx.players[state.turn];
      givenEl.innerHTML = `
        <div class="qp">${pieceSvg(state.given)}</div>
        <div class="lbl">${placer.name} must place the ${traitsOf(state.given)} piece</div>`;
    } else if (!over) {
      const giver = ctx.players[state.turn];
      const other = ctx.players[1 - state.turn];
      givenEl.innerHTML = `<div class="lbl">${giver.name} picks the piece ${other.name} must play</div>`;
    } else {
      givenEl.innerHTML = '';
    }

    const picking = !over && state.phase === 'give' && myTurn();
    trayEl.classList.toggle('picking', picking);
    trayEl.innerHTML = state.remaining.map((p) =>
      `<button data-piece="${p}" title="${traitsOf(p)}" aria-label="${traitsOf(p)}">${pieceSvg(p)}</button>`).join('');
  }

  return {
    update,
    destroy() {
      rootEl.closest('.rail')?.classList.remove('qrail');
      rootEl.innerHTML = '';
    },
  };
}
