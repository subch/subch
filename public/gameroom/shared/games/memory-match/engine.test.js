import { test } from 'node:test';
import assert from 'node:assert';
import * as engine from './engine.js';
import { fuzz } from '../fuzz.js';

const seats2 = [{ seat: 0 }, { seat: 1 }];
const solo = [{ seat: 0 }];
const flip = (cell) => ({ type: 'flip', cell });

const findPair = (s) => {
  for (let i = 0; i < s.cells.length; i++) {
    for (let j = i + 1; j < s.cells.length; j++) {
      if (s.cells[i] === s.cells[j]) return [i, j];
    }
  }
  return null;
};

test('init: 2×pairs cells, every rank appears exactly twice', () => {
  const s = engine.init({ pairs: '6' }, 3, seats2);
  assert.equal(s.cells.length, 12);
  const counts = {};
  for (const r of s.cells) counts[r] = (counts[r] || 0) + 1;
  assert.ok(Object.values(counts).every((n) => n === 2));
  assert.deepEqual(JSON.parse(JSON.stringify(s)), s);
});

test('a matched pair claims, scores, and keeps the turn', () => {
  let s = engine.init({}, 7, seats2);
  const [a, b] = findPair(s);
  s = engine.apply(s, flip(a));
  assert.equal(s.up.length, 1);
  s = engine.apply(s, flip(b));
  assert.equal(s.owner[a], 0);
  assert.equal(s.scores[0], 1);
  assert.equal(s.turn, 0, 'goes again');
  assert.equal(s.phase, 'flip');
});

test('a miss shows both, then continue passes the turn', () => {
  let s = engine.init({}, 7, seats2);
  const [a] = findPair(s);
  const other = s.cells.findIndex((r, i) => r !== s.cells[a] && i !== a);
  s = engine.apply(s, flip(a));
  s = engine.apply(s, flip(other));
  assert.equal(s.phase, 'memorize');
  assert.deepEqual(engine.legalMoves(s), [{ type: 'continue' }]);
  assert.equal(s.up.length, 2, 'both stay visible to memorize');
  s = engine.apply(s, { type: 'continue' });
  assert.equal(s.turn, 1);
  assert.deepEqual(s.up, []);
});

test('seen is public knowledge; flipping marks it', () => {
  let s = engine.init({}, 9, seats2);
  s = engine.apply(s, flip(4));
  assert.equal(s.seen[4], true);
});

test('game ends when all pairs are owned; solo winner is seat 0', () => {
  let s = engine.init({ pairs: '6' }, 11, solo);
  let guard = 0;
  while (!engine.status(s).over && guard++ < 200) {
    const pair = findPair({ ...s, cells: s.cells.map((r, i) => (s.owner[i] === null ? r : -1 - i)) });
    s = engine.apply(s, flip(pair[0]));
    s = engine.apply(s, flip(pair[1]));
  }
  const st = engine.status(s);
  assert.equal(st.over, true);
  assert.equal(st.winner, 0);
  assert.equal(st.scores[0], 6);
});

test('illegal moves throw', () => {
  let s = engine.init({}, 7, seats2);
  s = engine.apply(s, flip(0));
  assert.throws(() => engine.apply(s, flip(0)), /illegal/); // already up
  assert.throws(() => engine.apply(s, { type: 'continue' }), /illegal/); // not memorizing
  assert.throws(() => engine.apply(s, flip(99)), /illegal/);
});

test('apply is pure', () => {
  const s = engine.init({}, 7, seats2);
  const before = JSON.stringify(s);
  engine.apply(s, flip(0));
  assert.equal(JSON.stringify(s), before);
});

test('fuzz: sizes, 1-4 players', () => {
  // measured worst cases over 300 seeds: 264 / 644 / 909 — caps sit well above
  fuzz(engine, { playouts: 150, moveCap: 1400, seats: seats2 });
  fuzz(engine, { playouts: 60, moveCap: 700, options: { pairs: '6' }, seats: solo });
  fuzz(engine, { playouts: 60, moveCap: 2000, options: { pairs: '12' }, seats: [{ seat: 0 }, { seat: 1 }, { seat: 2 }, { seat: 3 }] });
});
