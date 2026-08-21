// Crazy 8's view. Hidden hands on a shared tablet: a "Pass to <name>"
// curtain drops whenever the turn moves to a different local player, so
// nobody sees a hand that isn't theirs. Rules live in the engine.
import { cardFace, cardBack } from '/app/pieces.js';
import { cardName, rank, suit } from '/shared/games/crazy-8s/engine.js';

const SUIT_LETTER = 'shdc';
const SUIT_GLYPHS = ['♠', '♥', '♦', '♣'];

const CSS = `
.rail.cards { background: none; box-shadow: none; padding: 0; width: min(100%, 720px); }
.rail.cards::before, .rail.cards::after { display: none; }
.c8-table { position: relative; display: grid; gap: 14px; width: 100%; }
.c8-opps { display: flex; justify-content: space-evenly; gap: 10px; }
.c8-opp { display: grid; justify-items: center; gap: 6px; padding: 8px; border-radius: var(--radius-s); transition: background .2s; }
.c8-opp.active { background: color-mix(in srgb, var(--accent) 14%, transparent); }
.c8-opp .who { display: flex; align-items: center; gap: 7px; font-weight: 700; font-size: 13px; color: var(--ink); }
.c8-opp .who .av { width: 24px; height: 24px; }
.c8-fan { display: flex; }
.c8-fan .card { width: 44px; margin-left: -30px; box-shadow: 0 3px 8px rgba(0,0,0,.35); }
.c8-fan .card:first-child { margin-left: 0; }
.c8-mid { display: flex; justify-content: center; align-items: center; gap: 18px; min-height: 118px; }
.c8-stock { position: relative; border: none; padding: 0; cursor: pointer; border-radius: 9px; }
.c8-stock .card { width: 76px; }
.c8-stock.can-draw { animation: c8pulse 1.4s ease-in-out infinite; }
.c8-stock .hint { position: absolute; inset: auto 0 -20px 0; text-align: center; font: 700 11px var(--font-body); color: var(--accent); letter-spacing: .06em; text-transform: uppercase; }
@keyframes c8pulse { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-4px) } }
.c8-discard .card { width: 76px; animation: c8play .25s cubic-bezier(.2,.8,.2,1); }
@keyframes c8play { from { transform: translateY(-16px) rotate(-6deg) scale(1.08); } }
.c8-suit[hidden] { display: none; }
.c8-suit { display: grid; place-items: center; width: 54px; height: 54px; border-radius: 50%;
  background: var(--surface); border: 2px solid var(--accent); box-shadow: var(--glow) var(--accent);
  font-size: 30px; line-height: 1; }
.c8-suit.red { color: var(--card-red); } .c8-suit.blk { color: var(--card-ink); }
:root[data-theme="arcade"] .c8-suit.blk { color: var(--ink); }
.c8-handwrap { display: grid; gap: 8px; justify-items: center; }
.c8-hand { display: flex; justify-content: center; padding: 12px 10px 4px; max-width: 100%; overflow-x: auto; }
.c8-hand .card { width: 76px; margin-left: -34px; flex: none; cursor: pointer; transition: transform .15s;
  box-shadow: 0 4px 10px rgba(0,0,0,.4), 0 0 0 1px rgba(0,0,0,.18); }
.c8-hand .card:first-child { margin-left: 0; }
.c8-hand .card.ok { transform: translateY(-10px); }
.c8-hand .card.ok:hover { transform: translateY(-16px); }
.c8-hand .card.dead { filter: saturate(.8) brightness(.85); }
.c8-hand .who { align-self: center; }
.c8-whose { display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 14px; color: var(--ink); }
.c8-whose .av { width: 26px; height: 26px; }
.c8-overlay[hidden] { display: none; }
.c8-overlay { position: absolute; inset: -8px; z-index: 5; display: grid; place-content: center; gap: 14px;
  justify-items: center; border-radius: var(--radius); text-align: center;
  background: color-mix(in srgb, var(--bg) 88%, transparent); backdrop-filter: blur(14px); }
.c8-overlay .big-name { font-family: var(--font-display); font-size: clamp(24px, 5vw, 34px); font-weight: 700; color: var(--ink); }
.c8-overlay .av { width: 72px; height: 72px; }
.c8-suitpick { display: flex; gap: 12px; }
.c8-suitpick button { width: 68px; height: 68px; border-radius: var(--radius-s); font-size: 38px; line-height: 1;
  background: var(--card-face); border: 1px solid var(--line); box-shadow: inset 0 -4px 0 rgba(0,0,0,.15); }
.c8-suitpick button:active { transform: scale(.94); }
.c8-suitpick .red { color: #c0392b; } .c8-suitpick .blk { color: #1e1e1e; }
`;

