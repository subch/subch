import { test } from 'node:test';
import assert from 'node:assert';
import * as engine from './engine.js';
import { fuzz } from '../fuzz.js';

const seats2 = [{ seat: 0 }, { seat: 1 }];
const seats3 = [{ seat: 0 }, { seat: 1 }, { seat: 2 }];
const h = (i) => ({ type: 'edge', o: 'h', i });
const v = (i) => ({ type: 'edge', o: 'v', i });

test('init: 5×5 default, edge counts right, 60 legal moves', () => {
  const s = engine.init({}, 1, seats2);
  assert.equal(s.n, 5);
  assert.equal(s.h.length, 30);
  assert.equal(s.v.length, 30);
  assert.equal(engine.legalMoves(s).length, 60);
  const s3 = engine.init({ size: '3' }, 1, seats2);
  assert.equal(engine.legalMoves(s3).length, 24);
  assert.deepEqual(JSON.parse(JSON.stringify(s)), s);
});

test('drawing a non-completing edge passes the turn; completing a box grants another', () => {
  let s = engine.init({ size: '3' }, 1, seats2);
  // box (0,0): top h0, bottom h3, left v0, right v1
  s = engine.apply(s, h(0));
  assert.equal(s.turn, 1);
  s = engine.apply(s, h(3));
  assert.equal(s.turn, 0);
  s = engine.apply(s, v(0));
  assert.equal(s.turn, 1);
  s = engine.apply(s, v(1)); // seat 1 completes the box
  assert.equal(s.boxes[0], 1);
  assert.equal(s.turn, 1, 'goes again');
  assert.deepEqual(engine.scoresOf(s), [0, 1]);
});

test('one edge can complete two boxes at once', () => {
  let s = engine.init({ size: '3' }, 1, seats2);
  // boxes (0,0) and (0,1) share edge v1; draw everything else around them
  for (const m of [h(0), h(1), h(3), h(4), v(0)]) s = engine.apply(s, m);
  const before = s.turn;
  s = engine.apply(s, v(2)); // right edge of box (0,1)... not yet complete
  s = engine.apply(s, v(1)); // completes BOTH boxes
  assert.equal(s.boxes[0], s.boxes[1]);
  assert.notEqual(s.boxes[0], null);
  assert.equal(engine.scoresOf(s)[s.boxes[0]], 2);
});

test('full board ends the game; most boxes wins; ties draw', () => {
  let s = engine.init({ size: '3' }, 1, seats2);
  let guard = 0;
  while (!engine.status(s).over && guard++ < 60) {
    s = engine.apply(s, engine.legalMoves(s)[0]);
  }
  const st = engine.status(s);
  assert.equal(st.over, true);
  assert.equal(st.scores.reduce((a, b) => a + b), 9);
  if (st.scores[0] === st.scores[1]) assert.equal(st.winner, null);
  else assert.equal(st.winner, st.scores[0] > st.scores[1] ? 0 : 1);
});

test('three players rotate; scores per seat', () => {
  let s = engine.init({ size: '3' }, 1, seats3);
  assert.equal(s.players, 3);
  s = engine.apply(s, h(0));
  s = engine.apply(s, h(1));
  s = engine.apply(s, h(2));
  assert.equal(s.turn, 0);
});

test('illegal moves throw', () => {
  let s = engine.init({ size: '3' }, 1, seats2);
  s = engine.apply(s, h(0));
  assert.throws(() => engine.apply(s, h(0)), /illegal/);   // already drawn
  assert.throws(() => engine.apply(s, h(99)), /illegal/);  // out of range
  assert.throws(() => engine.apply(s, { type: 'edge', o: 'x', i: 1 }), /illegal/);
});

test('apply is pure', () => {
  const s = engine.init({}, 1, seats2);
  const before = JSON.stringify(s);
  engine.apply(s, h(0));
  assert.equal(JSON.stringify(s), before);
});

test('fuzz: sizes and player counts', () => {
  fuzz(engine, { playouts: 150, moveCap: 70, options: { size: '3' } });
  fuzz(engine, { playouts: 100, moveCap: 130, options: { size: '5' } });
  fuzz(engine, { playouts: 60, moveCap: 130, options: { size: '5' }, seats: seats3 });
});
