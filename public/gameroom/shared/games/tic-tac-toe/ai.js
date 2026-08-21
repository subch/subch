// Tic-tac-toe AI. Hard plays perfectly; Easy plays random 40% of the time.
import * as engine from './engine.js';
import { bestMove, randomMove } from '../../ai/minimax.js';

export function chooseMove(state, level, rng = Math.random) {
  if (level <= 1 && rng() < 0.4) return randomMove(engine, state, rng);
  if (level === 2 && rng() < 0.15) return randomMove(engine, state, rng);
  const depth = level >= 3 ? 9 : level === 2 ? 3 : 2;
  return bestMove(engine, state, { evaluate: () => 0, maxDepth: depth, timeMs: 400, rng });
}
