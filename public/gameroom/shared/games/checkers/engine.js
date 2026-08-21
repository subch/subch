// American/English draughts. 8×8, 12 men each on the dark squares; men move
// forward diagonally and capture by jumping; multi-jumps continue in the same
// turn with the jumping piece locked (state.phase='continue'); kings move and
// capture both directions one square (no flying kings). Crowning ends the
// turn. Win when the opponent has no legal move. Seat 0 is red at the bottom
// and moves first (house rule).
export { meta } from './meta.js';

const idx = (r, c) => r * 8 + c;
const inBoard = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;

export function init(options, seed) {
  const board = Array(64).fill(null);
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if ((r + c) % 2 !== 1) continue;
      if (r < 3) board[idx(r, c)] = { p: 1, k: false };      // black, moves down
      if (r > 4) board[idx(r, c)] = { p: 0, k: false };      // red, moves up
    }
  }
  return {
    board,
    turn: 0,
    players: 2,
    rng: seed | 0,
    phase: 'move', // 'move' | 'continue' (mid multi-jump, piece locked)
    lockedFrom: null,
    forced: options?.forcedCapture !== false,
    fortyRule: options?.fortyMoveDraw !== false,
    quiet: 0, // plies with no capture and no man move; 80 = 40 each → draw
    drawn: false,
  };
}

const dirsFor = (piece) => piece.k
  ? [[-1, -1], [-1, 1], [1, -1], [1, 1]]
  : piece.p === 0 ? [[-1, -1], [-1, 1]] : [[1, -1], [1, 1]];

function jumpsFrom(state, from) {
  const piece = state.board[from];
  const out = [];
  const r = (from / 8) | 0, c = from % 8;
  for (const [dr, dc] of dirsFor(piece)) {
    const mr = r + dr, mc = c + dc, tr = r + 2 * dr, tc = c + 2 * dc;
    if (!inBoard(tr, tc)) continue;
    const mid = state.board[idx(mr, mc)];
    if (mid && mid.p !== piece.p && state.board[idx(tr, tc)] === null) {
      out.push({ type: 'move', from, to: idx(tr, tc) });
    }
  }
  return out;
}

function slidesFrom(state, from) {
  const piece = state.board[from];
  const out = [];
  const r = (from / 8) | 0, c = from % 8;
  for (const [dr, dc] of dirsFor(piece)) {
    const tr = r + dr, tc = c + dc;
    if (inBoard(tr, tc) && state.board[idx(tr, tc)] === null) {
      out.push({ type: 'move', from, to: idx(tr, tc) });
    }
  }
  return out;
}

export function legalMoves(state) {
  if (state.drawn) return [];
  if (state.phase === 'continue') return jumpsFrom(state, state.lockedFrom);
  const jumps = [];
  const slides = [];
  for (let i = 0; i < 64; i++) {
    const piece = state.board[i];
    if (!piece || piece.p !== state.turn) continue;
    jumps.push(...jumpsFrom(state, i));
    if (jumps.length === 0 || !state.forced) slides.push(...slidesFrom(state, i));
  }
  if (jumps.length && state.forced) return jumps;
  return [...jumps, ...slides];
}

export function apply(state, move) {
  if (!move || move.type !== 'move' ||
      !legalMoves(state).some((m) => m.from === move.from && m.to === move.to)) {
    throw new Error('illegal move');
  }
  const s = JSON.parse(JSON.stringify(state));
  const piece = s.board[move.from];
  const fr = (move.from / 8) | 0, fc = move.from % 8;
  const tr = (move.to / 8) | 0, tc = move.to % 8;
  const isJump = Math.abs(tr - fr) === 2;

  s.board[move.from] = null;
  s.board[move.to] = piece;
  if (isJump) {
    s.board[idx((fr + tr) / 2, (fc + tc) / 2)] = null;
  }

  const crowned = !piece.k && ((piece.p === 0 && tr === 0) || (piece.p === 1 && tr === 7));
  if (crowned) piece.k = true;

  s.quiet = (isJump || !piece.k || crowned) ? 0 : s.quiet + 1;

  // multi-jump continues unless the man was just crowned (crowning ends the turn)
  if (isJump && !crowned && jumpsFrom(s, move.to).length > 0) {
    s.phase = 'continue';
    s.lockedFrom = move.to;
    return s;
  }
  s.phase = 'move';
  s.lockedFrom = null;
  s.turn = 1 - s.turn;
  if (s.fortyRule && s.quiet >= 80) s.drawn = true;
  return s;
}

export function status(state) {
  if (state.drawn) {
    return { over: true, winner: null, reason: '40 quiet moves each — drawn' };
  }
  if (legalMoves(state).length === 0) {
    const winner = 1 - state.turn;
    const hasPieces = state.board.some((p) => p && p.p === state.turn);
    return {
      over: true, winner,
      reason: hasPieces ? 'no moves left' : 'captured every piece',
    };
  }
  const captures = legalMoves(state).some((m) => Math.abs(((m.to / 8) | 0) - ((m.from / 8) | 0)) === 2);
  return {
    over: false, winner: null,
    note: state.phase === 'continue' ? 'keep jumping!' : captures ? 'a jump is available' : null,
  };
}

export function view(state) {
  return state;
}

const square = (i) => `${'abcdefgh'[i % 8]}${8 - ((i / 8) | 0)}`;

export function describe(state, move) {
  const isJump = Math.abs(((move.to / 8) | 0) - ((move.from / 8) | 0)) === 2;
  return `${isJump ? 'jumps' : 'moves'} ${square(move.from)}–${square(move.to)}`;
}
