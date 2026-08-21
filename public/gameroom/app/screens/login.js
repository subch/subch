import { session } from '../session.js';
import { navigate } from '../router.js';
import { h, avHtml, pinPad, esc } from '../ui.js';
import { CHESS_PATHS } from '../pieces.js';

export const brandMark = () =>
  `<span class="mark"><svg viewBox="0 0 100 90"><path d="${CHESS_PATHS.knight}" fill="var(--accent-ink)"/></svg></span>`;

// Shared by the login screen and the hub's user-switch chips.
export async function loginAs(profile) {
  if (!profile.pinRequired) {
    await session.login(profile.id);
    return true;
  }
  const result = await pinPad(profile, {
    claim: !profile.claimed,
    verify: (pin) => session.login(profile.id, pin),
  });
  return !!result;
}

export async function login(root) {
  const { profiles, settings } = session;
  const el = h(`
    <div class="wrap login">
      <div class="brand">${brandMark()}${esc(settings.siteName)}</div>
      <div class="login-grid">
        ${profiles.map((p) => `
          <button class="face" data-id="${esc(p.id)}">
            ${avHtml(p, 'big')}
            <span class="face-name">${esc(p.name)}</span>
            ${!p.claimed && p.pinRequired
              ? '<span class="face-sub">pick your code</span>'
              : '<span class="face-sub muted">tap to play</span>'}
          </button>`).join('')}
      </div>
      <div class="login-hint">Forgot your code? Ask Mom or Dad — they can reset it in Family Settings.</div>
    </div>`);
  el.addEventListener('click', async (e) => {
    const face = e.target.closest('.face');
    if (!face) return;
    const p = session.profile(face.dataset.id);
    if (p && await loginAs(p)) navigate('#/');
  });
  root.appendChild(el);
}
