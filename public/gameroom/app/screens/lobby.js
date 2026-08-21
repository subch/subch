// Table lobby: the host waits here for joiners (and taps Start); joiners
// wait here for the host. Both land in #/play when the game begins.
import { session } from '../session.js';
import { navigate } from '../router.js';
import { h, avHtml, esc, sheet, toast, backBar } from '../ui.js';
import { RoomSource } from '../match/room-source.js';
import { setCurrent } from '../match/current.js';
import { send } from '../net.js';

const CSS = `
.lobby-code { font-family: var(--font-display); font-size: clamp(40px, 9vw, 64px); font-weight: 700;
  letter-spacing: .35em; text-indent: .35em; color: var(--accent); text-align: center;
  text-shadow: var(--glow) var(--accent); }
.lobby-sub { text-align: center; color: var(--ink-2); font-size: 14px; }
.tvurl { font: 700 18px/1.4 ui-monospace, Menlo, Consolas, monospace; background: var(--surface-2);
  border-radius: var(--radius-s); padding: 14px 18px; user-select: text; -webkit-user-select: text; text-align: center; }
`;

export async function lobby(root, params) {
  if (!document.querySelector('style[data-lobby]')) {
    const style = document.createElement('style');
    style.dataset.lobby = '';
    style.textContent = CSS;
    document.head.appendChild(style);
  }
  const code = params.code.toUpperCase();
  const source = new RoomSource(code);

  const el = h(`
    <div class="wrap">
      <div></div>
      <div class="setup">
        <div class="panel" style="gap:10px">
          <div class="lobby-code">${esc(code)}</div>
          <div class="lobby-sub">Everyone on the wifi sees this table on their hub — or they can join with the code.</div>
        </div>
        <div class="panel">
          <div class="section-title" style="margin:0" data-title>Waiting for players…</div>
          <div class="seats" data-seats></div>
          <button class="btn primary big" data-start hidden>Start the game</button>
          <div class="lobby-sub" data-waiting hidden>Waiting for the host to start…</div>
        </div>
        <div class="panel" style="grid-template-columns:1fr 1fr;display:grid;gap:10px">
          <button class="btn" data-tv>Show on TV</button>
          <button class="btn" data-leave>Leave table</button>
        </div>
      </div>
    </div>`);
  el.firstElementChild.replaceWith(backBar('Table', '#/'));
  root.appendChild(el);

  const seatsEl = el.querySelector('[data-seats]');
  const startBtn = el.querySelector('[data-start]');
  const waitingEl = el.querySelector('[data-waiting]');
  const titleEl = el.querySelector('[data-title]');

  let started = false;

  function paint() {
    const isHost = source.host && session.me?.id === source.host.id;
    titleEl.textContent = source.meta ? `${source.meta.name} — pick your seats` : 'Waiting…';
    seatsEl.innerHTML = source.players.map((p) => `
      <div class="seatrow ${p.profileId || p.guest ? '' : 'empty'}">
        ${p.profileId || p.guest
          ? `${p.guest ? '<span class="av guest med">?</span>' : avHtml(p, 'med')}
             <span><span class="face-name">${esc(p.name)}</span>
             <span class="seat-tag">${p.seat === 0 ? 'goes first' : `seat ${p.seat + 1}`}${p.connected ? '' : ' · connecting…'}</span></span>`
          : '<span class="muted" style="font-weight:700">Open seat — join from any device</span>'}
      </div>`).join('');
    const filled = source.players.filter((p) => p.profileId || p.guest).length;
    startBtn.hidden = !isHost;
    startBtn.disabled = filled < (source.meta?.players.min || 2);
    waitingEl.hidden = !!isHost;
  }

  const unsub = source.subscribe(() => {
    if (source.tableStatus === 'playing' && !started) {
      started = true;
      unsub();
      setCurrent(source);
      navigate('#/play');
      return;
    }
    paint();
  });

  startBtn.onclick = () => send({ t: 'table.start' });
  el.querySelector('[data-leave]').onclick = () => {
    source.abandon();
    navigate('#/');
  };
  el.querySelector('[data-tv]').onclick = () => {
    const content = h(`
      <div class="confirm">
        <h3>Watch on the TV</h3>
        <p class="muted">Open this once on the TV device and just leave it — it idles as a family
        lounge screen and shows every game live as tables open:</p>
        <div class="tvurl">${esc(`${location.origin}/#/tv`)}</div>
        <p class="muted" style="font-size:12px">Just this table: ${esc(`${location.origin}/#/tv/${code}`)}</p>
        <button class="btn primary" data-done>Done</button>
      </div>`);
    const { close } = sheet(content);
    content.querySelector('[data-done]').onclick = close;
  };

  paint();
  return { destroy() { if (!started) { unsub(); source.destroy(); } } };
}
