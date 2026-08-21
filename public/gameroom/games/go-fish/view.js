// Go Fish view: tap one of your rank stacks, then tap who to ask. Hand-off
// curtain guards hands on a shared tablet (same pattern as Crazy 8's).
import { cardFace, cardBack } from '/app/pieces.js';
import { rank, suit, rankName } from '/shared/games/go-fish/engine.js';

const SUIT_LETTER = 'shdc';

const CSS = `
.rail.cards { background: none; box-shadow: none; padding: 0; width: min(100%, 720px); }
.gf { position: relative; display: grid; gap: 12px; width: 100%; }
.gf-opps { display: flex; justify-content: space-evenly; gap: 8px; flex-wrap: wrap; }
.gf-opp { display: grid; justify-items: center; gap: 5px; padding: 8px 10px; border-radius: var(--radius-s); border: none; background: none; transition: background .2s; }
.gf-opp.active { background: color-mix(in srgb, var(--accent) 14%, transparent); }
.gf-opp.askable { cursor: pointer; background: color-mix(in srgb, var(--accent) 20%, transparent); animation: pulse 1.4s ease-in-out infinite; }
.gf-opp .who { display: flex; align-items: center; gap: 6px; font-weight: 700; font-size: 13px; color: var(--ink); }
.gf-opp .who .av { width: 24px; height: 24px; }
.gf-fan { display: flex; }
.gf-fan .card { width: 36px; margin-left: -26px; box-shadow: 0 2px 6px rgba(0,0,0,.35); }
.gf-fan .card:first-child { margin-left: 0; }
.gf-books { display: flex; gap: 4px; flex-wrap: wrap; justify-content: center; min-height: 20px; }
.gf-book { font: 700 11px var(--font-body); padding: 2px 7px; border-radius: 6px;
  background: var(--accent); color: var(--accent-ink); box-shadow: inset 0 -2px 0 rgba(0,0,0,.2); }
.gf-mid { display: grid; justify-items: center; gap: 8px; min-height: 96px; align-content: center; }
.gf-banner { font-family: var(--font-display); font-weight: 700; font-size: clamp(16px, 3vw, 22px); color: var(--ink); text-align: center; text-shadow: 0 2px 6px rgba(0,0,0,.35); }
:root[data-theme="candy"] .gf-banner { text-shadow: none; }
.gf-stock { display: flex; align-items: center; gap: 8px; font: 700 12px var(--font-body); color: var(--ink-2); }
.gf-stock .card { width: 44px; }
.gf-hand { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; padding: 6px 0 2px; }
.gf-stack { position: relative; border: none; padding: 0 8px 16px 0; background: none; cursor: pointer; transition: transform .15s; }
.gf-stack .card { width: 64px; box-shadow: 0 3px 8px rgba(0,0,0,.4), 0 0 0 1px rgba(0,0,0,.15); }
.gf-stack .card + .card { position: absolute; left: 6px; top: 6px; }
.gf-stack .n { position: absolute; right: -2px; bottom: 2px; min-width: 22px; height: 22px; border-radius: 999px;
  background: var(--accent); color: var(--accent-ink); font: 700 12px/22px var(--font-body); text-align: center; }
.gf-stack.sel { transform: translateY(-10px); }
.gf-stack.sel .card:first-child { box-shadow: 0 0 0 3px var(--accent), 0 6px 12px rgba(0,0,0,.4); }
.gf-mybooks { display: flex; gap: 4px; justify-content: center; flex-wrap: wrap; }
.gf-draw { justify-self: center; }
.gf-overlay[hidden] { display: none; }
.gf-overlay { position: absolute; inset: -8px; z-index: 5; display: grid; place-content: center; gap: 14px;
  justify-items: center; border-radius: var(--radius); text-align: center;
  background: color-mix(in srgb, var(--bg) 88%, transparent); backdrop-filter: blur(14px); }
.gf-overlay .big-name { font-family: var(--font-display); font-size: clamp(24px, 5vw, 34px); font-weight: 700; color: var(--ink); }
.gf-overlay .av { width: 72px; height: 72px; }
`;

