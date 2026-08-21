// Mancala AI: alpha-beta; eval = store difference + stones on your side
// (banked beats in-play, in-play beats the opponent's).
import * as engine from './engine.js';
import { bestMove, safeRandomMove } from '../../ai/minimax.js';

function evaluate(state, me) {
  const other = 1 - me;
  const side = (seat) => {
    const base = seat === 0 ? 0 : 6;
    let n = 0;
    for (let i = base; i < base + 6; i++) n += state.pits[i];
    return n;
  };
  return (state.stores[me] - state.stores[other]) * 10 +
         (side(me) - side(other)) * 3;
}

export function chooseMove(state, level, rng = Math.random) {
  if (level <= 1 && rng() < 0.35) return safeRandomMove(engine, state, rng);
  if (level === 2 && rng() < 0.15) return safeRandomMove(engine, state, rng);
  const depth = level >= 3 ? 10 : level === 2 ? 5 : 3;
  const timeMs = level >= 3 ? 1400 : level === 2 ? 600 : 300;
  return bestMove(engine, state, { evaluate, maxDepth: depth, timeMs, rng });
}
