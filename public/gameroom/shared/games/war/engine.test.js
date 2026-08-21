import { test } from 'node:test';
import assert from 'node:assert';
import * as engine from './engine.js';
import { fuzz } from '../fuzz.js';

const seats2 = [{ seat: 0 }, { seat: 1 }];
const seats3 = [{ seat: 0 }, { seat: 1 }, { seat: 2 }];
const seats4 = [{ seat: 0 }, { seat: 1 }, { seat: 2 }, { seat: 3 }];

// card helper: rank 0..12 ('2'..'A'), suit 0..3
const card = (r, s) => s * 13 + r;

test('init deals evenly, remainder set aside', () => {
  const s2 = engine.init({}, 7, seats2);
  assert.deepEqual(s2.decks.map((d) => d.length), [26, 26]);
  const s3 = engine.init({}, 7, seats3);
  assert.deepEqual(s3.decks.map((d) => d.length), [17, 17, 17]);
  const s4 = engine.init({}, 7, seats4);
  assert.deepEqual(s4.decks.map((d) => d.length), [13, 13, 13, 13]);
  assert.deepEqual(JSON.parse(JSON.stringify(s2)), s2);
});

test('higher card takes the pot', () => {
  let s = engine.init({ length: 'end' }, 1, seats2);
  s.decks[0] = [card(11, 0), card(0, 1)]; // K♠ then 2♥
  s.decks[1] = [card(9, 2), card(1, 3)];  // J♦ then 3♣
  s = engine.apply(s, { type: 'flip' }); // seat 0 flips K
  assert.equal(s.turn, 1);
  s = engine.apply(s, { type: 'flip' }); // seat 1 flips J → seat 0 takes
  assert.equal(s.lastRound.winner, 0);
  assert.equal(s.wons[0].length, 2);
  assert.equal(engine.totals(s)[0], 3);
  assert.equal(engine.totals(s)[1], 1);
});

test('tie triggers a war: 3 down + 1 up, winner takes all 10', () => {
  let s = engine.init({ length: 'end' }, 1, seats2);
  s.decks[0] = [card(11, 0), 1, 2, 3, card(12, 0), 40]; // K♠, 3 down, A♠ up
  s.decks[1] = [card(11, 1), 5, 6, 7, card(2, 1), 41];  // K♥, 3 down, 4♥ up
  s = engine.apply(s, { type: 'flip' });
  s = engine.apply(s, { type: 'flip' });
  assert.equal(s.phase, 'war');
  assert.equal(s.warDepth, 1);
  s = engine.apply(s, { type: 'flip' }); // war: 3 down + A♠
  s = engine.apply(s, { type: 'flip' }); // war: 3 down + 4♥
  assert.equal(s.lastRound.winner, 0);
  assert.equal(s.wons[0].length, 10);
  assert.equal(engine.totals(s)[0], 11);
  assert.equal(engine.totals(s)[1], 1);
});

test('short of cards in a war: lays all with the last face-up; loser is eliminated', () => {
  let s = engine.init({ length: 'end' }, 1, seats2);
  s.decks[0] = [card(11, 0), 1, 2, 3, card(12, 0), 40];
  s.decks[1] = [card(11, 1), card(2, 1)]; // K♥ then only one card for the war
  s.wons[1] = [];
  s = engine.apply(s, { type: 'flip' });
  s = engine.apply(s, { type: 'flip' }); // war on kings
  s = engine.apply(s, { type: 'flip' }); // seat 0: 3 down + A up
  s = engine.apply(s, { type: 'flip' }); // seat 1: all they have, last face-up
  const st = engine.status(s);
  assert.equal(st.over, true);
  assert.equal(st.winner, 0);
  assert.equal(st.scores[0], 8);
});

test('sum variant flips two and adds', () => {
  let s = engine.init({ length: 'end', variant: 'sum' }, 1, seats2);
  assert.equal(s.flipCount, 2);
  s.decks[0] = [card(0, 0), card(1, 0), 10, 11]; // 2+3 = 5
  s.decks[1] = [card(11, 1), card(12, 1), 20, 21]; // K+A = 27
  s = engine.apply(s, { type: 'flip' });
  s = engine.apply(s, { type: 'flip' });
  assert.equal(s.lastRound.winner, 1);
  assert.equal(engine.totals(s)[1], 6);
});

test('timeout: leader wins at time; tie goes to sudden death', () => {
  let s = engine.init({ length: 'showdown' }, 1, seats2);
  assert.deepEqual(engine.timer(s), { kind: 'game', seconds: 600 });
  // equal counts → sudden death
  let t = engine.apply(s, { type: 'timeout' });
  assert.equal(t.suddenDeath, true);
  assert.equal(engine.status(t).over, false);
  assert.equal(engine.timer(t), null);
  // unequal counts → immediate win
  s.decks[0] = s.decks[0].slice(0, 10);
  const w = engine.apply(s, { type: 'timeout' });
  assert.equal(engine.status(w).over, true);
  assert.equal(engine.status(w).winner, 1);
});

test('illegal moves throw', () => {
  const s = engine.init({ length: 'end' }, 1, seats2);
  assert.throws(() => engine.apply(s, { type: 'timeout' }), /illegal/); // not showdown
  assert.throws(() => engine.apply(s, { type: 'place', cell: 0 }), /illegal/);
  let done = engine.init({ length: 'end' }, 1, seats2);
  done.finished = { winner: 0, reason: 'x' };
  assert.throws(() => engine.apply(done, { type: 'flip' }), /illegal/);
});

test('apply is pure', () => {
  const s = engine.init({}, 3, seats2);
  const before = JSON.stringify(s);
  engine.apply(s, { type: 'flip' });
  assert.equal(JSON.stringify(s), before);
});

test('fuzz: play-to-the-end terminates (2p classic)', () => {
  fuzz(engine, { playouts: 60, moveCap: 6000, options: { length: 'end' }, seats: seats2 });
});

test('fuzz: showdown + variants + 3-4 players', () => {
  fuzz(engine, { playouts: 40, moveCap: 6000, options: { length: 'showdown' }, seats: seats2 });
  fuzz(engine, { playouts: 40, moveCap: 6000, options: { length: 'end', variant: 'sum' }, seats: seats3 });
  fuzz(engine, { playouts: 40, moveCap: 6000, options: { length: 'showdown', variant: 'product' }, seats: seats4 });
});
