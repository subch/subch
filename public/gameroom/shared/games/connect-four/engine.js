// Connect Four. 7×6 standard board; drop a disc in a column, first to four
// in a row (any direction) wins. Seat 0 moves first; rematch alternation is
// the controller's job. Cells are r*7+c with row 0 at the top.
export { meta } from './meta.js';

export const COLS = 7;
export const ROWS = 6;

export function init(options, seed) {
  return {
    board: Array(ROWS * COLS).fill(null),
    turn: 0,
    players: 2,
    rng: seed | 0,
    count: 0,
  };
}

const at = (b, r, c) => (r < 0 || r >= ROWS || c < 0 || c >= COLS) ? undefined : b[r * COLS + c];

export function landingRow(state, col) {
  for (let r = ROWS - 1; r >= 0; r--) {
    if (state.board[r * COLS + col] === null) return r;
  }
  return -1;
}

export function winningLine(board) {
  const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const p = at(board, r, c);
      if (p === null || p === undefined) continue;
      for (const [dr, dc] of dirs) {
        if (at(board, r + dr, c + dc) === p &&
            at(board, r + 2 * dr, c + 2 * dc) === p &&
            at(board, r + 3 * dr, c + 3 * dc) === p) {
          return { winner: p, line: [0, 1, 2, 3].map((i) => (r + i * dr) * COLS + (c + i * dc)) };
        }
      }
    }
  }
  return null;
}

export function legalMoves(state) {
  if (winningLine(state.board) || state.count === ROWS * COLS) return [];
  const moves = [];
  for (let c = 0; c < COLS; c++) {
    if (landingRow(state, c) >= 0) moves.push({ type: 'drop', col: c });
  }
  return moves;
}

export function apply(state, move) {
  if (!move || move.type !== 'drop' ||
      !legalMoves(state).some((m) => m.col === move.col)) {
    throw new Error('illegal move');
  }
  const board = state.board.slice();
  const r = landingRow(state, move.col);
  board[r * COLS + move.col] = state.turn;
  return {
    ...state,
    board,
    turn: (state.turn + 1) % state.players,
    count: state.count + 1,
  };
}

export function status(state) {
  const win = winningLine(state.board);
  if (win) return { over: true, winner: win.winner, reason: 'four in a row', line: win.line };
  if (state.count === ROWS * COLS) return { over: true, winner: null, reason: 'board is full' };
  return { over: false, winner: null };
}

export function view(state) {
  return state;
}

export function describe(state, move) {
  return `drops in column ${move.col + 1}`;
}
