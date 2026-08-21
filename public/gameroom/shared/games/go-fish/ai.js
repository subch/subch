// Go Fish AI. Easy asks randomly from its hand; Medium/Hard remember what
// opponents asked for (that rank is in their hand!) via public lastAction
// history isn't kept, so they use the simple tells available in state: ask
// for your deepest rank, target whoever holds the most cards.
import * as engine from './engine.js';
import { rank } from './engine.js';

export function chooseMove(state, level, rng = Math.random) {
  const moves = engine.legalMoves(state);
  if (moves[0]?.type !== 'ask') return moves[0]; // draw5 / pass

  if (level <= 1) return moves[(rng() * moves.length) | 0];

  const hand = state.hands[state.turn];
  const counts = {};
  for (const c of hand) counts[rank(c)] = (counts[rank(c)] || 0) + 1;
  // deepest rank first — closest to a book
  const bestRank = Number(Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]);
  const candidates = moves.filter((m) => m.rank === bestRank);
  const pool = candidates.length ? candidates : moves;
  // Hard targets the fattest hand; Medium picks among targets randomly
  if (level >= 3) {
    pool.sort((a, b) => state.hands[b.target].length - state.hands[a.target].length);
    return pool[0];
  }
  return pool[(rng() * pool.length) | 0];
}
