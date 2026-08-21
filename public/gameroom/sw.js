// @generated — offline cache for the Road Trip edition
const CACHE = 'gameroom-roadtrip-34c02f40ea';
const ASSETS = ["./","./app/api.js","./app/app.js","./app/avatars.js","./app/base.css","./app/match/controller.js","./app/match/current.js","./app/match/local-source.js","./app/pieces.js","./app/router.js","./app/screens/family.js","./app/screens/hub.js","./app/screens/login.js","./app/screens/profile.js","./app/screens/result.js","./app/screens/setup.js","./app/screens/stats.js","./app/screens/table.js","./app/session.js","./app/sounds.js","./app/theme.js","./app/themes.css","./app/ui.js","./fonts/chakra-petch-latin-700-normal.woff2","./fonts/cormorant-garamond-latin-700-normal.woff2","./fonts/fraunces-latin-500-normal.woff2","./fonts/fraunces-latin-700-normal.woff2","./fonts/fredoka-latin-500-normal.woff2","./fonts/fredoka-latin-700-normal.woff2","./fonts/nunito-sans-latin-400-normal.woff2","./fonts/nunito-sans-latin-600-normal.woff2","./fonts/nunito-sans-latin-700-normal.woff2","./games/checkers/view.js","./games/chess/sprite.js","./games/chess/view.js","./games/connect-four/view.js","./games/crazy-8s/view.js","./games/quarto/view.js","./games/tic-tac-toe/view.js","./games/war/view.js","./icons/favicon.svg","./icons/icon-180.png","./icons/icon-192.png","./icons/icon-512.png","./index.html","./manifest.webmanifest","./shared/games/checkers/engine.js","./shared/games/checkers/engine.test.js","./shared/games/checkers/meta.js","./shared/games/chess/engine.js","./shared/games/chess/engine.test.js","./shared/games/chess/meta.js","./shared/games/connect-four/engine.js","./shared/games/connect-four/engine.test.js","./shared/games/connect-four/meta.js","./shared/games/crazy-8s/engine.js","./shared/games/crazy-8s/engine.test.js","./shared/games/crazy-8s/meta.js","./shared/games/fuzz.js","./shared/games/go/engine.js","./shared/games/go/meta.js","./shared/games/go/README.md","./shared/games/index.js","./shared/games/quarto/engine.js","./shared/games/quarto/engine.test.js","./shared/games/quarto/meta.js","./shared/games/tic-tac-toe/engine.js","./shared/games/tic-tac-toe/engine.test.js","./shared/games/tic-tac-toe/meta.js","./shared/games/war/engine.js","./shared/games/war/engine.test.js","./shared/games/war/meta.js","./shared/rng.js","./shared/vendor/chess.js"];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) =>
    Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((hit) => hit ||
      fetch(e.request).catch(() => caches.match('./', { ignoreSearch: true })))
  );
});
