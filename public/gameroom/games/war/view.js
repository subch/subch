// War view: per-seat zones around the felt (opponents' zones rotated toward
// them on a shared tablet), tap your own deck to flip, "Flip all" for the
// host. Rules stay in the engine — this only draws state and sends taps.
import { cardFace, cardBack } from '/app/pieces.js';
import { cardName } from '/shared/games/war/engine.js';

const CSS = `
.rail.cards { background: none; box-shadow: none; padding: 0; width: min(100%, 700px); }
.rail.cards::before, .rail.cards::after { display: none; }
.war-table { display: grid; gap: 10px; width: 100%; }
.war-row { display: flex; justify-content: space-evenly; gap: 10px; }
.war-zone { display: grid; justify-items: center; gap: 8px; padding: 10px 6px;
  border-radius: var(--radius-s); transition: background .2s, opacity .3s; }
.war-zone.rot { transform: rotate(180deg); }
.war-zone.active { background: color-mix(in srgb, var(--accent) 14%, transparent); }
.war-zone.dead { opacity: .35; filter: grayscale(.8); }
.war-zone .who { display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 14px; color: var(--ink); }
.war-zone .who .av { width: 26px; height: 26px; }
.war-hand { display: flex; align-items: center; gap: 10px; min-height: 108px; }
.war-deck { position: relative; border: none; padding: 0; cursor: pointer; border-radius: 9px; }
.war-deck .card { width: 72px; }
.war-deck.can-flip { animation: deckpulse 1.4s ease-in-out infinite; }
.war-deck.can-flip::after { content: "tap!"; position: absolute; inset: auto 0 -20px 0; text-align: center;
  font: 700 11px var(--font-body); color: var(--accent); letter-spacing: .08em; text-transform: uppercase; }
.war-zone.rot .war-deck.can-flip::after { transform: rotate(180deg); inset: -20px 0 auto 0; }
@keyframes deckpulse { 0%,100% { transform: translateY(0); box-shadow: 0 0 0 0 transparent; } 50% { transform: translateY(-4px); } }
.war-deck .count { position: absolute; top: -8px; right: -8px; min-width: 26px; height: 26px; border-radius: 999px;
  background: var(--accent); color: var(--accent-ink); font: 700 13px/26px var(--font-body); text-align: center;
  box-shadow: var(--glow) var(--accent), 0 2px 4px rgba(0,0,0,.4); padding: 0 4px; }
.war-up { display: flex; gap: 6px; }
.war-up .card { width: 72px; animation: cardflip .28s cubic-bezier(.2,.8,.2,1); }
.war-up .card.prev { opacity: .5; filter: saturate(.75); animation: none; }
.war-up .card.prev.won { opacity: 1; filter: none; box-shadow: 0 0 0 3px var(--accent), 0 8px 16px rgba(0,0,0,.38); }
@keyframes cardflip { from { transform: rotateY(90deg) scale(.9); } to { transform: rotateY(0) scale(1); } }
.war-mid { display: grid; justify-items: center; gap: 6px; min-height: 66px; align-content: center; }
.war-banner { font-family: var(--font-display); font-weight: 700; font-size: clamp(17px, 3vw, 24px);
  color: var(--ink); text-align: center; text-shadow: 0 2px 6px rgba(0,0,0,.35); }
.war-banner.war { color: var(--accent-2); font-size: clamp(22px, 4vw, 32px); animation: warpop .4s cubic-bezier(.3,1.4,.5,1); }
:root[data-theme="candy"] .war-banner, :root[data-theme="candy"] .war-banner.war { text-shadow: none; }
@keyframes warpop { from { transform: scale(.4); } }
.war-pot { display: flex; align-items: center; gap: 8px; font: 700 13px var(--font-body); color: var(--ink-2); }
.war-pot .card { width: 40px; box-shadow: 0 3px 8px rgba(0,0,0,.35); }
.flip-all { margin: 2px auto 0; }
`;

