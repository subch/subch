import { test } from 'node:test';
import assert from 'node:assert';
import * as engine from './engine.js';
import { fuzz } from '../fuzz.js';

const seats = [{ seat: 0 }, { seat: 1 }];
const mv = (from, to, promotion) => ({ type: 'move', from, to, ...(promotion ? { promotion } : {}) });

function withFen(fen) {
  const s = engine.init({}, 1, seats);
  s.fen = fen;
  s.reps = {};
  s.turn = fen.split(' ')[1] === 'w' ? 0 : 1;
  return s;
}

test('init: standard position, 20 opening moves, white is seat 0', () => {
  const s = engine.init({}, 1, seats);
  assert.match(s.fen, /^rnbqkbnr/);
  assert.equal(engine.legalMoves(s).length, 20);
  assert.equal(s.turn, 0);
  assert.deepEqual(JSON.parse(JSON.stringify(s)), s);
});

test("scholar's mate: checkmate, white wins", () => {
  let s = engine.init({}, 1, seats);
  for (const [f, t] of [['e2', 'e4'], ['e7', 'e5'], ['d1', 'h5'], ['b8', 'c6'], ['f1', 'c4'], ['g8', 'f6'], ['h5', 'f7']]) {
    s = engine.apply(s, mv(f, t));
  }
  const st = engine.status(s);
  assert.equal(st.over, true);
  assert.equal(st.winner, 0);
  assert.equal(st.reason, 'checkmate');
  assert.equal(engine.legalMoves(s).length, 0);
});

test('stalemate is a draw', () => {
  const s = withFen('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1');
  const st = engine.status(s);
  assert.equal(st.over, true);
  assert.equal(st.winner, null);
  assert.equal(st.reason, 'stalemate');
});

test('insufficient material is a draw', () => {
  const st = engine.status(withFen('8/8/4k3/8/8/3K4/8/8 w - - 0 1'));
  assert.equal(st.over, true);
  assert.match(st.reason, /not enough/);
});

test('threefold repetition via the reps map', () => {
  let s = engine.init({}, 1, seats);
  const shuffle = [['g1', 'f3'], ['g8', 'f6'], ['f3', 'g1'], ['f6', 'g8']];
  for (let i = 0; i < 2; i++) for (const [f, t] of shuffle) s = engine.apply(s, mv(f, t));
  const st = engine.status(s);
  assert.equal(st.over, true);
  assert.equal(st.reason, 'threefold repetition');
});

test('fifty-move rule reads the halfmove clock', () => {
  let s = withFen('7k/8/8/8/8/8/R7/K7 w - - 99 80');
  s = engine.apply(s, mv('a2', 'b2'));
  const st = engine.status(s);
  assert.equal(st.over, true);
  assert.equal(st.reason, 'fifty quiet moves');
});

test('promotion: picker piece honored, queen by default', () => {
  let s = withFen('8/P6k/8/8/8/8/8/K7 w - - 0 1');
  const knight = engine.apply(s, mv('a7', 'a8', 'n'));
  assert.match(knight.fen, /^N/);
  const queen = engine.apply(s, mv('a7', 'a8'));
  assert.match(queen.fen, /^Q/);
});

test('check note and checked square helper', () => {
  const s = withFen('4k3/8/8/8/8/8/4R3/4K3 b - - 0 1'); // rook checks down the e-file
  assert.equal(engine.status(s).note, 'check!');
  assert.equal(engine.checkedSquare(s), 'e8');
});

test('illegal moves throw', () => {
  const s = engine.init({}, 1, seats);
  assert.throws(() => engine.apply(s, mv('e2', 'e5')), /illegal/);
  assert.throws(() => engine.apply(s, mv('e7', 'e5')), /illegal/); // black piece, white turn
  assert.throws(() => engine.apply(s, { type: 'drop', col: 1 }), /illegal/);
});

test('apply is pure and boardOf maps correctly', () => {
  const s = engine.init({}, 1, seats);
  const before = JSON.stringify(s);
  engine.apply(s, mv('e2', 'e4'));
  assert.equal(JSON.stringify(s), before);
  const b = engine.boardOf(s);
  assert.deepEqual(b[0], { t: 'r', c: 'b' });  // a8
  assert.deepEqual(b[60], { t: 'k', c: 'w' }); // e1
});

test('fuzz: 30 random games end legally', () => {
  fuzz(engine, { playouts: 30, moveCap: 1200 });
});
