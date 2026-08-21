// Checkers AI: alpha-beta; eval = men + 1.6×kings + advancement, from the
// plan's spec (mobility folded into search depth instead — cheaper).
import * as engine from './engine.js';
import { bestMove, safeRandomMove } from '../../ai/minimax.js';

function evaluate(state, me) {
  let score = 0;
  for (let i = 0; i < 64; i++) {
    const p = state.board[i];
    if (!p) continue;
    const r = (i / 8) | 0;
    // advancement: men are worth a shade more the closer they are to crowning
    const adv = p.k ? 0 : (p.p === 0 ? (7 - r) : r) * 0.04;
    const v = (p.k ? 1.6 : 1) + adv;
    score += p.p === me ? v : -v;
  }
  return score * 100;
}

export function chooseMove(state, level, rng = Math.random) {
  if (level <= 1 && rng() < 0.35) return safeRandomMove(engine, state, rng);
  if (level === 2 && rng() < 0.15) return safeRandomMove(engine, state, rng);
  const depth = level >= 3 ? 8 : level === 2 ? 4 : 3;
  const timeMs = level >= 3 ? 1500 : level === 2 ? 600 : 300;
  return bestMove(engine, state, { evaluate, maxDepth: depth, timeMs, rng });
}
