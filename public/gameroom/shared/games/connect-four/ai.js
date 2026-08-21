// Connect Four AI: alpha-beta with a center-column + open-window heuristic.
import * as engine from './engine.js';
import { bestMove } from '../../ai/minimax.js';
import { COLS, ROWS } from './engine.js';

function windows() {
  const out = [];
  const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      for (const [dr, dc] of dirs) {
        const er = r + 3 * dr, ec = c + 3 * dc;
        if (er < 0 || er >= ROWS || ec < 0 || ec >= COLS) continue;
        out.push([0, 1, 2, 3].map((i) => (r + i * dr) * COLS + (c + i * dc)));
      }
    }
  }
  return out;
}
const WINDOWS = windows();

function evaluate(state, me) {
  const b = state.board;
  let score = 0;
  for (const w of WINDOWS) {
    let mine = 0, theirs = 0;
    for (const i of w) {
      if (b[i] === me) mine++;
      else if (b[i] !== null) theirs++;
    }
    if (mine && theirs) continue;
    if (mine === 3) score += 60;
    else if (mine === 2) score += 9;
    else if (theirs === 3) score -= 70;
    else if (theirs === 2) score -= 9;
  }
  for (let r = 0; r < ROWS; r++) {
    const c = b[r * COLS + 3];
    if (c === me) score += 5;
    else if (c !== null) score -= 5;
  }
  return score;
}

export function chooseMove(state, level, rng = Math.random) {
  const depth = level >= 3 ? 8 : level === 2 ? 6 : 4;
  const timeMs = level >= 3 ? 1400 : level === 2 ? 800 : 350;
  return bestMove(engine, state, { evaluate, maxDepth: depth, timeMs, rng });
}
