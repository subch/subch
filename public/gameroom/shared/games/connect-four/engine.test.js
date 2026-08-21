import { test } from 'node:test';
import assert from 'node:assert';
import * as engine from './engine.js';
import { fuzz } from '../fuzz.js';

const seats = [{ seat: 0 }, { seat: 1 }];
const drop = (col) => ({ type: 'drop', col });

test('init shape and 7 legal columns', () => {
  const s = engine.init({}, 5, seats);
  assert.equal(s.board.length, 42);
  assert.equal(engine.legalMoves(s).length, 7);
  assert.deepEqual(JSON.parse(JSON.stringify(s)), s);
});

test('discs stack from the bottom', () => {
  let s = engine.init({}, 1, seats);
  s = engine.apply(s, drop(3));
  assert.equal(s.board[5 * 7 + 3], 0);
  s = engine.apply(s, drop(3));
  assert.equal(s.board[4 * 7 + 3], 1);
  assert.equal(engine.landingRow(s, 3), 3);
});

test('vertical win', () => {
  let s = engine.init({}, 1, seats);
  for (const c of [0, 1, 0, 1, 0, 1, 0]) s = engine.apply(s, drop(c));
  const st = engine.status(s);
  assert.equal(st.over, true);
  assert.equal(st.winner, 0);
  assert.equal(st.line.length, 4);
  assert.equal(engine.legalMoves(s).length, 0);
});

test('horizontal win', () => {
  let s = engine.init({}, 1, seats);
  for (const c of [0, 0, 1, 1, 2, 2, 3]) s = engine.apply(s, drop(c));
  assert.equal(engine.status(s).winner, 0);
});

test('diagonal win', () => {
  let s = engine.init({}, 1, seats);
  for (const c of [0, 1, 1, 2, 2, 3, 2, 3, 3, 6, 3]) s = engine.apply(s, drop(c));
  const st = engine.status(s);
  assert.equal(st.over, true);
  assert.equal(st.winner, 0);
});

test('a full column is illegal', () => {
  let s = engine.init({}, 1, seats);
  for (let i = 0; i < 6; i++) s = engine.apply(s, drop(2));
  assert.ok(!engine.legalMoves(s).some((m) => m.col === 2));
  assert.throws(() => engine.apply(s, drop(2)), /illegal/);
});

test('apply is pure', () => {
  const s = engine.init({}, 1, seats);
  const before = JSON.stringify(s);
  engine.apply(s, drop(0));
  assert.equal(JSON.stringify(s), before);
});

test('fuzz: 300 playouts', () => {
  fuzz(engine, { playouts: 300, moveCap: 50 });
});
