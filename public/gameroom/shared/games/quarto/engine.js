// Quarto. 16 pieces, each with four binary traits (tall/short, light/dark,
// round/square, hollow/solid). You don't pick your own piece — your OPPONENT
// hands you the piece you must place. Win: any row, column or diagonal of 4
// sharing a trait (option: 2×2 squares too), detected automatically.
// Pieces are ints 0..15; bit 1 = tall, 2 = dark, 4 = round, 8 = hollow.
export { meta } from './meta.js';

export const isTall = (p) => !!(p & 1);
export const isDark = (p) => !!(p & 2);
export const isRound = (p) => !!(p & 4);
export const isHollow = (p) => !!(p & 8);

export function traitsOf(p) {
  return [
    isTall(p) ? 'tall' : 'short',
    isDark(p) ? 'dark' : 'light',
    isRound(p) ? 'round' : 'square',
    isHollow(p) ? 'hollow' : 'solid',
  ].join(' ');
}

const LINES = [
  [0, 1, 2, 3], [4, 5, 6, 7], [8, 9, 10, 11], [12, 13, 14, 15],
  [0, 4, 8, 12], [1, 5, 9, 13], [2, 6, 10, 14], [3, 7, 11, 15],
  [0, 5, 10, 15], [3, 6, 9, 12],
];
const SQUARES = [];
for (let r = 0; r < 3; r++) {
  for (let c = 0; c < 3; c++) {
    const i = r * 4 + c;
    SQUARES.push([i, i + 1, i + 4, i + 5]);
  }
}

export function init(options, seed) {
  return {
    board: Array(16).fill(null),
    remaining: Array.from({ length: 16 }, (_, i) => i),
    phase: 'give', // give: state.turn picks a piece for the opponent
    given: null,
    turn: 0,
    players: 2,
    rng: seed | 0,
    squares: !!options?.squares,
  };
}

export function winningLine(board, squares) {
  const lines = squares ? [...LINES, ...SQUARES] : LINES;
  for (const line of lines) {
    const ps = line.map((i) => board[i]);
    if (ps.some((p) => p === null)) continue;
    // shared trait: for some bit, all set or all clear
    const andAll = ps.reduce((a, p) => a & p, 15);
    const orAll = ps.reduce((a, p) => a | p, 0);
    if (andAll !== 0 || orAll !== 15) return line;
  }
  return null;
}

export function legalMoves(state) {
  if (winningLine(state.board, state.squares)) return [];
  if (state.phase === 'give') {
    return state.remaining.map((p) => ({ type: 'give', piece: p }));
  }
  const moves = [];
  for (let i = 0; i < 16; i++) {
    if (state.board[i] === null) moves.push({ type: 'place', cell: i });
  }
  return moves;
}

export function apply(state, move) {
  if (!move || winningLine(state.board, state.squares)) throw new Error('illegal move');
  const s = JSON.parse(JSON.stringify(state));

  if (s.phase === 'give') {
    if (move.type !== 'give' || !s.remaining.includes(move.piece)) throw new Error('illegal move');
    s.remaining = s.remaining.filter((p) => p !== move.piece);
    s.given = move.piece;
    s.phase = 'place';
    s.turn = 1 - s.turn; // the receiver places it
    return s;
  }

  if (move.type !== 'place' || s.board[move.cell] !== null ||
      move.cell < 0 || move.cell > 15) throw new Error('illegal move');
  s.board[move.cell] = s.given;
  s.given = null;
  s.phase = 'give'; // the placer now hands over the next piece
  return s;
}

export function status(state) {
  const line = winningLine(state.board, state.squares);
  if (line) {
    // after a placement the turn stays with the placer (they give next)
    return { over: true, winner: state.turn, reason: 'four sharing a trait', line };
  }
  if (state.remaining.length === 0 && state.given === null) {
    return { over: true, winner: null, reason: 'all sixteen placed' };
  }
  return {
    over: false, winner: null,
    note: state.phase === 'give' ? 'pick a piece to hand over' : 'place it anywhere',
  };
}

export function view(state) {
  return state;
}

const cellName = (i) => `${'abcd'[i % 4]}${4 - ((i / 4) | 0)}`;

export function describe(state, move) {
  if (move.type === 'give') return `hands over the ${traitsOf(move.piece)} piece`;
  return `places it on ${cellName(move.cell)}`;
}
