// Mancala view: carved wooden board, glass-bead pits (deterministic jitter
// from pieces.pit), stores at the ends. Tap one of your pits to sow.
import { pit } from '/app/pieces.js';

const CSS = `
.rail.mrail { width: min(100%, 880px); }
.mv { display: grid; grid-template-columns: 86px 1fr 86px; gap: 8px; align-items: stretch; }
.mv-rows { display: grid; gap: 6px; }
.mv-row { display: grid; grid-template-columns: repeat(6, 1fr); gap: 6px; }
.mv-pit { position: relative; border: none; padding: 2px; background: none; border-radius: 12px; cursor: default; }
.mv-pit svg { width: 100%; height: auto; display: block; overflow: visible; }
.mv-pit.mine { cursor: pointer; }
.mv-pit.mine::after { content: ""; position: absolute; inset: 6px; border-radius: 50%;
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 55%, transparent); opacity: 0; transition: opacity .2s; pointer-events: none; }
.mv-pit.mine:not([disabled])::after { opacity: 1; animation: pulse 1.6s ease-in-out infinite; }
.mv-pit.last::before { content: ""; position: absolute; inset: 4px; border-radius: 50%;
  background: color-mix(in srgb, var(--accent) 22%, transparent); pointer-events: none; }
.mv-store { display: grid; align-content: center; justify-items: center; gap: 4px; border-radius: 16px;
  background: radial-gradient(circle at 50% 30%, color-mix(in srgb, var(--rail-edge) 80%, #000), var(--rail-edge) 75%);
  box-shadow: inset 0 4px 10px rgba(0,0,0,.5), inset 0 -1px 0 rgba(255,255,255,.12); padding: 8px 4px; }
.mv-store b { font: 700 30px var(--font-display); color: var(--ink); font-variant-numeric: tabular-nums;
  text-shadow: 0 2px 4px rgba(0,0,0,.5); }
.mv-store span { font-size: 11px; color: var(--ink-2); text-align: center; }
.mv-store .beads { display: flex; flex-wrap: wrap; gap: 3px; justify-content: center; max-width: 64px; }
.mv-store .beads i { width: 11px; height: 11px; border-radius: 50%; box-shadow: inset -1px -2px 2px rgba(0,0,0,.4), inset 1px 1px 1px rgba(255,255,255,.5); }
`;

const BEAD_COLORS = ['var(--p1)', 'var(--p2)', 'var(--accent)', 'var(--accent-2)', 'var(--p1-hi)', 'var(--q-light-2)'];

export function mount(rootEl, ctx) {
  if (!document.querySelector('style[data-mancala]')) {
    const style = document.createElement('style');
    style.dataset.mancala = '';
    style.textContent = CSS;
    document.head.appendChild(style);
  }
  rootEl.closest('.rail')?.classList.add('mrail');

  // top row: opponent pits 11..6 (counter-clockwise flow); bottom: 0..5
  rootEl.innerHTML = `
    <div class="mv">
      <div class="mv-store" data-store="1"></div>
      <div class="mv-rows">
        <div class="mv-row">${[11, 10, 9, 8, 7, 6].map((i) => `<button class="mv-pit" data-pit="${i}"></button>`).join('')}</div>
        <div class="mv-row">${[0, 1, 2, 3, 4, 5].map((i) => `<button class="mv-pit" data-pit="${i}"></button>`).join('')}</div>
      </div>
      <div class="mv-store" data-store="0"></div>
    </div>`;

  let cur = null;
  let legal = [];

  rootEl.addEventListener('click', (e) => {
    const el = e.target.closest('[data-pit]');
    if (!el || !cur || !ctx.localSeats.includes(cur.turn)) return;
    const p = Number(el.dataset.pit);
    if (legal.some((m) => m.pit === p)) ctx.onMove({ type: 'sow', pit: p });
  });

  function update(state, legalMoves, lastMove) {
    cur = state;
    legal = legalMoves;
    const myTurn = ctx.localSeats.includes(state.turn);
    for (const el of rootEl.querySelectorAll('[data-pit]')) {
      const i = Number(el.dataset.pit);
      const count = state.pits[i];
      if (el.dataset.n !== String(count)) {
        el.dataset.n = String(count);
        el.innerHTML = pit(count, i);
      }
      const sowable = myTurn && legal.some((m) => m.pit === i);
      el.classList.toggle('mine', sowable);
      el.disabled = !sowable;
      el.classList.toggle('last', state.lastSown === i);
    }
    for (const seat of [0, 1]) {
      const el = rootEl.querySelector(`[data-store="${seat}"]`);
      const n = state.stores[seat];
      const beads = Array.from({ length: Math.min(n, 18) }, (_, i) =>
        `<i style="background:${BEAD_COLORS[i % BEAD_COLORS.length]}"></i>`).join('');
      el.innerHTML = `<b>${n}</b><div class="beads">${beads}</div><span>${ctx.players[seat]?.name || ''}</span>`;
    }
  }

  return {
    update,
    destroy() {
      rootEl.closest('.rail')?.classList.remove('mrail');
      rootEl.innerHTML = '';
    },
  };
}
