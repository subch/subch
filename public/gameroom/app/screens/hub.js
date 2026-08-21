import { session } from '../session.js';
import { api } from '../api.js';
import { navigate } from '../router.js';
import { h, avHtml, esc } from '../ui.js';
import { tileIcon } from '../pieces.js';
import { GAMES, gameMeta } from '/shared/games/index.js';
import { loginAs, brandMark } from './login.js';
import { onMessage, request } from '../net.js';
import { toast } from '../ui.js';

function ago(iso) {
  if (!iso) return 'never';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export async function hub(root) {
  const me = session.me;
  const [rivalry, played] = await Promise.all([
    api.get('/api/stats/rivalry').catch(() => null),
    api.get('/api/stats/games').catch(() => ({})),
  ]);

  const others = session.profiles.filter((p) => p.id !== me.id);
  const rivalryHtml = rivalry ? `
    <div class="rivalry">
      <div class="who">${avHtml(rivalry.aProfile)}${esc(rivalry.aProfile.name)}</div>
      <div class="score">${rivalry.aWins} – ${rivalry.bWins}</div>
      <div class="who">${esc(rivalry.bProfile.name)}${avHtml(rivalry.bProfile)}</div>
      <div class="cap">
        <span>${rivalry.topGame ? esc(gameMeta(rivalry.topGame)?.name || rivalry.topGame) : 'No games yet'}</span>
        ${rivalry.streakHolder ? `<span>· ${esc(rivalry.streakHolder === rivalry.a ? rivalry.aProfile.name : rivalry.bProfile.name)} on a ${rivalry.streakLen}-game streak</span>` : ''}
        <span>· last played ${ago(rivalry.lastPlayed)}</span>
        <button class="btn" data-again style="min-height:40px;padding:4px 14px">Play again</button>
      </div>
    </div>` : '';

  const el = h(`
    <div class="wrap">
      <div class="topbar">
        <div class="brand">${brandMark()}${esc(session.settings.siteName)}</div>
        <div class="family">
          <button class="chip me" data-profile>${avHtml(me)}${esc(me.name)}</button>
          ${others.map((p) => `<button class="chip" data-switch="${esc(p.id)}">${avHtml(p)}${esc(p.name)}</button>`).join('')}
        </div>
      </div>
      ${me.role === 'admin' && session.settings.syncAlerts?.length ? `
        <div class="recent-row" style="border-color:var(--accent-2);margin-bottom:14px">
          ⚠️ <b>${esc(session.settings.syncAlerts[0].name)}</b> synced ${session.settings.syncAlerts[0].count}
          records in a day — that smells automated. Worth a look.
        </div>` : ''}
      ${rivalryHtml}
      <div data-strip></div>
      <div class="section-title">Games</div>
      <div class="tiles">
        ${GAMES.map((g) => g.enabled ? `
          <button class="tile" data-game="${esc(g.id)}">
            <span class="ico">${tileIcon(g.id)}</span>
            <span><span class="nm">${esc(g.name)}</span><br>
            <span class="sub">${g.players.min === g.players.max ? g.players.min : `${g.players.min}–${g.players.max}`} players · ${played[g.id] ? `${played[g.id]} played` : 'new'}</span></span>
          </button>` : `
          <div class="tile soon">
            <span class="ico">${tileIcon(g.id)}</span>
            <span><span class="nm">${esc(g.name)}</span><br><span class="sub">coming soon</span></span>
          </div>`).join('')}
      </div>
      <div class="footlinks">
        <a href="#/stats">Leaderboard</a>
        <a href="#/profile">My profile</a>
        ${me.role === 'admin' ? '<a href="#/family">Family settings</a>' : ''}
      </div>
    </div>`);

  el.addEventListener('click', async (e) => {
    const tile = e.target.closest('[data-game]');
    if (tile) { navigate(`#/setup/${tile.dataset.game}`); return; }
    if (e.target.closest('[data-profile]')) { navigate('#/profile'); return; }
    const sw = e.target.closest('[data-switch]');
    if (sw) {
      const p = session.profile(sw.dataset.switch);
      if (p && await loginAs(p)) navigate('#/');
      return;
    }
    if (e.target.closest('[data-again]') && rivalry) {
      navigate(`#/setup/${rivalry.topGame || 'tic-tac-toe'}`);
      return;
    }
    const join = e.target.closest('[data-join]');
    if (join) {
      const code = join.dataset.join;
      const seat = Number(join.dataset.seat);
      try {
        await request({ t: 'table.join', code, seat },
          (x) => x.t === 'table.state' && x.table?.code === code);
        navigate(`#/lobby/${code}`);
      } catch (err) {
        toast(err.message);
      }
    }
  });

  // live "Open tables" strip, pushed from the table server
  const stripEl = el.querySelector('[data-strip]');
  function paintStrip(open) {
    const joinable = open.filter((t) => t.seats.some((s) => !s.taken) ||
      t.seats.some((s) => s.profile?.id === me.id));
    stripEl.innerHTML = joinable.length ? `
      <div class="section-title">Open tables</div>
      <div class="recent" style="margin-bottom:6px">
        ${joinable.map((t) => {
          const free = t.seats.find((s) => !s.taken);
          const mine = t.seats.find((s) => s.profile?.id === me.id);
          const who = t.seats.filter((s) => s.taken)
            .map((s) => s.profile?.name || 'Guest').join(', ');
          return `
            <div class="recent-row">
              <span style="font-weight:700">${esc(gameMeta(t.gameId)?.name || t.gameId)}</span>
              <span class="muted">${esc(who)}</span>
              <span class="spacer"></span>
              ${mine
                ? `<a class="btn" style="min-height:40px" href="#/lobby/${esc(t.code)}">Rejoin</a>`
                : free
                  ? `<button class="btn primary" style="min-height:40px" data-join="${esc(t.code)}" data-seat="${free.seat}">Join</button>`
                  : ''}
            </div>`;
        }).join('')}
      </div>` : '';
  }
  const unsubNet = onMessage((msg) => {
    if (msg.t === 'tables.list') paintStrip(msg.tables || []);
  });

  root.appendChild(el);
  return { destroy() { unsubNet(); } };
}
