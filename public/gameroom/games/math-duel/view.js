// Math Duel view: Quick Fire numpad + dot hints for level 1; Make 24 card
// builder with running total. Gates between rounds pass the tablet.
import { evalExpr } from '/shared/games/math-duel/engine.js';

const CSS = `
.rail.mdrail { background: none; box-shadow: none; padding: 0; width: min(100%, 560px); }
.rail.mdrail::before, .rail.mdrail::after { display: none; }
.mdv { display: grid; gap: 14px; width: 100%; }
.md-scores { display: flex; justify-content: center; gap: 16px; font: 700 14px var(--font-body); color: var(--ink); flex-wrap: wrap; text-shadow: 0 1px 3px rgba(0,0,0,.35); }
:root[data-theme="candy"] .md-scores { text-shadow: none; }
.md-scores .on { color: var(--accent); }
.md-card { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); box-shadow: var(--shadow); padding: 22px; display: grid; gap: 16px; justify-items: center; }
.md-q { font: 700 clamp(38px, 9vw, 56px) var(--font-display); color: var(--ink); text-align: center; line-height: 1.1; }
.md-dots { display: grid; gap: 6px; justify-items: center; }
.md-dots .row { display: flex; gap: 6px; }
.md-dots i { width: 16px; height: 16px; border-radius: 50%; background: var(--p1); box-shadow: inset -2px -3px 3px rgba(0,0,0,.3), inset 2px 2px 2px rgba(255,255,255,.4); }
.md-dots .row.b i { background: var(--p2); }
.md-in { font: 700 34px var(--font-display); min-height: 48px; min-width: 120px; text-align: center; color: var(--accent);
  border-bottom: 3px solid var(--line); padding: 0 12px; font-variant-numeric: tabular-nums; }
.md-flash { min-height: 22px; font: 700 15px var(--font-body); }
.md-flash.good { color: var(--accent); }
.md-flash.bad { color: var(--accent-2); }
.md-gate { display: grid; gap: 14px; justify-items: center; padding: 26px 0; }
.md-gate .md-title { font: 700 clamp(26px, 6vw, 36px) var(--font-display); color: var(--ink); text-align: center; }
.md-expr { font: 700 clamp(24px, 6vw, 34px) var(--font-display); color: var(--ink); min-height: 44px; text-align: center; }
.md-expr b { color: var(--accent); }
.md-cards { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; }
.md-cards .key { min-width: 64px; font-size: 26px; }
.md-cards .key[disabled] { opacity: .3; }
.md-ops { display: flex; gap: 10px; }
.md-ops .key { min-width: 56px; font-size: 24px; }
.md-actions { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; }
`;

