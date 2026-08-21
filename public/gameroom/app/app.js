import { session } from './session.js';
import { route, start, setGuard, navigate } from './router.js';
import { injectDefs } from './pieces.js';
import { setMuted } from './sounds.js';
import { getCurrent } from './match/current.js';
import { login } from './screens/login.js';
import { hub } from './screens/hub.js';
import { setup } from './screens/setup.js';
import { table } from './screens/table.js';
import { result } from './screens/result.js';
import { stats } from './screens/stats.js';
import { profile } from './screens/profile.js';
import { family } from './screens/family.js';

injectDefs();
await session.init();
setMuted(session.me ? !session.me.sound : false);

setGuard((path) => {
  if (!session.me && path !== '/login') return '#/login';
  if (session.me && path === '/login') return '#/';
  return null;
});

route('/login', login);
route('/', hub);
route('/setup/:game', setup);
route('/play', table);
route('/result', result);
route('/stats', stats);
route('/profile', profile);
route('/family', family);

start(document.getElementById('app'));

// Test-only hooks, present only with ?debug=1 (used by e2e + screenshots).
if (new URLSearchParams(location.search).has('debug')) {
  window.__gr = {
    session,
    getCurrent,
    async playRandom(delay = 30) {
      const src = getCurrent();
      if (!src) throw new Error('no current match');
      while (!src.over) {
        const legal = src.getLegal();
        if (!legal.length) break;
        // tolerate races with UI timers (auto-pass) — re-pick from fresh legal
        try { await src.move(legal[(Math.random() * legal.length) | 0]); } catch { /* stale */ }
        await new Promise((r) => setTimeout(r, delay));
      }
      if (src.recording) await src.recording;
      return src.result;
    },
    async playMoves(moves, delay = 60) {
      const src = getCurrent();
      for (const m of moves) {
        await src.move(m);
        await new Promise((r) => setTimeout(r, delay));
      }
    },
    navigate,
  };
}
