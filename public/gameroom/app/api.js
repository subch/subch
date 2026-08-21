// Road Trip edition API: the same surface as api.js, backed by localStorage
// instead of the family server. Pass-and-play only, stats live on the device,
// no PINs (it's a car — whoever holds the tablet is trusted). The build
// script copies this file OVER app/api.js in the static bundle; the LAN app
// never loads it.

const KEY = 'gr-roadtrip-v1';

const DEFAULT_PROFILES = [
  { id: 'dad', name: 'Dad', avatar: 'crown', color: '#c98a2e', mathLevel: 5, sort: 0 },
  { id: 'mom', name: 'Mom', avatar: 'queen', color: '#b8322a', mathLevel: 5, sort: 1 },
  { id: 'marshall', name: 'Marshall', avatar: 'rocket', color: '#1f8a8a', mathLevel: 3, sort: 2 },
  { id: 'wyatt', name: 'Wyatt', avatar: 'dino', color: '#3f7ad9', mathLevel: 1, sort: 3 },
];

function load() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    if (d && Array.isArray(d.profiles)) return d;
  } catch { /* fresh */ }
  return {
    profiles: DEFAULT_PROFILES.map((p) => ({ ...p, theme: 'felt', sound: true })),
    me: null,
    settings: { siteName: 'The Game Room', rivalry: null },
    matches: [],
  };
}

let db = load();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { /* full */ } };

const err = (status, message) => {
  const e = new Error(message);
  e.status = status;
  throw e;
};

const pub = (p) => ({
  id: p.id, name: p.name, avatar: p.avatar, color: p.color, role: 'admin',
  pinRequired: false, claimed: true, mathLevel: p.mathLevel || 1,
});
const own = (p) => ({ ...pub(p), theme: p.theme || 'felt', sound: p.sound !== false });
const profileOf = (id) => db.profiles.find((p) => p.id === id) || null;

// ---- stats helpers (mirrors the server's shapes) --------------------------

function seatResults(seats, winnerSeat, scores) {
  if (Array.isArray(scores) && scores.length === seats.length) {
    const top = Math.max(...scores);
    const n = scores.filter((s) => s === top).length;
    return seats.map((_, i) => (scores[i] < top ? 'loss' : n > 1 ? 'draw' : 'win'));
  }
  if (winnerSeat === null || winnerSeat === undefined) return seats.map(() => 'draw');
  return seats.map((s) => (s.seat === winnerSeat ? 'win' : 'loss'));
}

function leaderboard(game) {
  const rows = db.profiles.map((p) => ({
    ...pub(p), rating: null, wins: 0, losses: 0, draws: 0, streak: 0, best_streak: 0,
  }));
  const by = Object.fromEntries(rows.map((r) => [r.id, r]));
  const matches = db.matches.filter((m) => !m.voided && (!game || game === 'all' || m.gameId === game));
  for (const m of [...matches].reverse()) {
    for (const s of m.seats) {
      const row = s.profileId && by[s.profileId];
      if (!row) continue;
      if (s.result === 'win') { row.wins++; row.streak = Math.max(row.streak, 0) + 1; }
      else if (s.result === 'loss') { row.losses++; row.streak = Math.min(row.streak, 0) - 1; }
      else { row.draws++; row.streak = 0; }
      row.best_streak = Math.max(row.best_streak, row.streak);
    }
  }
  return rows;
}

function pairRows(a, b, game) {
  return db.matches.filter((m) => {
    if (m.voided || (game && m.gameId !== game)) return false;
    const ids = m.seats.map((s) => s.profileId);
    return ids.includes(a) && ids.includes(b);
  });
}

