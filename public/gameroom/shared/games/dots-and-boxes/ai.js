// Dots & Boxes AI.
//   Easy   — random edge that doesn't hand over a box (random-safe)
//   Medium — greedy: complete a box when possible, else random-safe
//   Hard   — greedy, else safe, else open the SHORTEST chain (simulates the
//            opponent's greedy run for every sacrifice and gifts the fewest)
import * as engine from './engine.js';

function completingMoves(state) {
  const out = [];
  for (const m of engine.legalMoves(state)) {
    const next = engine.apply(state, m);
    if (next.turn === state.turn && !engine.status(next).over) out.push(m);
    else if (engine.status(next).over) {
      const gained = engine.scoresOf(next)[state.turn] - engine.scoresOf(state)[state.turn];
      if (gained > 0) out.push(m);
    }
  }
  return out;
}

// edges that do NOT leave a 3-sided box for the opponent
function safeMoves(state) {
  const out = [];
  for (const m of engine.legalMoves(state)) {
    const next = engine.apply(state, m);
    if (next.turn === state.turn) continue; // that's a completing move, not "safe"
    const oppTakes = completingMoves(next);
    if (oppTakes.length === 0) out.push(m);
  }
  return out;
}

// how many boxes would a greedy opponent milk after this sacrifice?
function giftSize(state, move) {
  let s = engine.apply(state, move);
  const baseTotal = engine.scoresOf(s).reduce((a, b) => a + b, 0);
  let guard = 0;
  while (!engine.status(s).over && s.turn !== state.turn && guard++ < 200) {
    const takes = completingMoves(s);
    if (!takes.length) break;
    s = engine.apply(s, takes[0]);
  }
  return engine.scoresOf(s).reduce((a, b) => a + b, 0) - baseTotal;
}

const pick = (arr, rng) => arr[(rng() * arr.length) | 0];

export function chooseMove(state, level, rng = Math.random) {
  const takes = completingMoves(state);
  if (level >= 2 && takes.length) return pick(takes, rng);
  const safe = safeMoves(state);
  if (level <= 1 && takes.length && !safe.length) return pick(takes, rng);
  if (safe.length) return pick(safe, rng);
  const all = engine.legalMoves(state);
  if (level >= 3) {
    let best = null, bestGift = Infinity;
    for (const m of all) {
      const g = giftSize(state, m);
      if (g < bestGift) { bestGift = g; best = m; }
    }
    if (best) return best;
  }
  return pick(all, rng);
}
