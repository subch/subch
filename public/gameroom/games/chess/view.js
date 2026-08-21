// Chess view: cburnett pieces from the generated sprite, tap-select with
// legal-move hints (option), promotion picker, check highlight. All rules
// come from the engine (vendored chess.js underneath).
import { CHESS_SPRITE } from './sprite.js';
import { boardOf, checkedSquare } from '/shared/games/chess/engine.js';
import { h, sheet } from '/app/ui.js';

const FILES = 'abcdefgh';
const sqIdx = (name) => (8 - Number(name[1])) * 8 + FILES.indexOf(name[0]);

const CSS = `
.chessv .board { grid-template-columns: repeat(8, 1fr); width: 100%; }
.chessv .sq { border: none; padding: 0; }
.chessv .sq.from, .chessv .sq.hint { cursor: pointer; }
.chessv .pc { inset: 3%; }
.chessv .pc svg { filter: drop-shadow(0 3px 2px rgba(0,0,0,.35)); }
.chessv .pc.settle { animation: chsettle .18s cubic-bezier(.2,.8,.2,1); }
@keyframes chsettle { from { transform: translateY(-10%) scale(1.05); } }
.chessv .sq.check { box-shadow: inset 0 0 0 100px color-mix(in srgb, var(--accent-2) 35%, transparent); animation: checkbreathe 1s ease-in-out 2; }
@keyframes checkbreathe { 0%,100% { box-shadow: inset 0 0 0 100px color-mix(in srgb, var(--accent-2) 35%, transparent); }
  50% { box-shadow: inset 0 0 0 100px color-mix(in srgb, var(--accent-2) 55%, transparent); } }
:root[data-theme="arcade"] .chessv .pc svg { filter: drop-shadow(0 0 7px color-mix(in srgb, var(--accent) 60%, transparent)); }
.promo { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); box-shadow: var(--shadow); padding: 22px; display: grid; gap: 14px; text-align: center; }
.promo h3 { margin: 0; }
.promo .row { display: flex; gap: 10px; }
.promo button { width: 72px; height: 72px; border-radius: var(--radius-s); background: var(--surface-2); border: 1px solid var(--line); box-shadow: inset 0 -3px 0 rgba(0,0,0,.15); display: grid; place-items: center; }
.promo button svg { width: 56px; height: 56px; }
`;

export function mount(rootEl, ctx) {
  if (!document.querySelector('style[data-chess]')) {
    const style = document.createElement('style');
    style.dataset.chess = '';
    style.textContent = CSS;
    document.head.appendChild(style);
  }
  if (!document.querySelector('.chess-sprite')) {
    document.body.insertAdjacentHTML('afterbegin', CHESS_SPRITE);
  }

  const showLegal = ctx.options?.showLegal !== false;

  let cellsHtml = '';
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const dark = (r + c) % 2 === 1;
      const coord = (r === 7 ? `<span class="coord f">${FILES[c]}</span>` : '') +
                    (c === 0 ? `<span class="coord r">${8 - r}</span>` : '');
      cellsHtml += `<button class="sq${dark ? ' d' : ''}" data-i="${r * 8 + c}">${coord}</button>`;
    }
  }
  rootEl.innerHTML = `<div class="chessv"><div class="board" aria-label="chess board">${cellsHtml}</div></div>`;
  const cells = [...rootEl.querySelectorAll('.sq')];

  let cur = null;
  let legal = [];
  let board = [];
  let sel = null; // square index
  let lastFromTo = [];

  const myTurn = () => cur && ctx.localSeats.includes(cur.turn);
  const pieceGlyph = (p) =>
    `<svg viewBox="0 0 45 45"><use href="#cb-${p.t}${p.c === 'w' ? 'l' : 'd'}"></use></svg>`;

  function movesFromSel() {
    if (sel === null) return [];
    return legal.filter((m) => sqIdx(m.from) === sel);
  }

  function paint() {
    const froms = new Set(legal.map((m) => sqIdx(m.from)));
    if (sel !== null && !froms.has(sel)) sel = null;
    const hints = showLegal ? new Set(movesFromSel().map((m) => sqIdx(m.to))) : new Set();
    const checkSq = checkedSquare(cur);
    const checkIdx = checkSq ? sqIdx(checkSq) : -1;

    cells.forEach((sq, i) => {
      const p = board[i];
      const key = p ? p.t + p.c : '';
      if (sq.dataset.pc !== key) {
        sq.dataset.pc = key;
        sq.querySelector('.pc')?.remove();
        if (p) sq.insertAdjacentHTML('beforeend', `<div class="pc settle">${pieceGlyph(p)}</div>`);
      }
      sq.classList.toggle('sel', sel === i);
      sq.querySelector('.pc')?.classList.toggle('lift', sel === i);
      sq.classList.toggle('hint', hints.has(i));
      sq.classList.toggle('from', myTurn() && froms.has(i));
      sq.classList.toggle('last', lastFromTo.includes(i));
      sq.classList.toggle('check', checkIdx === i);
    });
  }

  function pickPromotion(color) {
    return new Promise((resolve) => {
      const el = h(`
        <div class="promo">
          <h3>Promote to…</h3>
          <div class="row">
            ${['q', 'r', 'n', 'b'].map((t) => `
              <button data-p="${t}"><svg viewBox="0 0 45 45"><use href="#cb-${t}${color}"></use></svg></button>`).join('')}
          </div>
        </div>`);
      const { close } = sheet(el, { dismissable: false });
      el.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-p]');
        if (btn) { close(); resolve(btn.dataset.p); }
      });
    });
  }

  rootEl.addEventListener('click', async (e) => {
    const sq = e.target.closest('.sq');
    if (!sq || !cur || !myTurn()) return;
    const i = Number(sq.dataset.i);
    const froms = new Set(legal.map((m) => sqIdx(m.from)));
    if (froms.has(i)) {
      sel = sel === i ? null : i;
      paint();
      return;
    }
    const options = movesFromSel().filter((m) => sqIdx(m.to) === i);
    if (options.length) {
      let move = options[0];
      if (options.some((m) => m.promotion)) {
        const p = await pickPromotion(board[sel].c === 'w' ? 'l' : 'd');
        move = options.find((m) => m.promotion === p) || options[0];
      }
      ctx.onMove(move);
      return;
    }
    sel = null;
    paint();
  });

  function update(state, legalMoves, lastMove) {
    cur = state;
    legal = legalMoves;
    board = boardOf(state);
    if (lastMove && lastMove.type === 'move') {
      lastFromTo = [sqIdx(lastMove.from), sqIdx(lastMove.to)];
      sel = null;
    } else if (!lastMove) {
      lastFromTo = [];
      sel = null;
    }
    paint();
  }

  return { update, destroy() { rootEl.innerHTML = ''; } };
}
