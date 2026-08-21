// Small vanilla component kit: avatars, sheets, toasts, the PIN pad, and the
// face picker. Everything is touch-first (56px targets) and theme-tokened.
import { avatarSvg } from './avatars.js';
import { sfx } from './sounds.js';

export function h(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export const esc = (s) => String(s ?? '')
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;');

export function avHtml(profile, cls = '') {
  if (!profile) return `<span class="av guest ${cls}">?</span>`;
  return `<span class="av ${cls}" style="background:${esc(profile.color) || '#888'}">${avatarSvg(profile.avatar)}</span>`;
}

// ---------- toast ----------------------------------------------------------

let toastTimer = null;
export function toast(text, ms = 2200) {
  document.querySelector('.toast')?.remove();
  const el = h(`<div class="toast">${esc(text)}</div>`);
  document.body.appendChild(el);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.remove(), ms);
}

// ---------- overlay sheets -------------------------------------------------

export function sheet(contentEl, { dismissable = true } = {}) {
  const overlay = h('<div class="overlay"><div class="sheet"></div></div>');
  overlay.querySelector('.sheet').appendChild(contentEl);
  const close = () => { overlay.classList.add('closing'); setTimeout(() => overlay.remove(), 160); };
  if (dismissable) {
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  }
  document.body.appendChild(overlay);
  return { overlay, close };
}

export function confirmSheet({ title, body = '', yes = 'Yes', no = 'Not now', danger = false }) {
  return new Promise((resolve) => {
    const el = h(`
      <div class="confirm">
        <h3>${esc(title)}</h3>
        ${body ? `<p class="muted">${esc(body)}</p>` : ''}
        <div class="row">
          <button class="btn ${danger ? 'danger' : 'primary'}" data-yes>${esc(yes)}</button>
          <button class="btn" data-no>${esc(no)}</button>
        </div>
      </div>`);
    const { close } = sheet(el, { dismissable: false });
    el.querySelector('[data-yes]').onclick = () => { close(); resolve(true); };
    el.querySelector('[data-no]').onclick = () => { close(); resolve(false); };
  });
}

// ---------- PIN pad --------------------------------------------------------
// pinPad(profile, { claim, verify }) → resolves verify()'s return value, or
// null on cancel. claim=true collects the code twice before calling verify.

export function pinPad(profile, { claim = false, verify, subtitle }) {
  return new Promise((resolve) => {
    let pin = '';
    let firstPin = null;
    let busy = false;

    const sub = subtitle || (claim ? 'Pick your 4-digit code' : 'Enter your 4-digit code');
    const el = h(`
      <div class="panel pin">
        <div class="turn">
          ${avHtml(profile)}
          <div><div class="t1">Hi, ${esc(profile.name)}</div><div class="t2" data-sub>${esc(sub)}</div></div>
        </div>
        <div class="dots"><i></i><i></i><i></i><i></i></div>
        <div class="pin-err" data-err></div>
        <div class="keys">
          <button class="key">1</button><button class="key">2</button><button class="key">3</button>
          <button class="key">4</button><button class="key">5</button><button class="key">6</button>
          <button class="key">7</button><button class="key">8</button><button class="key">9</button>
          <button class="key ghost" data-cancel>Cancel</button><button class="key">0</button><button class="key ghost" data-back>⌫</button>
        </div>
      </div>`);
    const { close } = sheet(el);
    const dots = [...el.querySelectorAll('.dots i')];
    const subEl = el.querySelector('[data-sub]');
    const errEl = el.querySelector('[data-err]');

    const paint = () => dots.forEach((d, i) => d.classList.toggle('f', i < pin.length));
    const err = (msg) => {
      errEl.textContent = msg;
      el.classList.add('shake');
      sfx.deny();
      setTimeout(() => el.classList.remove('shake'), 400);
      pin = '';
      paint();
    };

    async function submit() {
      if (claim && firstPin === null) {
        firstPin = pin; pin = ''; paint();
        subEl.textContent = 'Type it again to make sure';
        return;
      }
      if (claim && pin !== firstPin) {
        firstPin = null;
        subEl.textContent = 'Pick your 4-digit code';
        err("Those didn't match — start over");
        return;
      }
      busy = true;
      try {
        const value = await verify(pin);
        close();
        resolve(value);
      } catch (e) {
        busy = false;
        if (e.retryIn) {
          let left = e.retryIn;
          errEl.textContent = `Too many tries — wait ${left}s`;
          const tick = setInterval(() => {
            left -= 1;
            if (left <= 0) { clearInterval(tick); errEl.textContent = ''; }
            else errEl.textContent = `Too many tries — wait ${left}s`;
          }, 1000);
          pin = ''; paint();
        } else {
          if (claim) { firstPin = null; subEl.textContent = 'Pick your 4-digit code'; }
          err(e.message);
        }
      }
    }

    el.addEventListener('click', (e) => {
      const key = e.target.closest('.key');
      if (!key || busy) return;
      if (key.hasAttribute('data-cancel')) { close(); resolve(null); return; }
      if (key.hasAttribute('data-back')) { pin = pin.slice(0, -1); paint(); return; }
      if (pin.length >= 4) return;
      pin += key.textContent.trim();
      sfx.tap();
      paint();
      if (pin.length === 4) setTimeout(submit, 120);
    });
  });
}

