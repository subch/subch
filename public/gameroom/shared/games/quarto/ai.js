// Quarto AI. Easy/Medium: place a win when possible and never hand over a
// piece the opponent can win with (when avoidable). Hard: full lookahead a
// few plies deep — the give/place structure falls out of the generic search.
import * as engine from './engine.js';
import { bestMove, safeRandomMove } from '../../ai/minimax.js';

export function chooseMove(state, level, rng = Math.random) {
  if (level <= 2) return safeRandomMove(engine, state, rng);
  return bestMove(engine, state, {
    evaluate: () => 0, // win/loss detection does the work at these depths
    maxDepth: 4,       // give → place → give → place
    timeMs: 1400,
    rng,
  });
}
