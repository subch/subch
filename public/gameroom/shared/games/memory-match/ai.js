// Memory Match AI. Its "memory" is the public seen[] array — the same
// information a human at the table has. Easy ignores it; Medium remembers
// but fumbles sometimes; Hard plays the known pairs cold.
import * as engine from './engine.js';

export function chooseMove(state, level, rng = Math.random) {
  const moves = engine.legalMoves(state);
  if (moves[0]?.type === 'continue') return moves[0];

  const open = moves.map((m) => m.cell);
  const random = () => ({ type: 'flip', cell: open[(rng() * open.length) | 0] });
  if (level <= 1 || (level === 2 && rng() < 0.35)) return random();

  const knownRank = (i) => (state.seen[i] && state.owner[i] === null ? state.cells[i] : null);

  if (state.up.length === 1) {
    // second flip: take the known partner if we've seen it
    const want = state.cells[state.up[0]];
    const partner = open.find((i) => knownRank(i) === want);
    return partner !== undefined ? { type: 'flip', cell: partner } : random();
  }
  // first flip: a known pair among unmatched seen cells?
  const byRank = {};
  for (const i of open) {
    const r = knownRank(i);
    if (r === null) continue;
    if (byRank[r] !== undefined) return { type: 'flip', cell: byRank[r] };
    byRank[r] = i;
  }
  // otherwise explore an unseen cell (never waste a turn re-flipping singles)
  const unseen = open.filter((i) => !state.seen[i]);
  if (unseen.length) return { type: 'flip', cell: unseen[(rng() * unseen.length) | 0] };
  return random();
}
