// Chess AI: material + piece-square tables over the generic alpha-beta,
// depth 2/3/4 by level. (DECISIONS.md notes Stockfish-WASM as the future
// upgrade if Dad ever wants a real fight.)
import * as engine from './engine.js';
import { bestMove } from '../../ai/minimax.js';

const VAL = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };

// compact piece-square tables (white's view, a8 first — matches boardOf)
const PST_P = [
  0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50,
  10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5,
  0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5,
  5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0,
];
const PST_N = [
  -50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40,
  -30, 0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30,
  -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30,
  -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50,
];
const PST_K = [
  -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30,
  -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30,
  -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10,
  20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20,
];
const PST = { p: PST_P, n: PST_N, b: PST_N, r: null, q: null, k: PST_K };

function evaluate(state, me) {
  const board = engine.boardOf(state); // a8 first
  let score = 0; // white-positive
  for (let i = 0; i < 64; i++) {
    const sq = board[i];
    if (!sq) continue;
    const pst = PST[sq.t];
    const bonus = pst ? (sq.c === 'w' ? pst[i] : pst[63 - i]) : 0;
    const v = VAL[sq.t] + bonus;
    score += sq.c === 'w' ? v : -v;
  }
  return me === 0 ? score : -score;
}

export function chooseMove(state, level, rng = Math.random) {
  const depth = level >= 3 ? 4 : level === 2 ? 3 : 2;
  const timeMs = level >= 3 ? 2500 : level === 2 ? 1400 : 600;
  return bestMove(engine, state, { evaluate, maxDepth: depth, timeMs, rng });
}
