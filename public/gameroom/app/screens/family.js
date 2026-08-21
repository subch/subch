import { session } from '../session.js';
import { api } from '../api.js';
import { navigate } from '../router.js';
import { h, avHtml, esc, toast, confirmSheet, backBar, facePicker } from '../ui.js';

export async function family(root) {
  if (session.me.role !== 'admin') { navigate('#/'); return; }

  const el = h(`
    <div class="wrap">
      <div></div>
      <div class="setup">
        <div class="panel">
          <div class="section-title" style="margin:0">Players</div>
          <div class="seats" data-rows></div>
          <form data-add style="display:flex;gap:8px">
            <input class="input" name="name" placeholder="New player's name" maxlength="20" autocomplete="off">
            <button class="btn primary" style="flex:none">Add</button>
          </form>
        </div>
        <div class="panel">
          <div class="section-title" style="margin:0">Site name</div>
          <form data-site style="display:flex;gap:8px">
            <input class="input" name="siteName" value="${esc(session.settings.siteName)}" maxlength="40">
            <button class="btn" style="flex:none">Save</button>
          </form>
          <div class="section-title">Hub rivalry</div>
          <div class="h2h-pick" data-rival></div>
          <p class="muted" style="font-size:13px">Leave on Auto to show whoever has played the most this month.</p>
        </div>
      </div>
    </div>`);
  el.firstElementChild.replaceWith(backBar('Family settings', '#/'));

  const rowsEl = el.querySelector('[data-rows]');

  function paintRows() {
    rowsEl.innerHTML = session.profiles.map((p) => `
      <div class="fam-row">
        ${avHtml(p)}
        <span class="grow"><b>${esc(p.name)}</b>
          <span class="seat-tag">${p.role === 'admin' ? 'admin' : 'player'}${p.claimed ? '' : ' · no code yet'}${p.pinRequired ? '' : ' · no code needed'}</span>
        </span>
        <span class="mini-btns">
          <button class="btn" data-rename="${esc(p.id)}">Rename</button>
          <button class="btn" data-role="${esc(p.id)}">${p.role === 'admin' ? 'Make player' : 'Make admin'}</button>
          <button class="btn" data-pinreq="${esc(p.id)}">${p.pinRequired ? 'No code needed' : 'Require a code'}</button>
          <button class="btn" data-reset="${esc(p.id)}">Reset code</button>
          <button class="btn danger" data-del="${esc(p.id)}">Remove</button>
        </span>
      </div>`).join('');
  }

  function paintRival() {
    const r = session.settings.rivalry;
    const name = (id) => session.profile(id)?.name || id;
    el.querySelector('[data-rival]').innerHTML = `
      <button class="chip ${r ? '' : 'me'}" data-rival-auto>Auto</button>
      <button class="chip ${r ? 'me' : ''}" data-rival-pick>${r ? `${esc(name(r.a))} vs ${esc(name(r.b))}` : 'Pick a pair'}</button>`;
  }

  async function act(fn) {
    try { await fn(); await session.refresh(); paintRows(); paintRival(); }
    catch (e) { toast(e.message); }
  }

  el.addEventListener('click', async (e) => {
    const id = (attr) => e.target.closest(`[data-${attr}]`)?.dataset[attr];
    const rename = id('rename');
    if (rename) {
      const name = prompt('New name?', session.profile(rename)?.name || '');
      if (name) act(() => api.patch(`/api/profiles/${rename}`, { name: name.trim() }));
      return;
    }
    const role = id('role');
    if (role) {
      const p = session.profile(role);
      act(() => api.patch(`/api/profiles/${role}`, { role: p.role === 'admin' ? 'player' : 'admin' }));
      return;
    }
    const pinreq = id('pinreq');
    if (pinreq) {
      const p = session.profile(pinreq);
      act(() => api.patch(`/api/profiles/${pinreq}`, { pinRequired: !p.pinRequired }));
      return;
    }
    const reset = id('reset');
    if (reset) {
      const p = session.profile(reset);
      const ok = await confirmSheet({ title: `Reset ${p.name}'s code?`, body: 'The next code they enter becomes their new one.', yes: 'Reset it', no: 'Never mind' });
      if (ok) act(async () => { await api.post(`/api/profiles/${reset}/reset-pin`); toast(`${p.name}'s code is cleared`); });
      return;
    }
    const del = id('del');
    if (del) {
      const p = session.profile(del);
      const ok = await confirmSheet({ title: `Remove ${p.name}?`, body: 'Their stats stay in old matches but the profile goes away.', yes: 'Remove', no: 'Keep them', danger: true });
      if (ok) act(() => api.del(`/api/profiles/${del}`));
      return;
    }
    if (e.target.closest('[data-rival-auto]')) {
      act(() => api.put('/api/settings', { rivalry: null }));
      return;
    }
    if (e.target.closest('[data-rival-pick]')) {
      const a = await facePicker({ profiles: session.profiles, title: 'First rival?' });
      if (!a) return;
      const b = await facePicker({ profiles: session.profiles, title: 'Against?', exclude: [a.id] });
      if (!b) return;
      act(() => api.put('/api/settings', { rivalry: { a: a.id, b: b.id } }));
    }
  });

  el.querySelector('[data-add]').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = e.target.name.value.trim();
    if (!name) return;
    e.target.name.value = '';
    act(() => api.post('/api/profiles', { name }));
  });
  el.querySelector('[data-site]').addEventListener('submit', (e) => {
    e.preventDefault();
    act(() => api.put('/api/settings', { siteName: e.target.siteName.value.trim() }));
  });

  paintRows();
  paintRival();
  root.appendChild(el);
}
