import { test } from 'node:test';
import assert from 'node:assert';
import * as engine from './engine.js';
import { fuzz } from '../fuzz.js';

const seats = [{ seat: 0 }, { seat: 1 }];
const idx = (r, c) => r * 8 + c;
const man = (p) => ({ p, k: false });
const king = (p) => ({ p, k: true });

function empty(turn = 0, opts = {}) {
  const s = engine.init(opts, 1, seats);
  s.board = Array(64).fill(null);
  s.turn = turn;
  return s;
}

test('init: 12 men each on dark squares, red (seat 0) to move', () => {
  const s = engine.init({}, 1, seats);
  const red = s.board.filter((p) => p && p.p === 0).length;
  const black = s.board.filter((p) => p && p.p === 1).length;
  assert.equal(red, 12);
  assert.equal(black, 12);
  assert.equal(s.turn, 0);
  s.board.forEach((p, i) => {
    if (p) assert.equal((((i / 8) | 0) + (i % 8)) % 2, 1, 'piece on a light square');
  });
  assert.deepEqual(JSON.parse(JSON.stringify(s)), s);
  assert.equal(engine.legalMoves(s).length, 7);
});

test('men move forward only; kings move both ways', () => {
  const s = empty(0);
  s.board[idx(4, 3)] = man(0);
  const moves = engine.legalMoves(s).map((m) => m.to).sort((a, b) => a - b);
  assert.deepEqual(moves, [idx(3, 2), idx(3, 4)]);
  const s2 = empty(0);
  s2.board[idx(4, 3)] = king(0);
  assert.equal(engine.legalMoves(s2).length, 4);
});

test('forced capture: only jumps offered when one exists', () => {
  const s = empty(0);
  s.board[idx(4, 3)] = man(0);
  s.board[idx(3, 4)] = man(1);
  s.board[idx(5, 6)] = man(0); // has quiet moves, but the jump is forced
  const moves = engine.legalMoves(s);
  assert.deepEqual(moves, [{ type: 'move', from: idx(4, 3), to: idx(2, 5) }]);
  const applied = engine.apply(s, moves[0]);
  assert.equal(applied.board[idx(3, 4)], null, 'jumped man removed');
});

test('forced capture off: quiet moves allowed alongside jumps', () => {
  const s = empty(0, { forcedCapture: false });
  s.board[idx(4, 3)] = man(0);
  s.board[idx(3, 4)] = man(1);
  const kinds = engine.legalMoves(s);
  assert.ok(kinds.length > 1);
});

test('multi-jump: same piece stays locked, one turn', () => {
  const s = empty(0);
  s.board[idx(6, 1)] = man(0);
  s.board[idx(5, 2)] = man(1);
  s.board[idx(3, 4)] = man(1);
  let t = engine.apply(s, { type: 'move', from: idx(6, 1), to: idx(4, 3) });
  assert.equal(t.phase, 'continue');
  assert.equal(t.turn, 0, 'still red to move');
  assert.equal(t.lockedFrom, idx(4, 3));
  const cont = engine.legalMoves(t);
  assert.deepEqual(cont, [{ type: 'move', from: idx(4, 3), to: idx(2, 5) }]);
  t = engine.apply(t, cont[0]);
  assert.equal(t.turn, 1);
  assert.equal(t.board.filter((p) => p && p.p === 1).length, 0);
});

test('crowning: man reaching the back row becomes a king and the turn ends', () => {
  const s = empty(0);
  s.board[idx(2, 1)] = man(0);
  s.board[idx(1, 2)] = man(1);
  s.board[idx(1, 6)] = man(1); // would be jumpable from (0,3) if the turn continued
  const t = engine.apply(s, { type: 'move', from: idx(2, 1), to: idx(0, 3) });
  assert.equal(t.board[idx(0, 3)].k, true);
  assert.equal(t.turn, 1, 'crowning ends the turn even mid-jump');
});

test('win when the opponent is blocked (pieces but no moves)', () => {
  const s = empty(1);
  // black man cornered at (7,0)... black moves down, so trap at bottom edge
  s.board[idx(7, 0)] = man(1);
  s.board[idx(6, 1)] = man(1); // its own blocker... give black the turn: (7,0) can't move (row 7), (6,1)?
  s.board[idx(7, 2)] = man(0);
  s.board[idx(5, 0)] = king(0);
  s.board[idx(5, 2)] = king(0);
  const st = engine.status(s);
  assert.equal(st.over, true);
  assert.equal(st.winner, 0);
  assert.equal(st.reason, 'no moves left');
});

test('win by capturing everything', () => {
  const s = empty(1);
  s.board[idx(4, 3)] = man(0);
  const st = engine.status(s);
  assert.equal(st.over, true);
  assert.equal(st.winner, 0);
  assert.equal(st.reason, 'captured every piece');
});

test('40 quiet moves each auto-draws (option on)', () => {
  let s = empty(0);
  s.board[idx(4, 3)] = king(0);
  s.board[idx(0, 1)] = king(1);
  s.quiet = 79;
  s = engine.apply(s, engine.legalMoves(s)[0]);
  const st = engine.status(s);
  assert.equal(st.over, true);
  assert.equal(st.winner, null);
  assert.match(st.reason, /drawn/);
});

test('illegal moves throw', () => {
  const s = engine.init({}, 1, seats);
  assert.throws(() => engine.apply(s, { type: 'move', from: idx(5, 0), to: idx(3, 0) }), /illegal/);
  assert.throws(() => engine.apply(s, { type: 'move', from: idx(2, 1), to: idx(3, 0) }), /illegal/); // black piece, red's turn
  assert.throws(() => engine.apply(s, { type: 'flip' }), /illegal/);
});

test('apply is pure', () => {
  const s = engine.init({}, 1, seats);
  const before = JSON.stringify(s);
  engine.apply(s, engine.legalMoves(s)[0]);
  assert.equal(JSON.stringify(s), before);
});

test('fuzz: 300 playouts with defaults; forced-capture off too', () => {
  fuzz(engine, { playouts: 200, moveCap: 3000, options: {}, seats });
  fuzz(engine, { playouts: 100, moveCap: 3000, options: { forcedCapture: false }, seats });
});