function h2h(a, b, game) {
  const rows = pairRows(a, b, game);
  let aWins = 0, bWins = 0, draws = 0;
  const aRes = (m) => m.seats.find((s) => s.profileId === a)?.result;
  for (const m of rows) {
    const r = aRes(m);
    if (r === 'win') aWins++; else if (r === 'loss') bWins++; else draws++;
  }
  let streakHolder = null, streakLen = 0;
  for (const m of rows) {
    const r = aRes(m);
    if (r === 'draw') break;
    const holder = r === 'win' ? a : b;
    if (streakLen === 0) { streakHolder = holder; streakLen = 1; continue; }
    if (holder === streakHolder) streakLen++; else break;
  }
  const counts = {};
  for (const m of rows) counts[m.gameId] = (counts[m.gameId] || 0) + 1;
  return {
    a, b, aWins, bWins, draws, total: rows.length,
    last10: rows.slice(0, 10).map((m) => {
      const r = aRes(m);
      return r === 'win' ? 'a' : r === 'loss' ? 'b' : 'd';
    }),
    streakHolder: streakLen > 1 ? streakHolder : null, streakLen,
    lastPlayed: rows[0]?.endedAt || null,
    topGame: Object.entries(counts).sort((x, y) => y[1] - x[1])[0]?.[0] || null,
  };
}

// ---- the route table ------------------------------------------------------

