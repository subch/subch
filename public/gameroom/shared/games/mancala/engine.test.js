import { test } from 'node:test';
import assert from 'node:assert';
import * as engine from './engine.js';
import { fuzz } from '../fuzz.js';

const seats = [{ seat: 0 }, { seat: 1 }];
const sow = (pit) => ({ type: 'sow', pit });

function bare() {
  const s = engine.init({}, 1, seats);
  s.pits = Array(12).fill(0);
  return s;
}

test('init: 4 stones per pit (option respected), six legal sows', () => {
  const s = engine.init({}, 1, seats);
  assert.deepEqual(s.pits, Array(12).fill(4));
  assert.deepEqual(s.stores, [0, 0]);
  assert.equal(engine.legalMoves(s).length, 6);
  const s3 = engine.init({ stones: '3' }, 1, seats);
  assert.equal(s3.pits[0], 3);
  assert.deepEqual(JSON.parse(JSON.stringify(s)), s);
});

test('sowing goes counter-clockwise, drops into own store, skips the opponent store', () => {
  const s = bare();
  s.pits[3] = 10; // enough to wrap past both stores
  const t = engine.apply(s, sow(3));
  // path from pit 3: 4,5,store0,6,7,8,9,10,11,(skip store1),0 → 10 stones;
  // the last stone lands in empty own pit 0 → captures it + opposite pit 11
  assert.deepEqual(t.pits.slice(0, 6), [0, 0, 0, 0, 1, 1]);
  assert.equal(t.stores[0], 3, '1 sown into the store + 2 captured');
  assert.deepEqual(t.pits.slice(6), [1, 1, 1, 1, 1, 0]);
  assert.equal(t.stores[1], 0, 'opponent store skipped');
});

test('last stone in own store grants an extra turn', () => {
  const s = bare();
  s.pits[3] = 3; // lands exactly in store0
  s.pits[6] = 1; // keep black side non-empty
  const t = engine.apply(s, sow(3));
  assert.equal(t.stores[0], 1);
  assert.equal(t.turn, 0, 'seat 0 goes again');
});

test('capture: last stone into an empty own pit takes the opposite pit too', () => {
  const s = bare();
  s.pits[0] = 2;      // sows into 1 and 2
  s.pits[2] = 0;      // pit 2 empty → capture
  s.pits[9] = 5;      // opposite of pit 2 is 11-2=9
  s.pits[6] = 1;      // opponent still has stones elsewhere
  const t = engine.apply(s, sow(0));
  assert.equal(t.pits[2], 0);
  assert.equal(t.pits[9], 0);
  assert.equal(t.stores[0], 6, 'captured 1 + 5');
  assert.equal(t.turn, 1);
});

test('no capture when the opposite pit is empty', () => {
  const s = bare();
  s.pits[0] = 2;
  s.pits[6] = 1;
  const t = engine.apply(s, sow(0)); // lands in empty pit 2, opposite (9) empty
  assert.equal(t.pits[2], 1, 'stone stays');
  assert.equal(t.stores[0], 0);
});

test('game ends when a side empties; the other side keeps its stones', () => {
  const s = bare();
  s.pits[5] = 1;            // seat 0's only stone → lands in store
  s.pits[8] = 7;
  s.stores = [10, 2];
  const t = engine.apply(s, sow(5));
  const st = engine.status(t);
  assert.equal(st.over, true);
  assert.deepEqual(st.scores, [11, 9]);
  assert.equal(st.winner, 0);
});

test('tie is a draw', () => {
  const s = bare();
  s.pits[5] = 1;
  s.pits[8] = 4;
  s.stores = [7, 4];
  const t = engine.apply(s, sow(5));
  const st = engine.status(t);
  assert.equal(st.winner, null);
});

test('illegal moves throw', () => {
  const s = engine.init({}, 1, seats);
  assert.throws(() => engine.apply(s, sow(7)), /illegal/);  // opponent's pit
  const b = bare();
  b.pits[0] = 0; b.pits[1] = 1; b.pits[6] = 1;
  assert.throws(() => engine.apply(b, sow(0)), /illegal/);  // empty pit
});

test('apply is pure', () => {
  const s = engine.init({}, 1, seats);
  const before = JSON.stringify(s);
  engine.apply(s, sow(0));
  assert.equal(JSON.stringify(s), before);
});

test('fuzz: all stone counts', () => {
  fuzz(engine, { playouts: 150, moveCap: 500 });
  fuzz(engine, { playouts: 80, moveCap: 500, options: { stones: '3' } });
  fuzz(engine, { playouts: 80, moveCap: 700, options: { stones: '6' } });
});