export function mount(rootEl, ctx) {
  if (!document.querySelector('style[data-war]')) {
    const style = document.createElement('style');
    style.dataset.war = '';
    style.textContent = CSS;
    document.head.appendChild(style);
  }
  rootEl.closest('.rail')?.classList.add('cards');

  const n = ctx.players.length;
  // bottom row = seat 0 (+ seat 3 in a 4-player game); top row faces away
  const topSeats = n === 2 ? [1] : n === 3 ? [1, 2] : [1, 2];
  const bottomSeats = n === 4 ? [0, 3] : [0];

  const zone = (p) => `
    <div class="war-zone ${topSeats.includes(p.seat) ? 'rot' : ''}" data-zone="${p.seat}">
      <div class="war-hand">
        <button class="war-deck" data-deck="${p.seat}" aria-label="${p.name}'s deck"></button>
        <div class="war-up" data-up="${p.seat}"></div>
      </div>
      <div class="who"><span class="av" style="background:${p.color || '#666'}"></span>${p.name}</div>
    </div>`;

  rootEl.innerHTML = `
    <div class="war-table">
      <div class="war-row">${topSeats.map((s) => zone(ctx.players[s])).join('')}</div>
      <div class="war-mid">
        <div class="war-banner" data-banner></div>
        <div class="war-pot" data-pot hidden></div>
        <button class="btn flip-all" data-flipall hidden>Flip all</button>
      </div>
      <div class="war-row">${bottomSeats.map((s) => zone(ctx.players[s])).join('')}</div>
    </div>`;

  // paint the avatar glyphs once
  import('/app/avatars.js').then(({ avatarSvg }) => {
    for (const p of ctx.players) {
      const el = rootEl.querySelector(`[data-zone="${p.seat}"] .av`);
      if (el) el.innerHTML = avatarSvg(p.avatar);
    }
  });

  let cur = null;
  let flipsQueued = 0;

  rootEl.addEventListener('click', (e) => {
    const deck = e.target.closest('[data-deck]');
    if (deck && cur) {
      const seat = Number(deck.dataset.deck);
      if (seat === cur.turn && ctx.localSeats.includes(seat)) ctx.onMove({ type: 'flip' });
      return;
    }
    if (e.target.closest('[data-flipall]') && cur) {
      // one flip per player still to act this phase, staggered so each lands
      flipsQueued = cur.need.length;
      const step = () => {
        if (flipsQueued <= 0) return;
        flipsQueued -= 1;
        ctx.onMove({ type: 'flip' });
        if (flipsQueued > 0) setTimeout(step, 380);
      };
      step();
    }
  });

  function update(state) {
    cur = state;
    const over = !!state.finished;
    for (const p of ctx.players) {
      const s = p.seat;
      const zoneEl = rootEl.querySelector(`[data-zone="${s}"]`);
      const deckEl = rootEl.querySelector(`[data-deck="${s}"]`);
      const upEl = rootEl.querySelector(`[data-up="${s}"]`);
      const count = state.decks[s].length + state.wons[s].length;
      deckEl.innerHTML = count > 0
        ? `<div class="card">${cardBack()}</div><span class="count">${count}</span>`
        : '<div class="card" style="opacity:.25"></div>';
      const myTurn = !over && state.turn === s && state.need.includes(s);
      deckEl.classList.toggle('can-flip', myTurn && ctx.localSeats.includes(s));
      zoneEl.classList.toggle('active', myTurn);
      zoneEl.classList.toggle('dead', state.out[s]);
      // show this round's cards; between rounds, keep LAST round's cards up
      // (dimmed, winner ringed) so nobody misses a fast flip
      const anyLive = state.faceUp.some((f) => f && f.length);
      const live = state.faceUp[s] || [];
      const prev = (!anyLive && state.lastRound?.cards?.[s]) || [];
      const cards = live.length ? live : prev;
      const isPrev = !live.length && prev.length > 0;
      const won = isPrev && state.lastRound?.winner === s;
      const key = `${cards.join(',')}:${isPrev ? 'p' : 'l'}${won ? 'w' : ''}`;
      if (upEl.dataset.key !== key) {
        upEl.dataset.key = key;
        upEl.innerHTML = cards.map((c) =>
          `<div class="card ${isPrev ? 'prev' : ''} ${won ? 'won' : ''}" title="${cardName(c)}">${cardFace(
            cardName(c).slice(0, -1), 'shdc'[(c / 13) | 0])}</div>`).join('');
      }
    }

    const banner = rootEl.querySelector('[data-banner]');
    const pot = rootEl.querySelector('[data-pot]');
    const flipAll = rootEl.querySelector('[data-flipall]');

    if (state.phase === 'war' && !over) {
      banner.className = 'war-banner war';
      banner.textContent = `WAR!${state.warDepth > 1 ? ` ×${state.warDepth}` : ''}`;
    } else if (state.lastRound?.winner !== undefined && state.lastRound?.winner !== null) {
      const w = ctx.players[state.lastRound.winner];
      banner.className = 'war-banner';
      banner.textContent = over ? '' : `${w.name} takes ${state.lastRound.take}`;
    } else {
      banner.className = 'war-banner';
      banner.textContent = state.suddenDeath ? 'Sudden death!' : '';
    }

    pot.hidden = state.pot.length === 0;
    if (state.pot.length) {
      pot.innerHTML = `<div class="card">${cardBack()}</div> ${state.pot.length} cards in the pot`;
    }
    const anyLocalFlips = !over && state.need.length > 1;
    flipAll.hidden = !anyLocalFlips || flipsQueued > 0;
  }

  return {
    update,
    destroy() {
      rootEl.closest('.rail')?.classList.remove('cards');
      rootEl.innerHTML = '';
    },
  };
}
