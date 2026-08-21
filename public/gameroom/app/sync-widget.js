// Road-trip-only widget (injected by build-roadtrip.js, never loaded on the
// LAN app): a small chip that links this device to a name on the online
// server and quietly pushes local match history up to it. Deliberately
// low-effort identity — the name IS the login, per the owner's design.
const SYNC_URL = 'https://play.subch.us';
const KEY = 'gr-sync-v1';

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
}
let state = load(); // { profileId, name, pushed: [remoteIds] }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* full */ } };

const chip = document.createElement('button');
chip.id = 'gr-sync-chip';
chip.style.cssText = `
  position: fixed; right: 12px; bottom: 12px; z-index: 90;
  font: 700 12px system-ui, sans-serif; padding: 9px 14px; border-radius: 999px;
  border: 1px solid rgba(255,255,255,.25); cursor: pointer;
  background: rgba(20,30,25,.82); color: #f3ead6; backdrop-filter: blur(6px);
  box-shadow: 0 4px 14px rgba(0,0,0,.35);`;
document.body.appendChild(chip);

function paint(text) {
  chip.textContent = text ||
    (state.profileId ? `● synced as ${state.name}` : '○ save my stats online');
}
paint();

async function call(path, body) {
  const res = await fetch(SYNC_URL + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

async function push() {
  if (!state.profileId || !navigator.onLine) return;
  const all = window.__grRoadtrip?.matches() || [];
  const done = new Set(state.pushed || []);
  const fresh = all.filter((m) => !done.has(m.matchId));
  if (!fresh.length) { paint(); return; }
  paint(`↑ syncing ${fresh.length}…`);
  try {
    const out = await call('/api/sync', { profileId: state.profileId, matches: fresh });
    state.pushed = [...done, ...fresh.map((m) => m.matchId)].slice(-1000);
    save();
    paint(`● ${state.name} · ${out.total} games saved`);
    setTimeout(paint, 4000);
  } catch {
    paint('○ offline — will retry');
    setTimeout(paint, 4000);
  }
}

chip.addEventListener('click', async () => {
  if (state.profileId) {
    const change = confirm(`Synced as ${state.name}. OK = sync now, Cancel = unlink this device.`);
    if (change) push();
    else { state = {}; save(); paint(); }
    return;
  }
  const name = prompt('Pick your name — same name, same stats, any device:');
  if (!name || !name.trim()) return;
  paint('… linking');
  try {
    const profile = await call('/api/join', { name: name.trim() });
    state = { profileId: profile.id, name: profile.name, pushed: [] };
    save();
    paint();
    push();
  } catch (e) {
    paint(`✗ ${String(e.message).slice(0, 30)}`);
    setTimeout(paint, 3500);
  }
});

// push on load, whenever a game likely just finished, and every few minutes
setTimeout(push, 4000);
setInterval(push, 4 * 60 * 1000);
window.addEventListener('hashchange', () => {
  if (location.hash.startsWith('#/result')) setTimeout(push, 2500);
});
