// Dots & Boxes. Draw an edge; completing a box claims it (in your color)
// and grants another turn; when every edge is drawn, most boxes wins (ties
// draw among the top scorers). Edges remember who drew them so the view can
// color them. n = boxes per side.
//   h edges: index r*n + c        (r 0..n,   c 0..n-1)
//   v edges: index r*(n+1) + c    (r 0..n-1, c 0..n)
export { meta } from './meta.js';

export function init(options, seed, seats) {
  const n = Number(options?.size) || 5;
  return {
    n,
    players: seats ? seats.length : 2,
    turn: 0,
    rng: seed | 0,
    h: Array((n + 1) * n).fill(null),   // null | seat that drew it
    v: Array(n * (n + 1)).fill(null),
    boxes: Array(n * n).fill(null),     // null | owning seat
    drawnEdges: 0,
    lastEdge: null,
  };
}

const totalEdges = (n) => (n + 1) * n + n * (n + 1);

function boxComplete(s, r, c) {
  const n = s.n;
  return s.h[r * n + c] !== null && s.h[(r + 1) * n + c] !== null &&
         s.v[r * (n + 1) + c] !== null && s.v[r * (n + 1) + c + 1] !== null;
}

export function legalMoves(state) {
  if (state.drawnEdges === totalEdges(state.n)) return [];
  const moves = [];
  state.h.forEach((e, i) => { if (e === null) moves.push({ type: 'edge', o: 'h', i }); });
  state.v.forEach((e, i) => { if (e === null) moves.push({ type: 'edge', o: 'v', i }); });
  return moves;
}

export function apply(state, move) {
  if (!move || move.type !== 'edge' || (move.o !== 'h' && move.o !== 'v') ||
      !Number.isInteger(move.i) || move.i < 0 || move.i >= state[move.o].length ||
      state[move.o][move.i] !== null) {
    throw new Error('illegal move');
  }
  const s = JSON.parse(JSON.stringify(state));
  const n = s.n;
  s[move.o][move.i] = s.turn;
  s.drawnEdges += 1;
  s.lastEdge = { o: move.o, i: move.i };

  // which boxes touch this edge?
  const candidates = [];
  if (move.o === 'h') {
    const r = Math.floor(move.i / n), c = move.i % n;
    if (r > 0) candidates.push([r - 1, c]);
    if (r < n) candidates.push([r, c]);
  } else {
    const r = Math.floor(move.i / (n + 1)), c = move.i % (n + 1);
    if (c > 0) candidates.push([r, c - 1]);
    if (c < n) candidates.push([r, c]);
  }
  let claimed = 0;
  for (const [r, c] of candidates) {
    if (s.boxes[r * n + c] === null && boxComplete(s, r, c)) {
      s.boxes[r * n + c] = s.turn;
      claimed += 1;
    }
  }
  if (claimed === 0) s.turn = (s.turn + 1) % s.players;
  return s;
}

export function scoresOf(state) {
  const scores = Array(state.players).fill(0);
  for (const b of state.boxes) if (b !== null) scores[b] += 1;
  return scores;
}

export function status(state) {
  const scores = scoresOf(state);
  if (state.drawnEdges === totalEdges(state.n)) {
    const top = Math.max(...scores);
    const leaders = scores.map((v, i) => [v, i]).filter(([v]) => v === top);
    return {
      over: true,
      winner: leaders.length === 1 ? leaders[0][1] : null,
      reason: 'most boxes',
      scores,
    };
  }
  return { over: false, winner: null, scores };
}

export function view(state) {
  return state;
}

export function describe(state, move) {
  return 'draws a line';
}
