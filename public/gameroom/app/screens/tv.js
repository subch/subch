// TV view: a clean spectator screen for the device that's mirrored or
// plugged into the television. No controls — just the board, big, with a
// turn banner. Route: #/tv/CODE
import { navigate } from '../router.js';
import { h, avHtml, esc } from '../ui.js';
import { RoomSource } from '../match/room-source.js';

const CSS = `
.tvv { min-height: 100dvh; display: grid; grid-template-rows: auto 1fr; gap: 8px; padding: 14px; }
.tv-banner { display: flex; align-items: center; justify-content: center; gap: 14px;
  font-family: var(--font-display); font-size: clamp(26px, 4vw, 44px); font-weight: 700; color: var(--ink); }
.tv-banner .av { width: 52px; height: 52px; }
.tv-stage { display: grid; place-items: center; min-height: 0; }
.tv-stage .rail { width: min(96vw, calc(100svh - 140px), 760px); }
.tv-code { position: fixed; right: 16px; bottom: 12px; font: 700 14px var(--font-body);
  color: var(--ink-2); letter-spacing: .2em; }
`;

export async function tv(root, params) {
  if (!document.querySelector('style[data-tv]')) {
    const style = document.createElement('style');
    style.dataset.tv = '';
    style.textContent = CSS;
    document.head.appendChild(style);
  }
  const code = params.code.toUpperCase();
  const source = new RoomSource(code, { spectate: true });

  // keep the screen awake while it's the television
  let wakeLock = null;
  try { wakeLock = await navigator.wakeLock?.request('screen'); } catch { /* unsupported */ }
  const rewake = () => {
    if (document.visibilityState === 'visible') {
      navigator.wakeLock?.request('screen').then((l) => { wakeLock = l; }).catch(() => {});
    }
  };
  document.addEventListener('visibilitychange', rewake);

  const el = h(`
    <div class="tvv">
      <div class="tv-banner" data-banner>Tuning in…</div>
      <div class="tv-stage"><div class="table-surface"><div class="rail"><div data-board></div></div></div></div>
      <div class="tv-code">${esc(code)}</div>
    </div>`);
  root.appendChild(el);
  const banner = el.querySelector('[data-banner]');

  let view = null;
  let mounting = false;

  const unsub = source.subscribe(async (evt) => {
    if (!source.state || !source.meta) {
      banner.textContent = source.tableStatus === 'open' ? 'Waiting for the game to start…' : 'Tuning in…';
      return;
    }
    if (!view && !mounting) {
      mounting = true;
      const mod = await import(`/games/${source.meta.id}/view.js`);
      view = mod.mount(el.querySelector('[data-board]'), {
        players: source.players,
        localSeats: [], // spectators tap nothing
        options: source.options,
        onMove: () => {},
        theme: 'felt',
        describe: source.engine?.describe,
      });
      mounting = false;
    }
    if (!view) return;
    const st = source.getStatus();
    view.update(source.state, [], null, st);
    if (st.over) {
      const w = st.winner !== null && st.winner !== undefined ? source.players[st.winner] : null;
      banner.innerHTML = w ? `${avHtml(w, 'med')} ${esc(w.name)} wins!` : "It's a draw";
    } else {
      const p = source.players[source.state.turn];
      if (p) banner.innerHTML = `${avHtml(p, 'med')} ${esc(p.name)}'s move ${st.note ? `· ${esc(st.note)}` : ''}`;
    }
  });

  return {
    destroy() {
      unsub();
      view?.destroy?.();
      source.destroy();
      document.removeEventListener('visibilitychange', rewake);
      wakeLock?.release?.().catch?.(() => {});
    },
  };
}
