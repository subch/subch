// Chess: a thin pure wrapper around vendored chess.js (BSD-2). State is
// {fen, reps, ...} — reps is a position-key → count map maintained here for
// threefold detection (chess.js's own detector needs move history, which we
// deliberately don't keep: a Chess(fen) is rebuilt per call, never replayed).
// Seat 0 is white.
export { meta } from './meta.js';
import { Chess } from '../../vendor/chess.js';

// position key: placement, side to move, castling, en passant (no clocks)
const repKey = (fen) => fen.split(' ').slice(0, 4).join(' ');
const halfmoves = (fen) => Number(fen.split(' ')[4]);

export function init(options, seed) {
  const fen = new Chess().fen();
  return {
    fen,
    reps: { [repKey(fen)]: 1 },
    turn: 0,
    players: 2,
    rng: seed | 0,
  };
}

function drawReason(state, chess) {
  if (chess.isStalemate()) return 'stalemate';
  if (chess.isInsufficientMaterial()) return 'not enough pieces to mate';
  if ((state.reps[repKey(state.fen)] || 0) >= 3) return 'threefold repetition';
  if (halfmoves(state.fen) >= 100) return 'fifty quiet moves';
  return null;
}

export function legalMoves(state) {
  const chess = new Chess(state.fen);
  if (chess.isCheckmate() || drawReason(state, chess)) return [];
  return chess.moves({ verbose: true }).map((m) => ({
    type: 'move',
    from: m.from,
    to: m.to,
    ...(m.promotion ? { promotion: m.promotion } : {}),
  }));
}

export function apply(state, move) {
  if (!move || move.type !== 'move') throw new Error('illegal move');
  const chess = new Chess(state.fen);
  if (drawReason(state, chess)) throw new Error('illegal move');
  try {
    chess.move({ from: move.from, to: move.to, promotion: move.promotion || 'q' });
  } catch {
    throw new Error('illegal move');
  }
  const fen = chess.fen();
  const reps = { ...state.reps };
  reps[repKey(fen)] = (reps[repKey(fen)] || 0) + 1;
  return { ...state, fen, reps, turn: 1 - state.turn };
}

export function status(state) {
  const chess = new Chess(state.fen);
  if (chess.isCheckmate()) {
    return { over: true, winner: 1 - state.turn, reason: 'checkmate' };
  }
  const draw = drawReason(state, chess);
  if (draw) return { over: true, winner: null, reason: draw };
  return { over: false, winner: null, note: chess.isCheck() ? 'check!' : null };
}

export function view(state) {
  return state;
}

export function describe(state, move) {
  try {
    const san = new Chess(state.fen).move({
      from: move.from, to: move.to, promotion: move.promotion || 'q',
    }).san;
    return `plays ${san}`;
  } catch {
    return `plays ${move.from}–${move.to}`;
  }
}

// ---- helpers for the view (rendering only, no rules) ----------------------

// 64-array, a8 first (index r*8+c with r0 = rank 8): {t:'k..p', c:'w'|'b'}|null
export function boardOf(state) {
  return new Chess(state.fen).board().flat().map((sq) =>
    sq ? { t: sq.type, c: sq.color } : null);
}

// the checked king's square name, or null
export function checkedSquare(state) {
  const chess = new Chess(state.fen);
  if (!chess.isCheck()) return null;
  const color = chess.turn();
  const board = chess.board();
  for (const row of board) {
    for (const sq of row) {
      if (sq && sq.type === 'k' && sq.color === color) return sq.square;
    }
  }
  return null;
}