export function mount(rootEl, ctx) {
  if (!document.querySelector('style[data-md]')) {
    const style = document.createElement('style');
    style.dataset.md = '';
    style.textContent = CSS;
    document.head.appendChild(style);
  }
  rootEl.closest('.rail')?.classList.add('mdrail');
  rootEl.innerHTML = '<div class="mdv"><div class="md-scores" data-scores></div><div class="md-card" data-card></div></div>';
  const scoresEl = rootEl.querySelector('[data-scores]');
  const cardEl = rootEl.querySelector('[data-card]');

  let cur = null;
  let input = '';
  let expr = [];       // make24 working expression
  let usedIdx = [];    // indexes of cards consumed
  let qKey = '';
  let flash = null;

  const myTurn = () => cur && ctx.localSeats.includes(cur.turn);

  function paintScores() {
    scoresEl.innerHTML = ctx.players.map((p) =>
      `<span class="${cur.turn === p.seat && !cur.done ? 'on' : ''}">${p.name}: ${cur.scores[p.seat]}</span>`).join('');
  }

  function paintGate() {
    const p = ctx.players[cur.turn];
    const roundText = cur.mode === 'quickfire' ? `Round ${cur.round + 1}` : `Make ${cur.levels[cur.turn] <= 2 ? 10 : 24}`;
    cardEl.innerHTML = `
      <div class="md-gate">
        <div class="md-title">${p.name} — ${roundText}</div>
        ${myTurn()
          ? '<button class="btn primary big" data-begin style="width:auto;padding:0 40px">Ready — go!</button>'
          : `<div class="muted">Waiting for ${p.name}…</div>`}
      </div>`;
  }

  function paintQuickfire() {
    const q = cur.current;
    const mine = myTurn();
    const dots = q.dots ? `
      <div class="md-dots">
        <div class="row">${'<i></i>'.repeat(q.dots[0])}</div>
        <div class="row b">${'<i></i>'.repeat(q.dots[1])}</div>
      </div>` : '';
    cardEl.innerHTML = `
      <div class="md-q">${q.text} = ?</div>
      ${dots}
      <div class="md-in">${input || '&nbsp;'}</div>
      <div class="md-flash ${flash ? (flash.right ? 'good' : 'bad') : ''}">${flash ? (flash.right ? 'Right! ✓' : `It was ${flash.answer}`) : ''}</div>
      ${mine ? `
        <div class="keys">
          ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button class="key" data-n="${n}">${n}</button>`).join('')}
          <button class="key ghost" data-back>⌫</button>
          <button class="key" data-n="0">0</button>
          <button class="key" data-go style="color:var(--accent)">✓</button>
        </div>` : `<div class="muted">${ctx.players[cur.turn].name} is thinking…</div>`}`;
  }

  function paintMake24() {
    const c = cur.current;
    const mine = myTurn();
    const val = expr.length >= 3 && expr.length % 2 === 1 ? evalExpr(expr) : null;
    const exprText = expr.map((x) => (typeof x === 'number' ? x : ` ${x === '*' ? '×' : x === '/' ? '÷' : x} `)).join('');
    cardEl.innerHTML = `
      <div class="md-q">Make ${c.target}</div>
      <div class="md-expr">${exprText || '<span class="muted">tap a card</span>'}${val !== null ? ` = <b>${val}</b>` : ''}</div>
      ${mine ? `
        <div class="md-cards">
          ${c.cards.map((n, i) => `<button class="key" data-card-i="${i}" ${usedIdx.includes(i) ? 'disabled' : ''}>${n}</button>`).join('')}
        </div>
        <div class="md-ops">
          ${['+', '-', '*', '/'].map((op) => `<button class="key" data-op="${op}">${op === '*' ? '×' : op === '/' ? '÷' : op}</button>`).join('')}
        </div>
        <div class="md-actions">
          <button class="btn" data-clear>Start over</button>
          <button class="btn primary" data-eq>=</button>
          <button class="btn" data-skip>Skip</button>
        </div>
        <div class="md-flash ${flash ? 'bad' : ''}">${flash ? flash.text : ''}</div>`
        : `<div class="muted">${ctx.players[cur.turn].name} is puzzling…</div>`}`;
  }

  function paint() {
    paintScores();
    if (cur.done) { cardEl.innerHTML = ''; return; }
    if (cur.phase === 'gate') paintGate();
    else if (cur.phase === 'quickfire') paintQuickfire();
    else paintMake24();
  }

  rootEl.addEventListener('click', (e) => {
    if (!cur || !myTurn()) return;
    if (e.target.closest('[data-begin]')) { ctx.onMove({ type: 'begin' }); return; }
    const n = e.target.closest('[data-n]');
    if (n) { if (input.length < 4) input += n.dataset.n; paint(); return; }
    if (e.target.closest('[data-back]')) { input = input.slice(0, -1); paint(); return; }
    if (e.target.closest('[data-go]')) {
      if (input === '') return;
      ctx.onMove({ type: 'answer', value: Number(input) });
      return;
    }
    const cardBtn = e.target.closest('[data-card-i]');
    if (cardBtn && !cardBtn.disabled) {
      const i = Number(cardBtn.dataset.cardI);
      if (expr.length % 2 === 0 && !usedIdx.includes(i)) {
        expr.push(cur.current.cards[i]);
        usedIdx.push(i);
        paint();
      }
      return;
    }
    const opBtn = e.target.closest('[data-op]');
    if (opBtn) {
      if (expr.length % 2 === 1 && usedIdx.length < cur.current.cards.length) {
        expr.push(opBtn.dataset.op);
        paint();
      }
      return;
    }
    if (e.target.closest('[data-clear]')) { expr = []; usedIdx = []; flash = null; paint(); return; }
    if (e.target.closest('[data-skip]')) { ctx.onMove({ type: 'skip' }); return; }
    if (e.target.closest('[data-eq]')) {
      if (usedIdx.length !== cur.current.cards.length) {
        flash = { text: 'Use every card!' };
        paint();
        return;
      }
      const val = evalExpr(expr);
      if (val === cur.current.target) {
        ctx.onMove({ type: 'solve', expr: expr.slice() });
      } else {
        flash = { text: val === null ? "That division doesn't come out even" : `That makes ${val}, not ${cur.current.target}` };
        expr = []; usedIdx = [];
        paint();
      }
    }
  });

  function update(state, legalMoves, lastMove) {
    const prevKey = qKey;
    cur = state;
    qKey = `${state.turn}:${state.round}:${state.q}:${state.phase}:${state.m24Turns}`;
    if (qKey !== prevKey) {
      input = '';
      expr = [];
      usedIdx = [];
      flash = (lastMove && (lastMove.type === 'answer' || lastMove.type === 'timeout') && state.lastResult)
        ? state.lastResult : null;
      if (flash) setTimeout(() => { if (qKey === `${cur.turn}:${cur.round}:${cur.q}:${cur.phase}:${cur.m24Turns}`) { flash = null; paint(); } }, 1400);
    }
    paint();
  }

  return {
    update,
    destroy() {
      rootEl.closest('.rail')?.classList.remove('mdrail');
      rootEl.innerHTML = '';
    },
  };
}
