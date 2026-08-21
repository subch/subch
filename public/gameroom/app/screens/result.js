import { getCurrent, setCurrent } from '../match/current.js';
import { navigate } from '../router.js';
import { h, avHtml, esc } from '../ui.js';
import { crownIcon } from '../pieces.js';
import { sfx } from '../sounds.js';
import { api } from '../api.js';
import { avatarSvg } from '../avatars.js';

const CONFETTI_COLORS = ['var(--accent)', 'var(--accent-2)', 'var(--p1)', 'var(--p2)'];

function confettiHtml() {
  let s = '<div class="confetti">';
  for (let i = 0; i < 40; i++) {
    s += `<i style="left:${(Math.random() * 100).toFixed(1)}%;background:${CONFETTI_COLORS[i % 4]};animation-delay:${(Math.random() * 0.5).toFixed(2)}s"></i>`;
  }
  return s + '</div>';
}

export async function result(root) {
  const source = getCurrent();
  if (!source || !source.result) { navigate('#/'); return; }
  const st = source.result;
  const winner = (st.winner !== null && st.winner !== undefined) ? source.players[st.winner] : null;

  const el = h(`
    <div class="wrap result-screen">
      <div class="panel result">
        ${winner ? confettiHtml() : ''}
        ${winner ? `<div class="crownbig">${crownIcon(72)}</div>` : ''}
        ${winner ? avHtml(winner, 'med') : ''}
        <div class="big">${winner ? `${esc(winner.name)} wins!` : "It's a draw"}</div>
        <div class="muted" style="font-size:14px">${esc(st.reason || '')}</div>
        <div class="delta" data-delta></div>
        <div class="row">
          <button class="btn primary" data-rematch>Rematch</button>
          <button class="btn" data-hub>Back to hub</button>
        </div>
      </div>
    </div>`);
  root.appendChild(el);

  if (winner) sfx.win(); else sfx.chime();

  const deltaEl = el.querySelector('[data-delta]');
  // Heidi trots across the card when the winner is on a 5+ win streak
  async function maybeHeidi(rec) {
    if (!winner?.profileId || !rec || rec.mode === 'practice') return;
    try {
      const rows = await api.get(`/api/stats/leaderboard?game=${source.meta.id}`);
      const row = rows.find((r) => r.id === winner.profileId);
      if (row && row.streak >= 5 && !el.querySelector('.heidi')) {
        el.querySelector('.result').insertAdjacentHTML('beforeend',
          `<div class="heidi">${avatarSvg('dog')}</div>`);
      }
    } catch { /* no dog today */ }
  }

  function paintDelta(rec) {
    if (!rec) return;
    maybeHeidi(rec);
    if (rec.rated) {
      deltaEl.innerHTML = rec.seats.map((s) => {
        const p = source.players[s.seat];
        const d = Math.round(s.delta);
        return `${esc(p.name)} <b>${d >= 0 ? '+' : ''}${d}</b>`;
      }).join(' · ');
    } else {
      deltaEl.textContent = 'Saved to the match history';
    }
  }
  if (source.recorded) paintDelta(source.recorded);
  else {
    const unsub = source.subscribe((evt) => {
      if (evt.type === 'recorded') { paintDelta(evt.recorded); unsub(); }
      if (evt.type === 'recordError') { deltaEl.textContent = "Couldn't save this one"; unsub(); }
    });
  }

  el.querySelector('[data-rematch]').onclick = () => {
    source.rematch();
    navigate('#/play');
  };
  el.querySelector('[data-hub]').onclick = () => {
    setCurrent(null);
    navigate('#/');
  };
}
