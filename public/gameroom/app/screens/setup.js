import { session } from '../session.js';
import { api } from '../api.js';
import { navigate } from '../router.js';
import { h, avHtml, esc, pinPad, facePicker, toast, segRow, toggleRow, backBar } from '../ui.js';
import { gameMeta } from '/shared/games/index.js';
import { startLocalMatch } from '../match/controller.js';

const optsKey = (gameId) => `gr:opts:${session.me?.id}:${gameId}`;

export async function setup(root, params) {
  const meta = gameMeta(params.game);
  if (!meta || !meta.enabled) { navigate('#/'); return; }
  const me = session.me;

  // options: defaults ← saved
  const options = {};
  for (const o of meta.options || []) options[o.key] = o.default;
  try { Object.assign(options, JSON.parse(localStorage.getItem(optsKey(meta.id)) || '{}')); } catch { /* ignore */ }

  // seats: seat 0 is the logged-in player; the rest are added by tap-in
  const seats = new Array(meta.players.min).fill(null);
  seats[0] = { profileId: me.id, name: me.name, avatar: me.avatar, color: me.color, level: me.mathLevel, self: true };

  const el = h(`
    <div class="wrap">
      <div></div>
      <div class="setup">
        <div class="panel">
          <div class="section-title" style="margin-top:0">Players</div>
          <div class="seats" data-seats></div>
          <div data-addseat></div>
          <button class="btn ghost-btn" data-swap>⇅ Swap sides</button>
        </div>
        ${meta.options?.length ? '<div class="panel" data-options><div class="section-title" style="margin-top:0">Rules</div></div>' : ''}
        <button class="btn primary big" data-start>Start</button>
      </div>
    </div>`);
  el.firstElementChild.replaceWith(backBar(meta.name, '#/'));

  const seatsEl = el.querySelector('[data-seats]');
  const addEl = el.querySelector('[data-addseat]');
  const startBtn = el.querySelector('[data-start]');

  function paintSeats() {
    seatsEl.innerHTML = seats.map((s, i) => {
      if (!s) {
        return `<button class="seatrow empty" data-fill="${i}">Tap to add a player</button>`;
      }
      const av = s.guest ? '<span class="av guest med">?</span>' : avHtml({ color: s.color, avatar: s.avatar }, 'med');
      return `
        <div class="seatrow">
          ${av}
          <span><span class="face-name">${esc(s.name)}</span>
          <span class="seat-tag">${i === 0 ? 'goes first' : `seat ${i + 1}`}</span></span>
          ${s.self ? '' : `<button class="btn kick" data-kick="${i}">✕</button>`}
        </div>`;
    }).join('');
    const canAddMore = seats.length < meta.players.max;
    addEl.innerHTML = canAddMore ? '<button class="btn ghost-btn" data-more>+ Add another seat</button>' : '';
    startBtn.disabled = seats.some((s) => !s);
  }

  async function fillSeat(i) {
    const seated = seats.filter(Boolean).map((s) => s.profileId).filter(Boolean);
    const pick = await facePicker({
      profiles: session.profiles,
      title: 'Who takes this seat?',
      allowGuest: true,
      exclude: seated,
    });
    if (!pick) return;
    if (pick === 'guest') {
      seats[i] = { guest: true, name: 'Guest' };
      paintSeats();
      return;
    }
    // Everyone but the logged-in player needs a seat token from their PIN.
    try {
      let seatRes;
      if (!pick.pinRequired) {
        seatRes = await api.post('/api/seat', { profileId: pick.id });
      } else {
        seatRes = await pinPad(pick, {
          claim: !pick.claimed,
          verify: (pin) => api.post('/api/seat', { profileId: pick.id, pin }),
        });
        if (!seatRes) return;
      }
      seats[i] = {
        profileId: pick.id, seatToken: seatRes.seatToken,
        name: pick.name, avatar: pick.avatar, color: pick.color, level: pick.mathLevel,
      };
      paintSeats();
    } catch (e) {
      toast(e.message);
    }
  }

  el.addEventListener('click', async (e) => {
    const fill = e.target.closest('[data-fill]');
    if (fill) { fillSeat(Number(fill.dataset.fill)); return; }
    const kick = e.target.closest('[data-kick]');
    if (kick) {
      const i = Number(kick.dataset.kick);
      if (seats.length > meta.players.min) seats.splice(i, 1);
      else seats[i] = null;
      paintSeats();
      return;
    }
    if (e.target.closest('[data-more]') && seats.length < meta.players.max) {
      seats.push(null);
      paintSeats();
      return;
    }
    if (e.target.closest('[data-swap]')) {
      seats.reverse();
      paintSeats();
      return;
    }
    if (e.target.closest('[data-start]')) {
      if (seats.some((s) => !s)) return;
      try { localStorage.setItem(optsKey(meta.id), JSON.stringify(options)); } catch { /* ignore */ }
      await startLocalMatch({ gameId: meta.id, options: { ...options }, seats: seats.slice() });
      navigate('#/play');
    }
  });

  // options UI rendered straight from meta.options
  const optPanel = el.querySelector('[data-options]');
  if (optPanel) {
    for (const o of meta.options) {
      if (o.type === 'boolean') {
        optPanel.appendChild(toggleRow(o.label, options[o.key], (v) => { options[o.key] = v; }));
      } else if (o.type === 'choice') {
        optPanel.appendChild(segRow(o.label, o.choices, options[o.key], (v) => { options[o.key] = v; }));
      }
    }
  }

  paintSeats();
  root.appendChild(el);
}
