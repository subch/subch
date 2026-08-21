// The Lounge — #/tv with no code. Leave it on the television: idle, it's an
// ambient family screen (wordmark, clock, leaderboard, recent games); the
// moment tables open or games begin they appear as live boards, from one
// full-screen board up to a 2×2 grid. No login, no controls.
import { api } from '../api.js';
import { onMessage, send } from '../net.js';
import { h, avHtml, esc } from '../ui.js';
import { RoomSource } from '../match/room-source.js';
import { gameMeta } from '/shared/games/index.js';
import { brandMark } from './login.js';

const CSS = `
.lg { height: 100dvh; display: grid; grid-template-rows: auto minmax(0, 1fr); padding: 18px 22px; gap: 14px; position: relative; isolation: isolate; overflow: hidden; }
.lg::before, .lg::after { content: ""; position: absolute; border-radius: 50%; filter: blur(90px); opacity: .35; z-index: -1; pointer-events: none; }
.lg::before { width: 46vw; height: 46vw; left: -14vw; top: -14vw; background: radial-gradient(circle, var(--felt-hi), transparent 70%); animation: lgdrift 26s ease-in-out infinite alternate; }
.lg::after { width: 38vw; height: 38vw; right: -10vw; bottom: -12vw; background: radial-gradient(circle, color-mix(in srgb, var(--accent) 45%, transparent), transparent 70%); animation: lgdrift 31s ease-in-out infinite alternate-reverse; }
@keyframes lgdrift { from { transform: translate(0,0) } to { transform: translate(6vw, 4vh) } }
.lg-head { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.lg-head .brand { font-size: clamp(22px, 2.6vw, 34px); }
.lg-clock { font: 500 clamp(20px, 2.4vw, 30px) var(--font-display); color: var(--ink-2); font-variant-numeric: tabular-nums; }

/* live boards — column width is set by fitStage() in JS, which shrinks it
   until everything actually fits the screen (board shapes vary per game) */
.lg-stage { display: grid; gap: 14px; align-content: center; justify-content: center; min-height: 0; }
.lg-card { display: grid; grid-template-rows: auto 1fr; gap: 8px; min-width: 0; }
.lg-card .bar { display: flex; align-items: center; gap: 8px; min-height: 36px;
  font-family: var(--font-display); font-weight: 700; font-size: clamp(15px, 1.8vw, 22px); color: var(--ink);
  white-space: nowrap; overflow: hidden; } /* never wrap — wrapping defeats the fit loop */
.lg-card .bar > span { overflow: hidden; text-overflow: ellipsis; flex-shrink: 1; }
.lg-card .bar .av { width: 30px; height: 30px; flex: none; }
.lg-card .bar .muted { font-family: var(--font-body); font-weight: 600; font-size: .75em; }
.lg-card .table-surface { padding: 12px; }
.lg-card .rail { width: 100%; }
.lg-card .waiting { display: grid; place-content: center; gap: 8px; justify-items: center; min-height: 140px;
  font-family: var(--font-display); font-size: clamp(18px, 2.4vw, 28px); color: var(--ink); text-align: center; }
.lg-card .waiting .code { font-size: 1.6em; letter-spacing: .3em; text-indent: .3em; color: var(--accent); text-shadow: var(--glow) var(--accent); }
.lg-card .faces { display: flex; gap: 6px; }

/* idle */
.lg-idle { display: grid; gap: 22px; justify-items: center; align-content: center; text-align: center; }
.lg-idle .big { font: 700 clamp(34px, 6vw, 64px) var(--font-display); color: var(--ink); }
.lg-idle .hint { color: var(--ink-2); font-size: clamp(14px, 1.7vw, 19px); }
.lg-idle .panel { min-width: min(560px, 92vw); }
.lg-idle .stat-table td, .lg-idle .stat-table th { font-size: clamp(13px, 1.5vw, 17px); }
.lg-idle .recentline { font-size: clamp(13px, 1.5vw, 16px); color: var(--ink-2); }
.lg-idle .recentline b { color: var(--ink); }
`;

