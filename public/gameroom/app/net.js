// One WebSocket to the table server, shared app-wide. Auto-reconnects with
// backoff; listeners get every parsed message plus a synthetic
// {t:'net.open'} after each (re)connect so sources can re-sync.
const listeners = new Set();
let ws = null;
let openPromise = null;
let backoff = 400;
let wanted = false;

function url() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${location.host}/ws`;
}

function emit(msg) {
  for (const fn of [...listeners]) {
    try { fn(msg); } catch (e) { console.error('net listener', e); }
  }
}

export function connect() {
  wanted = true;
  if (ws && ws.readyState === 1) return Promise.resolve();
  if (openPromise) return openPromise;
  openPromise = new Promise((resolve) => {
    ws = new WebSocket(url());
    ws.onopen = () => {
      backoff = 400;
      openPromise = null;
      emit({ t: 'net.open' });
      resolve();
    };
    ws.onmessage = (e) => {
      try { emit(JSON.parse(e.data)); } catch { /* ignore */ }
    };
    ws.onclose = () => {
      ws = null;
      openPromise = null;
      emit({ t: 'net.down' });
      if (wanted) {
        setTimeout(() => { if (wanted) connect(); }, backoff);
        backoff = Math.min(backoff * 2, 5000);
      }
    };
    ws.onerror = () => ws?.close();
  });
  return openPromise;
}

export async function send(msg) {
  await connect();
  ws.send(JSON.stringify(msg));
}

export function onMessage(fn) {
  listeners.add(fn);
  connect();
  return () => listeners.delete(fn);
}

// Ask the server something and wait for the first matching reply.
export function request(msg, matches, timeoutMs = 6000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { off(); reject(new Error('The table server is not answering')); }, timeoutMs);
    const off = onMessage((m) => {
      if (m.t === 'error') { clearTimeout(timer); off(); reject(new Error(m.text)); return; }
      if (matches(m)) { clearTimeout(timer); off(); resolve(m); }
    });
    send(msg).catch((e) => { clearTimeout(timer); off(); reject(e); });
  });
}