function handle(method, path, body) {
  const [p, q] = path.split('?');
  const query = new URLSearchParams(q || '');
  const seg = p.split('/').filter(Boolean); // ['api', ...]

  if (p === '/api/health') return { ok: true, version: 'roadtrip', uptime: 0 };
  if (p === '/api/profiles' && method === 'GET') {
    return db.profiles.slice().sort((x, y) => (x.sort || 0) - (y.sort || 0)).map(pub);
  }
  if (p === '/api/me') return db.me ? own(profileOf(db.me) || err(401, 'gone')) : null;
  if (p === '/api/login') {
    const prof = profileOf(body.profileId) || err(404, 'No such profile');
    db.me = prof.id; save();
    return { ...own(prof), claimedNow: false };
  }
  if (p === '/api/logout') { db.me = null; save(); return { ok: true }; }
  if (p === '/api/seat') {
    const prof = profileOf(body.profileId) || err(404, 'No such profile');
    return { seatToken: 'local', profile: pub(prof), claimedNow: false };
  }
  if (p === '/api/settings' && method === 'GET') return db.settings;
  if (p === '/api/settings' && method === 'PUT') {
    if (body.siteName !== undefined) db.settings.siteName = String(body.siteName).slice(0, 40) || db.settings.siteName;
    if (body.rivalry !== undefined) db.settings.rivalry = body.rivalry;
    save();
    return db.settings;
  }

  if (seg[1] === 'profiles' && seg.length === 3 && method === 'PATCH') {
    const prof = profileOf(seg[2]) || err(404, 'No such profile');
    for (const k of ['name', 'avatar', 'color', 'theme', 'mathLevel']) {
      if (body[k] !== undefined) prof[k] = body[k];
    }
    if (body.sound !== undefined) prof.sound = !!body.sound;
    save();
    return own(prof);
  }
  if (p === '/api/profiles' && method === 'POST') {
    const name = String(body.name || '').trim() || err(400, 'Name?');
    let id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'player';
    while (profileOf(id)) id += '2';
    const prof = {
      id, name, avatar: body.avatar || 'star', color: body.color || '#3f7ad9',
      theme: 'felt', sound: true, mathLevel: 1,
      sort: db.profiles.length,
    };
    db.profiles.push(prof); save();
    return pub(prof);
  }
  if (seg[1] === 'profiles' && seg.length === 3 && method === 'DELETE') {
    if (db.profiles.length <= 1) err(400, 'Someone has to stay');
    db.profiles = db.profiles.filter((x) => x.id !== seg[2]);
    if (db.me === seg[2]) db.me = null;
    save();
    return { ok: true };
  }
  if (seg[1] === 'profiles' && seg[3] === 'reset-pin') return { ok: true };

  if (p === '/api/matches' && method === 'POST') {
    const results = seatResults(body.seats, body.winnerSeat ?? null, body.scores || null);
    const match = {
      matchId: Math.random().toString(36).slice(2, 10),
      gameId: body.gameId, mode: body.mode || 'local',
      endedAt: new Date().toISOString(), reason: body.reason || '',
      winnerSeat: body.winnerSeat ?? null, voided: false,
      seats: body.seats.map((s, i) => ({
        seat: s.seat, profileId: s.guest ? null : s.profileId,
        result: results[i], ratingBefore: null, ratingAfter: null, delta: null,
      })),
    };
    db.matches.unshift(match);
    db.matches = db.matches.slice(0, 300);
    save();
    return { matchId: match.matchId, endedAt: match.endedAt, rated: false, seats: match.seats };
  }
  if (p === '/api/matches' && method === 'GET') {
    const limit = Number(query.get('limit')) || 20;
    const game = query.get('game');
    const prof = query.get('profile');
    return db.matches
      .filter((m) => !m.voided && (!game || m.gameId === game) &&
        (!prof || m.seats.some((s) => s.profileId === prof)))
      .slice(0, limit)
      .map((m) => ({
        id: m.matchId, game_id: m.gameId, mode: m.mode, ended_at: m.endedAt,
        winner_seat: m.winnerSeat, reason: m.reason,
        players: m.seats.map((s) => {
          const pr = s.profileId ? profileOf(s.profileId) : null;
          return { seat: s.seat, profile_id: s.profileId, result: s.result,
            name: pr?.name || null, avatar: pr?.avatar, color: pr?.color };
        }),
      }));
  }
  if (seg[1] === 'matches' && seg.length === 3 && method === 'DELETE') {
    const m = db.matches.find((x) => x.matchId === seg[2]) || err(404, 'No such match');
    m.voided = true; save();
    return { ok: true };
  }

  if (p === '/api/stats/leaderboard') return leaderboard(query.get('game'));
  if (p === '/api/stats/games') {
    const out = {};
    for (const m of db.matches) if (!m.voided) out[m.gameId] = (out[m.gameId] || 0) + 1;
    return out;
  }
  if (p === '/api/stats/h2h') {
    return h2h(query.get('a'), query.get('b'), query.get('game') || null);
  }
  if (seg[1] === 'stats' && seg[2] === 'profile') {
    const prof = profileOf(seg[3]) || err(404, 'No such profile');
    return { ...pub(prof), perGame: [] };
  }
  if (p === '/api/stats/rivalry') {
    let pair = db.settings.rivalry;
    if (!pair) {
      const counts = {};
      for (const m of db.matches) {
        if (m.voided || m.seats.length !== 2) continue;
        const [x, y] = m.seats.map((s) => s.profileId);
        if (!x || !y) continue;
        const k = [x, y].sort().join('|');
        counts[k] = (counts[k] || 0) + 1;
      }
      const top = Object.entries(counts).sort((a2, b2) => b2[1] - a2[1])[0];
      if (top) { const [x, y] = top[0].split('|'); pair = { a: x, b: y }; }
    }
    if (!pair) {
      const [x, y] = db.profiles;
      if (!x || !y) return null;
      pair = { a: x.id, b: y.id };
    }
    const pa = profileOf(pair.a), pb = profileOf(pair.b);
    if (!pa || !pb) return null;
    return { ...h2h(pa.id, pb.id, null), aProfile: pub(pa), bProfile: pub(pb) };
  }

  err(404, `No road-trip route for ${method} ${p}`);
}

async function req(method, path, body) {
  await Promise.resolve(); // stay async like real fetch
  return handle(method, path, body);
}

export const api = {
  get: (p) => req('GET', p),
  post: (p, b = {}) => req('POST', p, b),
  patch: (p, b) => req('PATCH', p, b),
  put: (p, b) => req('PUT', p, b),
  del: (p) => req('DELETE', p),
};

// hook for the online-sync widget (roadtrip build only)
window.__grRoadtrip = {
  matches: () => db.matches.filter((m) => !m.voided),
};
