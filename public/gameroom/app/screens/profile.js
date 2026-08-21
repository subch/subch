import { session } from '../session.js';
import { api } from '../api.js';
import { navigate } from '../router.js';
import { h, esc, pinPad, toast, toggleRow, segRow, backBar } from '../ui.js';
import { avatarSvg, AVATAR_NAMES } from '../avatars.js';
import { applyTheme } from '../theme.js';
import { setMuted } from '../sounds.js';

const THEME_INFO = [
  ['felt', 'Green Felt Club', ['#0d2b21', '#2f7c53', '#d9b24a', '#b8322a']],
  ['walnut', 'Walnut Study', ['#1a110b', '#4b3020', '#c9973a', '#e8dcc2']],
  ['candy', 'Candy Shop', ['#fff0f6', '#ffd3e3', '#ff5c8a', '#5b8def']],
  ['arcade', 'Midnight Arcade', ['#070b1a', '#121b3d', '#2ef2c5', '#ff4fa3']],
];

const COLORS = ['#c98a2e', '#b8322a', '#1f8a8a', '#3f7ad9', '#7b4fd6', '#ff5c8a', '#2e8b57', '#d9552e', '#4a4a4a', '#0f7bb5', '#a3266e', '#6b8e23'];

export async function profile(root) {
  const me = session.me;

  const el = h(`
    <div class="wrap">
      <div></div>
      <div class="setup">
        <div class="panel">
          <div class="section-title" style="margin:0">My theme</div>
          <div class="theme-cards" data-themes>
            ${THEME_INFO.map(([id, name, cols]) => `
              <button class="theme-card ${me.theme === id ? 'on' : ''}" data-theme="${id}">
                <span class="swatch">${cols.map((c) => `<i style="background:${c}"></i>`).join('')}</span>
                <span class="l">${name}</span>
              </button>`).join('')}
          </div>
        </div>
        <div class="panel">
          <div class="section-title" style="margin:0">My look</div>
          <div class="avatar-grid" data-avatars>
            ${AVATAR_NAMES.map((a) => `
              <button class="av-pick ${me.avatar === a ? 'on' : ''}" data-avatar="${a}">
                <span class="av med" style="background:${esc(me.color)}">${avatarSvg(a)}</span>
              </button>`).join('')}
          </div>
          <div class="color-grid" data-colors>
            ${COLORS.map((c) => `<button class="col-pick ${me.color === c ? 'on' : ''}" data-color="${c}" style="background:${c}"></button>`).join('')}
          </div>
        </div>
        <div class="panel" data-prefs>
          <div class="section-title" style="margin:0">Settings</div>
        </div>
        <div class="panel">
          <button class="btn" data-pin>Change my code</button>
          <button class="btn" data-logout>Sign out</button>
        </div>
      </div>
    </div>`);
  el.firstElementChild.replaceWith(backBar('My profile', '#/'));

  async function save(patch, silent = false) {
    try {
      session.me = await api.patch(`/api/profiles/${me.id}`, patch);
      await session.refresh();
      if (!silent) toast('Saved');
    } catch (e) { toast(e.message); }
  }

  const prefs = el.querySelector('[data-prefs]');
  prefs.appendChild(toggleRow('Sounds', me.sound, (v) => { setMuted(!v); save({ sound: v }, true); }));
  prefs.appendChild(segRow('Math Duel level', [[1, '1'], [2, '2'], [3, '3'], [4, '4'], [5, '5']], me.mathLevel, (v) => save({ mathLevel: Number(v) }, true)));

  el.addEventListener('click', async (e) => {
    const th = e.target.closest('[data-theme]');
    if (th) {
      el.querySelectorAll('.theme-card').forEach((c) => c.classList.toggle('on', c === th));
      applyTheme(th.dataset.theme);
      save({ theme: th.dataset.theme }, true);
      return;
    }
    const av = e.target.closest('[data-avatar]');
    if (av) {
      el.querySelectorAll('.av-pick').forEach((c) => c.classList.toggle('on', c === av));
      save({ avatar: av.dataset.avatar }, true);
      return;
    }
    const col = e.target.closest('[data-color]');
    if (col) {
      el.querySelectorAll('.col-pick').forEach((c) => c.classList.toggle('on', c === col));
      el.querySelectorAll('.avatar-grid .av').forEach((a) => { a.style.background = col.dataset.color; });
      save({ color: col.dataset.color }, true);
      return;
    }
    if (e.target.closest('[data-pin]')) {
      const current = await pinPad(me, { subtitle: 'First, your current code', verify: async (pin) => pin });
      if (!current) return;
      const ok = await pinPad(me, {
        claim: true,
        verify: (pin) => api.patch(`/api/profiles/${me.id}`, { pin, currentPin: current }),
      });
      if (ok) toast('Code changed');
      return;
    }
    if (e.target.closest('[data-logout]')) {
      await session.logout();
      navigate('#/login');
    }
  });

  root.appendChild(el);
}