export async function tvLounge(root) {
  if (!document.querySelector('style[data-lounge]')) {
    const style = document.createElement('style');
    style.dataset.lounge = '';
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  let wakeLock = null;
  try { wakeLock = await navigator.wakeLock?.request('screen'); } catch { /* fine */ }
  const rewake = () => {
    if (document.visibilityState === 'visible') {
      navigator.wakeLock?.request('screen').then((l) => { wakeLock = l; }).catch(() => {});
    }
  };
  document.addEventListener('visibilitychange', rewake);

  const el = h(`
    <div class="lg">
      <div class="lg-head">
        <div class="brand">${brandMark()}The Game Room</div>
        <div class="lg-clock" data-clock></div>
      </div>
      <div class="lg-stage" data-stage></div>
    </div>`);
  root.appendChild(el);
  const stage = el.querySelector('[data-stage]');
  const clockEl = el.querySelector('[data-clock]');

  const tickClock = () => {
    clockEl.textContent = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  };
  tickClock();
  const clockInt = setInterval(tickClock, 20_000);

  // ---- live table cards ----------------------------------------------------
  const cards = new Map(); // code -> { el, source, view, unsub, status }

  function cardBar(card, info) {
    const meta = gameMeta(info.gameId);
    const s = card.source?.getState?.();
    const turnP = s && card.source.players[s.turn];
    const note = card.source?.getStatus?.()?.note;
    card.el.querySelector('.bar').innerHTML = `
      ${turnP ? avHtml(turnP) : ''}
      <span>${esc(meta?.name || info.gameId)}</span>
      <span class="muted">${turnP ? `· ${esc(turnP.name)}'s move` : ''} ${note ? `· ${esc(note)}` : ''}</span>`;
  }

  async function ensureCard(info) {
    let card = cards.get(info.code);
    if (!card) {
      card = { el: h('<div class="lg-card"><div class="bar"></div><div class="body"></div></div>'), status: null };
      card.el.dataset.code = info.code;
      cards.set(info.code, card);
      stage.appendChild(card.el);
    }
    if (info.status === 'open' && card.status !== 'open') {
      card.status = 'open';
      const faces = info.seats.filter((s) => s.taken)
        .map((s) => (s.profile ? avHtml(s.profile) : '<span class="av guest">?</span>')).join('');
      card.el.querySelector('.body').innerHTML = `
        <div class="table-surface"><div class="waiting">
          <div>Table opening…</div>
          <div class="faces">${faces}</div>
          <div class="code">${esc(info.code)}</div>
          <div class="hint" style="font-size:.55em;color:var(--ink-2)">join from any hub</div>
        </div></div>`;
      cardBar(card, info);
    }
    if (info.status === 'playing' && card.status !== 'playing') {
      card.status = 'playing';
      card.el.querySelector('.body').innerHTML =
        '<div class="table-surface"><div class="rail"><div data-board></div></div></div>';
      card.source = new RoomSource(info.code, { spectate: true });
      card.unsub = card.source.subscribe(async () => {
        if (!card.source.state || !card.source.meta) return;
        if (!card.view && !card.mounting) {
          card.mounting = true;
          const mod = await import(`/games/${card.source.meta.id}/view.js`);
          card.view = mod.mount(card.el.querySelector('[data-board]'), {
            players: card.source.players,
            localSeats: [],
            options: card.source.options,
            onMove: () => {},
            theme: 'felt',
            describe: card.source.engine?.describe,
          });
          card.mounting = false;
        }
        if (card.view) {
          card.view.update(card.source.state, [], null, card.source.getStatus());
          cardBar(card, info);
          fitStage(); // board content can change card height
        }
      });
    }
    cardBar(card, info);
  }

  function dropCard(code) {
    const card = cards.get(code);
    if (!card) return;
    card.unsub?.();
    card.view?.destroy?.();
    card.source?.destroy?.();
    send({ t: 'table.unwatch', code }).catch(() => {});
    card.el.remove();
    cards.delete(code);
  }

  // ---- idle ambience -------------------------------------------------------
  let idleEl = null;
  async function paintIdle() {
    if (!idleEl) {
      idleEl = h(`
        <div class="lg-idle">
          <div class="big">Who's playing next?</div>
          <div class="hint">Start a game on any tablet or phone and tap “Open to other devices” — it appears here.</div>
          <div class="panel"><div style="overflow-x:auto"><table class="stat-table" data-lb></table></div></div>
          <div class="recentline" data-recent></div>
        </div>`);
    }
    if (!idleEl.isConnected) stage.appendChild(idleEl);
    try {
      const rows = (await api.get('/api/stats/leaderboard?game=all'))
        .filter((r) => r.wins + r.losses + r.draws > 0).slice(0, 5);
      idleEl.querySelector('[data-lb]').innerHTML = rows.length ? `
        <tr><th>Player</th><th class="num">W</th><th class="num">L</th><th class="num">D</th></tr>
        ${rows.map((r) => `
          <tr><td><span class="who-cell">${avHtml(r)}${esc(r.name)}</span></td>
          <td class="num">${r.wins}</td><td class="num">${r.losses}</td><td class="num">${r.draws}</td></tr>`).join('')}` :
        '<tr><td class="muted">No games on the books yet — make some history.</td></tr>';
      const recent = await api.get('/api/matches?limit=1');
      if (recent[0]) {
        const m = recent[0];
        const winner = m.players.find((p) => p.result === 'win');
        idleEl.querySelector('[data-recent]').innerHTML = winner
          ? `Last game: <b>${esc(winner.name || 'Guest')}</b> won at ${esc(gameMeta(m.game_id)?.name || m.game_id)}`
          : '';
      }
    } catch { /* server hiccup — stay pretty */ }
  }
  const idleInt = setInterval(() => { if (cards.size === 0) paintIdle(); }, 3 * 60 * 1000);

  // ---- fit-to-screen sizing ------------------------------------------------
  // Board shapes differ per game, so no arithmetic: start from a generous
  // column width and shrink until nothing hangs off the television.
  let fitPending = false;
  function fitStage() {
    if (fitPending || cards.size === 0) return;
    fitPending = true;
    requestAnimationFrame(() => {
      const n = Math.min(cards.size, 4);
      const cols = n === 1 ? 1 : 2;
      let colW = Math.min(
        n === 1 ? innerWidth * 0.9 : innerWidth * 0.45,
        ((innerHeight - 110) / (n <= 2 ? 1 : 2)) * 1.1,
      );
      const apply = () => {
        stage.style.gridTemplateColumns = `repeat(${cols}, minmax(0, ${Math.round(colW)}px))`;
      };
      apply();
      let guard = 0;
      const settle = () => {
        // measure the stage's own content: .lg clips overflow, so it always
        // "fits" — the stage's scrollHeight tells the truth
        const overflow = stage.scrollHeight - stage.clientHeight;
        if (overflow > 4 && colW > 150 && guard++ < 12) {
          colW *= Math.max(0.7, 1 - overflow / Math.max(stage.clientHeight, 1));
          apply();
          requestAnimationFrame(settle);
        } else {
          fitPending = false;
        }
      };
      requestAnimationFrame(settle);
    });
  }
  window.addEventListener('resize', fitStage);

  // ---- reconcile from the live list ---------------------------------------
  const unsubNet = onMessage((msg) => {
    if (msg.t !== 'tables.list') return;
    const seen = new Set();
    const active = (msg.tables || []).slice(0, 4); // the TV shows at most 4
    for (const info of active) {
      seen.add(info.code);
      ensureCard(info);
    }
    for (const code of [...cards.keys()]) {
      if (!seen.has(code)) dropCard(code);
    }
    if (cards.size === 0) {
      paintIdle();
      stage.style.gridTemplateColumns = '';
    } else {
      idleEl?.remove();
      fitStage();
    }
  });

  paintIdle();
  return {
    destroy() {
      unsubNet();
      clearInterval(clockInt);
      clearInterval(idleInt);
      window.removeEventListener('resize', fitStage);
      for (const code of [...cards.keys()]) dropCard(code);
      document.removeEventListener('visibilitychange', rewake);
      wakeLock?.release?.().catch?.(() => {});
    },
  };
}
