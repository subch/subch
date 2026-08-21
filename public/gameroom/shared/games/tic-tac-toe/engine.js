// Tic-tac-toe. Seat 0 is X and always moves first; rematch side-swapping is
// the controller's job. State and moves are plain JSON; apply never mutates.
export { meta } from './meta.js';

const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

const CELLS = [
  'top left', 'top middle', 'top right',
  'middle left', 'center', 'middle right',
  'bottom left', 'bottom middle', 'bottom right',
];

export function init(options, seed, seats) {
  return {
    board: Array(9).fill(null),
    turn: 0,
    players: seats ? seats.length : 2,
    rng: seed | 0,
    count: 0,
  };
}

function winningLine(board) {
  for (const line of LINES) {
    const [a, b, c] = line;
    if (board[a] !== null && board[a] === board[b] && board[b] === board[c]) {
      return { winner: board[a], line };
    }
  }
  return null;
}

export function legalMoves(state) {
  if (winningLine(state.board) || state.count === 9) return [];
  const moves = [];
  for (let i = 0; i < 9; i++) {
    if (state.board[i] === null) moves.push({ type: 'place', cell: i });
  }
  return moves;
}

export function apply(state, move) {
  if (!move || move.type !== 'place' ||
      !Number.isInteger(move.cell) || move.cell < 0 || move.cell > 8 ||
      state.board[move.cell] !== null ||
      winningLine(state.board) || state.count === 9) {
    throw new Error('illegal move');
  }
  const board = state.board.slice();
  board[move.cell] = state.turn;
  return {
    ...state,
    board,
    turn: (state.turn + 1) % state.players,
    count: state.count + 1,
  };
}

export function status(state) {
  const win = winningLine(state.board);
  if (win) return { over: true, winner: win.winner, reason: 'three in a row', line: win.line };
  if (state.count === 9) return { over: true, winner: null, reason: 'draw' };
  return { over: false, winner: null };
}

export function view(state) {
  return state;
}

export function describe(state, move) {
  const mark = state.turn === 0 ? 'X' : 'O';
  return `${mark} on the ${CELLS[move.cell]}`;
}