export function mount(rootEl, ctx) {
  if (!document.querySelector('style[data-c8]')) {
    const style = document.createElement('style');
    style.dataset.c8 = '';
    style.textContent = CSS;
    document.head.appendChild(style);
  }
  rootEl.closest('.rail')?.classList.add('cards');

  const faceHtml = (c) => `<div class="card" data-card="${c}">${cardFace(cardName(c).slice(0, -1), SUIT_LETTER[suit(c)])}</div>`;

  rootEl.innerHTML = `
    <div class="c8-table">
      <div class="c8-opps" data-opps></div>
      <div class="c8-mid">
        <button class="c8-stock" data-stock aria-label="draw pile"></button>
        <div class="c8-discard" data-discard></div>
        <div class="c8-suit" data-suitbadge hidden></div>
      </div>
      <div class="c8-handwrap">
        <div class="c8-whose" data-whose></div>
        <div class="c8-hand" data-hand></div>
      </div>
      <div class="c8-overlay" data-overlay hidden></div>
    </div>`;

  const oppsEl = rootEl.querySelector('[data-opps]');
  const stockEl = rootEl.querySelector('[data-stock]');
  const discardEl = rootEl.querySelector('[data-discard]');
  const suitBadge = rootEl.querySelector('[data-suitbadge]');
  const whoseEl = rootEl.querySelector('[data-whose]');
  const handEl = rootEl.querySelector('[data-hand]');
  const overlay = rootEl.querySelector('[data-overlay]');

  let cur = null;
  let legal = [];
  let revealed = null;   // which local seat's hand is on screen
  let curtainFor = null; // seat waiting behind the curtain

  let avatarSvgFn = null;
  import('/app/avatars.js').then((m) => { avatarSvgFn = m.avatarSvg; if (cur) paint(); });
  const avatarHtml = (p) =>
    `<span class="av" style="background:${p.color || '#666'}">${avatarSvgFn ? avatarSvgFn(p.avatar) : ''}</span>`;

  rootEl.addEventListener('click', (e) => {
    if (!cur) return;
    if (e.target.closest('[data-overlay]')) {
      if (curtainFor !== null) {
        revealed = curtainFor;
        curtainFor = null;
        paint();
      }
      return;
    }
    const suitBtn = e.target.closest('[data-suit]');
    if (suitBtn) { ctx.onMove({ type: 'suit', suit: Number(suitBtn.dataset.suit) }); return; }
    if (e.target.closest('[data-stock]')) {
      if (myTurn() && legal.some((m) => m.type === 'draw')) ctx.onMove({ type: 'draw' });
      return;
    }
    const cardEl = e.target.closest('[data-card]');
    if (cardEl && myTurn()) {
      const c = Number(cardEl.dataset.card);
      if (legal.some((m) => m.type === 'play' && m.card === c)) ctx.onMove({ type: 'play', card: c });
    }
  });

  const myTurn = () =>
    cur && ctx.localSeats.includes(cur.turn) && cur.turn === revealed;

  function paint() {
    const s = cur;
    const over = !legal.length;

    // opponents: everyone except the revealed seat (all of them, on a TV)
    oppsEl.innerHTML = ctx.players.filter((p) => p.seat !== revealed && s.hands[p.seat]).map((p) => `
      <div class="c8-opp ${!over && s.turn === p.seat ? 'active' : ''}">
        <div class="c8-fan">${s.hands[p.seat].slice(0, 8).map(() => `<div class="card">${cardBack()}</div>`).join('')}</div>
        <div class="who">${avatarHtml(p)}${p.name} · ${s.hands[p.seat].length}</div>
      </div>`).join('');

    const stockCount = s.stock.length + Math.max(0, s.discard.length - 1);
    stockEl.innerHTML = stockCount > 0
      ? `<div class="card">${cardBack()}</div><span class="hint" data-hint></span>`
      : '<div class="card" style="opacity:.2"></div>';
    const canDrawNow = myTurn() && legal.some((m) => m.type === 'draw');
    stockEl.classList.toggle('can-draw', canDrawNow);
    const hint = stockEl.querySelector('[data-hint]');
    if (hint && canDrawNow) {
      hint.textContent = legal.some((m) => m.type === 'play') ? 'or draw' : 'tap to draw';
    }

    const top = s.discard[s.discard.length - 1];
    if (discardEl.dataset.top !== String(top)) {
      discardEl.dataset.top = String(top);
      discardEl.innerHTML = faceHtml(top);
    }

    const eightCalled = s.currentRank === 6 && rank(top) === 6;
    suitBadge.hidden = !eightCalled;
    if (eightCalled) {
      suitBadge.textContent = SUIT_GLYPHS[s.currentSuit];
      suitBadge.className = `c8-suit ${s.currentSuit === 1 || s.currentSuit === 2 ? 'red' : 'blk'}`;
    }

    // the revealed hand, sorted for humans (spectators see nobody's hand)
    const me = ctx.players[revealed];
    whoseEl.innerHTML = me ? `${avatarHtml(me)}${me.name}'s hand` : '';
    const hand = (me ? s.hands[revealed] : []).slice()
      .filter((c) => c >= 0)
      .sort((a, b) => (suit(a) - suit(b)) || (rank(a) - rank(b)));
    handEl.innerHTML = hand.map((c) => {
      const ok = myTurn() && legal.some((m) => m.type === 'play' && m.card === c);
      return `<div class="card ${ok ? 'ok' : 'dead'}" data-card="${c}">${cardFace(cardName(c).slice(0, -1), SUIT_LETTER[suit(c)])}</div>`;
    }).join('');

    // overlays: hand-off curtain, then the suit picker
    if (curtainFor !== null && !over) {
      const p = ctx.players[curtainFor];
      overlay.hidden = false;
      overlay.innerHTML = `
        ${avatarHtml(p)}
        <div class="big-name">Pass to ${p.name}</div>
        <div class="muted">Tap when it's just you looking</div>`;
    } else if (!over && s.phase === 'suit' && myTurn()) {
      overlay.hidden = false;
      overlay.innerHTML = `
        <div class="big-name">Crazy 8! Pick a suit</div>
        <div class="c8-suitpick">
          ${SUIT_GLYPHS.map((g, i) => `<button data-suit="${i}" class="${i === 1 || i === 2 ? 'red' : 'blk'}">${g}</button>`).join('')}
        </div>`;
    } else {
      overlay.hidden = true;
    }
  }

  function update(state, legalMoves) {
    const first = cur === null;
    cur = state;
    legal = legalMoves;
    if (first) revealed = ctx.localSeats.includes(state.turn) ? state.turn : ctx.localSeats[0];
    // hand-off: the turn moved to a different local player
    if (state.turn === revealed || !legalMoves.length) {
      curtainFor = null;
    } else if (!first && ctx.localSeats.length > 1 && ctx.localSeats.includes(state.turn)) {
      curtainFor = state.turn;
    }
    paint();
  }

  return {
    update,
    destroy() {
      rootEl.closest('.rail')?.classList.remove('cards');
      rootEl.innerHTML = '';
    },
  };
}
