import { session } from '../session.js';
import { api } from '../api.js';
import { h, avHtml, esc, facePicker, toast, backBar, confirmSheet } from '../ui.js';
import { GAMES, gameMeta } from '/shared/games/index.js';

export async function stats(root) {
  const isAdmin = session.me.role === 'admin';
  let tab = 'all';
  let h2hA = null, h2hB = null;

  const el = h(`
    <div class="wrap">
      <div></div>
      <div class="tabs" data-tabs></div>
      <div class="panel" style="margin-bottom:18px">
        <div class="section-title" style="margin:0">Leaderboard</div>
        <div style="overflow-x:auto"><table class="stat-table" data-board></table></div>
      </div>
      <div class="panel" style="margin-bottom:18px">
        <div class="section-title" style="margin:0">Head to head</div>
        <div class="h2h-pick" data-h2h-pick></div>
        <div data-h2h></div>
      </div>
      <div class="panel">
        <div class="section-title" style="margin:0">Recent matches</div>
        <div class="recent" data-recent></div>
      </div>
    </div>`);
  el.firstElementChild.replaceWith(backBar('Leaderboard', '#/'));

  const tabsEl = el.querySelector('[data-tabs]');
  const boardEl = el.querySelector('[data-board]');
  const h2hPickEl = el.querySelector('[data-h2h-pick]');
  const h2hEl = el.querySelector('[data-h2h]');
  const recentEl = el.querySelector('[data-recent]');

  function paintTabs() {
    const games = GAMES.filter((g) => g.enabled);
    tabsEl.innerHTML = [
      `<button class="seg-btn" data-tab="all" aria-pressed="${tab === 'all'}">All games</button>`,
      ...games.map((g) => `<button class="seg-btn" data-tab="${g.id}" aria-pressed="${tab === g.id}">${esc(g.name)}</button>`),
    ].join('');
  }

  async function paintBoard() {
    const rows = await api.get(`/api/stats/leaderboard?game=${tab}`);
    const rated = tab !== 'all';
    boardEl.innerHTML = `
      <tr><th>Player</th>${rated ? '<th class="num">Rating</th>' : ''}<th class="num">W</th><th class="num">L</th><th class="num">D</th><th class="num">Streak</th></tr>
      ${rows.map((r) => `
        <tr>
          <td><span class="who-cell">${avHtml(r)}${esc(r.name)}</span></td>
          ${rated ? `<td class="num">${r.rating !== null ? Math.round(r.rating) : '—'}</td>` : ''}
          <td class="num">${r.wins}</td><td class="num">${r.losses}</td><td class="num">${r.draws}</td>
          <td class="num">${r.streak > 0 ? `W${r.streak}` : r.streak < 0 ? `L${-r.streak}` : '—'}</td>
        </tr>`).join('')}`;
  }

  function paintH2hPick() {
    const face = (p, slot) => p
      ? `<button class="chip" data-slot="${slot}">${avHtml(p)}${esc(p.name)}</button>`
      : `<button class="chip" data-slot="${slot}">${avHtml(null)}Pick</button>`;
    h2hPickEl.innerHTML = `${face(h2hA, 'a')}<span class="muted" style="font-weight:700">vs</span>${face(h2hB, 'b')}`;
  }

  async function paintH2h() {
    if (!h2hA || !h2hB) { h2hEl.innerHTML = '<p class="muted center">Pick two players to compare.</p>'; return; }
    const d = await api.get(`/api/stats/h2h?a=${h2hA.id}&b=${h2hB.id}${tab !== 'all' ? `&game=${tab}` : ''}`);
    h2hEl.innerHTML = `
      <div class="rivalry" style="margin:0">
        <div class="who">${avHtml(h2hA)}${esc(h2hA.name)}</div>
        <div class="score">${d.aWins} – ${d.bWins}</div>
        <div class="who">${esc(h2hB.name)}${avHtml(h2hB)}</div>
        <div class="cap">
          <span>${d.draws} draws</span>
          <span>· last 10:</span>
          <span class="dots10">${d.last10.map((x) => `<i class="${x === 'd' ? '' : x}"></i>`).join('') || '<span class="muted">none yet</span>'}</span>
          ${d.streakHolder ? `<span>· ${esc(d.streakHolder === d.a ? h2hA.name : h2hB.name)} on a ${d.streakLen}-game run</span>` : ''}
        </div>
      </div>`;
  }

  async function paintRecent() {
    const list = await api.get(`/api/matches?limit=15${tab !== 'all' ? `&game=${tab}` : ''}`);
    recentEl.innerHTML = list.length ? list.map((m) => {
      const gname = gameMeta(m.game_id)?.name || m.game_id;
      const players = m.players.map((p) => {
        const label = p.name || 'Guest';
        return p.result === 'win' ? `<b>${esc(label)}</b>` : esc(label);
      }).join(' vs ');
      const when = new Date(m.ended_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      return `
        <div class="recent-row">
          <span style="font-weight:700">${esc(gname)}</span>
          <span>${players}</span>
          <span class="muted">${m.winner_seat === null ? 'draw' : ''} ${esc(when)}</span>
          <span class="spacer"></span>
          ${isAdmin ? `<button class="btn" data-void="${m.id}" style="min-height:38px;padding:4px 12px;font-size:12px">Void</button>` : ''}
        </div>`;
    }).join('') : '<p class="muted center">Nothing here yet — go play something!</p>';
  }

  async function refresh() {
    paintTabs();
    paintH2hPick();
    await Promise.all([paintBoard(), paintH2h(), paintRecent()]);
  }

  el.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-tab]');
    if (t) { tab = t.dataset.tab; refresh(); return; }
    const slot = e.target.closest('[data-slot]');
    if (slot) {
      const p = await facePicker({ profiles: session.profiles, title: 'Compare who?' });
      if (p) {
        if (slot.dataset.slot === 'a') h2hA = p; else h2hB = p;
        paintH2hPick();
        paintH2h();
      }
      return;
    }
    const v = e.target.closest('[data-void]');
    if (v) {
      const ok = await confirmSheet({ title: 'Void this match?', body: 'Rating changes are reversed and tallies recomputed.', yes: 'Void it', no: 'Leave it', danger: true });
      if (ok) {
        try { await api.del(`/api/matches/${v.dataset.void}`); toast('Match voided'); refresh(); }
        catch (err) { toast(err.message); }
      }
    }
  });

  await refresh();
  root.appendChild(el);
}
