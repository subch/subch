const routes = [];
let rootEl = null;
let current = null;

export function route(pattern, render, opts = {}) {
  routes.push({ segs: pattern.split('/').filter(Boolean), render, opts });
}

export function navigate(hash) {
  if (location.hash === hash) render();
  else location.hash = hash;
}

function match(segs, pathSegs) {
  if (segs.length !== pathSegs.length) return null;
  const params = {};
  for (let i = 0; i < segs.length; i++) {
    if (segs[i].startsWith(':')) params[segs[i].slice(1)] = decodeURIComponent(pathSegs[i]);
    else if (segs[i] !== pathSegs[i]) return null;
  }
  return params;
}

let guard = null;
export function setGuard(fn) { guard = fn; }

async function render() {
  const raw = location.hash.replace(/^#/, '') || '/';
  const [path, query] = raw.split('?');
  const pathSegs = path.split('/').filter(Boolean);
  for (const r of routes) {
    const params = match(r.segs, pathSegs);
    if (params) {
      if (guard) {
        const redirect = guard(path, r.opts);
        if (redirect) { navigate(redirect); return; }
      }
      current?.destroy?.();
      rootEl.className = 'app';
      rootEl.innerHTML = '';
      params.query = new URLSearchParams(query || '');
      current = (await r.render(rootEl, params)) || null;
      window.scrollTo(0, 0);
      return;
    }
  }
  navigate('#/');
}

export function start(el) {
  rootEl = el;
  window.addEventListener('hashchange', render);
  render();
}