// ---------- face picker ----------------------------------------------------
// Resolves the picked profile, the string 'guest' when allowed, or null.

export function facePicker({ profiles, title = 'Who is it?', allowGuest = false, allowComputer = false, exclude = [] }) {
  return new Promise((resolve) => {
    const list = profiles.filter((p) => !exclude.includes(p.id));
    const el = h(`
      <div class="picker">
        <h3>${esc(title)}</h3>
        <div class="picker-grid">
          ${list.map((p) => `
            <button class="face" data-id="${esc(p.id)}">
              ${avHtml(p, 'big')}
              <span class="face-name">${esc(p.name)}</span>
              ${!p.claimed ? '<span class="face-sub">pick your code</span>' : ''}
            </button>`).join('')}
          ${allowComputer ? `
            <button class="face" data-computer>
              ${avHtml({ color: '#6d7480', avatar: 'robot' }, 'big')}
              <span class="face-name">Computer</span>
            </button>` : ''}
          ${allowGuest ? `
            <button class="face" data-guest>
              <span class="av big guest">?</span>
              <span class="face-name">Guest</span>
            </button>` : ''}
        </div>
      </div>`);
    const { close } = sheet(el);
    el.addEventListener('click', (e) => {
      const face = e.target.closest('.face');
      if (!face) return;
      close();
      if (face.hasAttribute('data-guest')) resolve('guest');
      else if (face.hasAttribute('data-computer')) resolve('computer');
      else resolve(list.find((p) => p.id === face.dataset.id) || null);
    });
  });
}

// Easy / Medium / Hard for a computer seat.
export function levelPicker() {
  return new Promise((resolve) => {
    const el = h(`
      <div class="confirm">
        <h3>How strong?</h3>
        <div class="row">
          <button class="btn" data-l="1">Easy</button>
          <button class="btn" data-l="2">Medium</button>
          <button class="btn" data-l="3">Hard</button>
        </div>
      </div>`);
    const { close } = sheet(el);
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-l]');
      if (b) { close(); resolve(Number(b.dataset.l)); }
    });
  });
}

// ---------- form bits ------------------------------------------------------

export function segRow(label, choices, value, onChange) {
  const el = h(`
    <div class="optrow">
      <span class="optlabel">${esc(label)}</span>
      <div class="seg">
        ${choices.map(([v, text]) => `
          <button class="seg-btn" data-v="${esc(v)}" aria-pressed="${String(v) === String(value)}">${esc(text)}</button>`).join('')}
      </div>
    </div>`);
  el.addEventListener('click', (e) => {
    const btn = e.target.closest('.seg-btn');
    if (!btn) return;
    el.querySelectorAll('.seg-btn').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
    onChange(btn.dataset.v);
  });
  return el;
}

export function toggleRow(label, value, onChange) {
  const el = h(`
    <div class="optrow">
      <span class="optlabel">${esc(label)}</span>
      <button class="toggle" role="switch" aria-checked="${!!value}"><span class="knob"></span></button>
    </div>`);
  const btn = el.querySelector('.toggle');
  btn.onclick = () => {
    const next = btn.getAttribute('aria-checked') !== 'true';
    btn.setAttribute('aria-checked', String(next));
    onChange(next);
  };
  return el;
}

export function backBar(title, backHash = '#/') {
  return h(`
    <div class="backbar">
      <a class="btn ghost-btn" href="${backHash}">‹ Back</a>
      <h1 class="backbar-title">${esc(title)}</h1>
      <span class="backbar-spacer"></span>
    </div>`);
}
