import { test } from 'node:test';
import assert from 'node:assert';
import * as engine from './engine.js';
import { fuzz } from '../fuzz.js';

const seats = [{ seat: 0 }, { seat: 1 }];

test('init shape', () => {
  const s = engine.init({}, 42, seats);
  assert.deepEqual(s.board, Array(9).fill(null));
  assert.equal(s.turn, 0);
  assert.equal(s.players, 2);
  assert.equal(s.rng, 42);
  assert.deepEqual(JSON.parse(JSON.stringify(s)), s);
});

test('seat 0 wins across the top', () => {
  let s = engine.init({}, 1, seats);
  for (const cell of [0, 3, 1, 4, 2]) s = engine.apply(s, { type: 'place', cell });
  const st = engine.status(s);
  assert.equal(st.over, true);
  assert.equal(st.winner, 0);
  assert.deepEqual(st.line, [0, 1, 2]);
  assert.equal(engine.legalMoves(s).length, 0);
});

test('draw on a full board', () => {
  let s = engine.init({}, 1, seats);
  for (const cell of [0, 1, 2, 4, 3, 5, 7, 6, 8]) s = engine.apply(s, { type: 'place', cell });
  const st = engine.status(s);
  assert.equal(st.over, true);
  assert.equal(st.winner, null);
});

test('illegal moves throw', () => {
  let s = engine.init({}, 1, seats);
  s = engine.apply(s, { type: 'place', cell: 4 });
  assert.throws(() => engine.apply(s, { type: 'place', cell: 4 }), /illegal/);
  assert.throws(() => engine.apply(s, { type: 'place', cell: 9 }), /illegal/);
  assert.throws(() => engine.apply(s, { type: 'flip' }), /illegal/);
});

test('apply is pure', () => {
  const s = engine.init({}, 1, seats);
  const before = JSON.stringify(s);
  engine.apply(s, { type: 'place', cell: 0 });
  assert.equal(JSON.stringify(s), before);
});

test('describe', () => {
  const s = engine.init({}, 1, seats);
  assert.equal(engine.describe(s, { type: 'place', cell: 4 }), 'X on the center');
});

test('fuzz: 300 random playouts', () => {
  fuzz(engine, { playouts: 300, moveCap: 10 });
});