export function mount(rootEl, ctx) {
  if (!document.querySelector('style[data-gf]')) {
    const style = document.createElement('style');
    style.dataset.gf = '';
    style.textContent = CSS;
    document.head.appendChild(style);
  }
  rootEl.closest('.rail')?.classList.add('cards');

  rootEl.innerHTML = `
    <div class="gf">
      <div class="gf-opps" data-opps></div>
      <div class="gf-mid">
        <div class="gf-banner" data-banner></div>
        <div class="gf-stock" data-stock></div>
        <button class="btn primary gf-draw" data-draw hidden>Draw 5 cards</button>
      </div>
      <div class="gf-hand" data-hand></div>
      <div class="gf-mybooks" data-mybooks></div>
      <div class="gf-overlay" data-overlay hidden></div>
    </div>`;

  const oppsEl = rootEl.querySelector('[data-opps]');
  const bannerEl = rootEl.querySelector('[data-banner]');
  const stockEl = rootEl.querySelector('[data-stock]');
  const drawBtn = rootEl.querySelector('[data-draw]');
  const handEl = rootEl.querySelector('[data-hand]');
  const myBooksEl = rootEl.querySelector('[data-mybooks]');
  const overlay = rootEl.querySelector('[data-overlay]');

  let cur = null;
  let legal = [];
  let selRank = null;
  let revealed = null;
  let curtainFor = null;

  let avatarSvgFn = null;
  import('/app/avatars.js').then((m) => { avatarSvgFn = m.avatarSvg; if (cur) paint(); });
  const avatarHtml = (p) =>
    `<span class="av" style="background:${p.color || '#666'}">${avatarSvgFn ? avatarSvgFn(p.avatar) : ''}</span>`;

  const myTurn = () => cur && ctx.localSeats.includes(cur.turn) && cur.turn === revealed;

  rootEl.addEventListener('click', (e) => {
    if (!cur) return;
    if (e.target.closest('[data-overlay]')) {
      if (curtainFor !== null) { revealed = curtainFor; curtainFor = null; selRank = null; paint(); }
      return;
    }
    if (e.target.closest('[data-draw]')) {
      if (legal.some((m) => m.type === 'draw5')) ctx.onMove({ type: 'draw5' });
      return;
    }
    const stack = e.target.closest('[data-rank]');
    if (stack && myTurn()) {
      const r = Number(stack.dataset.rank);
      const targets = legal.filter((m) => m.type === 'ask' && m.rank === r);
      if (!targets.length) return;
      if (targets.length === 1) { ctx.onMove(targets[0]); selRank = null; return; }
      selRank = selRank === r ? null : r;
      paint();
      return;
    }
    const opp = e.target.closest('[data-opp]');
    if (opp && myTurn() && selRank !== null) {
      const move = legal.find((m) => m.type === 'ask' && m.rank === selRank && m.target === Number(opp.dataset.opp));
      if (move) { ctx.onMove(move); selRank = null; }
    }
  });

  const bookChips = (books) =>
    books.map((r) => `<span class="gf-book">${rankName(r)}s</span>`).join('');

  function bannerText() {
    const a = cur.lastAction;
    if (cur.lastBook) {
      return `${ctx.players[cur.lastBook.seat].name} laid down the ${rankName(cur.lastBook.rank)}s! 📚`;
    }
    if (!a) return 'Ask someone for a rank you hold';
    if (a.type === 'draw5') return `${ctx.players[a.seat].name} drew a fresh hand`;
    if (a.type === 'pass') return `${ctx.players[a.seat].name} sits this one out`;
    if (a.got > 0) return `${ctx.players[a.seat].name} took ${a.got} ${rankName(a.rank)}${a.got > 1 ? 's' : ''} from ${ctx.players[a.target].name}!`;
    return `${ctx.players[a.target].name}: “Go fish!” 🐟${a.luckyFish ? ` …and ${ctx.players[a.seat].name} fished the ${rankName(a.rank)}!` : ''}`;
  }

  function paint() {
    const s = cur;
    const over = !legal.length;
    const asking = myTurn() && selRank !== null;

    oppsEl.innerHTML = ctx.players.filter((p) => p.seat !== revealed).map((p) => {
      const canAsk = asking && legal.some((m) => m.type === 'ask' && m.rank === selRank && m.target === p.seat);
      return `
        <button class="gf-opp ${!over && s.turn === p.seat ? 'active' : ''} ${canAsk ? 'askable' : ''}" data-opp="${p.seat}">
          <div class="gf-fan">${s.hands[p.seat].slice(0, 7).map(() => `<div class="card">${cardBack()}</div>`).join('')}</div>
          <div class="who">${avatarHtml(p)}${p.name} · ${s.hands[p.seat].length}</div>
          <div class="gf-books">${bookChips(s.books[p.seat])}</div>
        </button>`;
    }).join('');

    bannerEl.textContent = over ? '' : bannerText();
    stockEl.innerHTML = s.stock.length
      ? `<div class="card">${cardBack()}</div> ${s.stock.length} in the pond`
      : 'the pond is empty';
    drawBtn.hidden = !(myTurn() && legal.some((m) => m.type === 'draw5'));

    const me = ctx.players[revealed];
    const hand = me ? s.hands[revealed].filter((c) => c >= 0) : [];
    const groups = {};
    for (const c of hand) (groups[rank(c)] = groups[rank(c)] || []).push(c);
    handEl.innerHTML = Object.entries(groups)
      .sort((a, b) => a[0] - b[0])
      .map(([r, cards]) => `
        <button class="gf-stack ${Number(r) === selRank ? 'sel' : ''}" data-rank="${r}">
          ${cards.slice(0, 2).map((c) => `<div class="card">${cardFace(rankName(rank(c)), SUIT_LETTER[suit(c)])}</div>`).join('')}
          <span class="n">×${cards.length}</span>
        </button>`).join('');
    myBooksEl.innerHTML = me && s.books[revealed].length
      ? `<span style="font:700 12px var(--font-body);color:var(--ink-2);align-self:center">my books:</span>` + bookChips(s.books[revealed])
      : '';

    if (curtainFor !== null && !over) {
      const p = ctx.players[curtainFor];
      overlay.hidden = false;
      overlay.innerHTML = `${avatarHtml(p)}<div class="big-name">Pass to ${p.name}</div><div class="muted">Tap when it's just you looking</div>`;
    } else {
      overlay.hidden = true;
    }
  }

  function update(state, legalMoves) {
    const first = cur === null;
    cur = state;
    legal = legalMoves;
    if (first) revealed = ctx.localSeats.includes(state.turn) ? state.turn : ctx.localSeats[0];
    if (state.turn === revealed || !legalMoves.length) curtainFor = null;
    else if (!first && ctx.localSeats.length > 1 && ctx.localSeats.includes(state.turn)) curtainFor = state.turn;
    if (!myTurn()) selRank = null;
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
