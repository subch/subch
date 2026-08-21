import { test } from 'node:test';
import assert from 'node:assert';
import * as engine from './engine.js';
import { fuzz } from '../fuzz.js';

const seats2 = [{ seat: 0 }, { seat: 1 }];
const seats4 = [{ seat: 0 }, { seat: 1 }, { seat: 2 }, { seat: 3 }];
const card = (r, s) => s * 13 + r; // rank index 0..12 = '2'..'A'

test('init: 7 cards each heads-up, 5 each with four, starter is never an 8', () => {
  for (let seed = 1; seed < 30; seed++) {
    const s2 = engine.init({}, seed, seats2);
    assert.deepEqual(s2.hands.map((h) => h.length), [7, 7]);
    assert.notEqual(engine.rank(s2.discard[0]), 6);
    const s4 = engine.init({}, seed, seats4);
    assert.deepEqual(s4.hands.map((h) => h.length), [5, 5, 5, 5]);
    assert.equal(s4.stock.length + 20 + 1, 52);
  }
  const s = engine.init({}, 5, seats2);
  assert.deepEqual(JSON.parse(JSON.stringify(s)), s);
});

function rigged() {
  // discard top: 5♥; seat 0 holds 5♠ (rank match), 9♥ (suit match), 8♦ (wild), 2♣ (dead)
  const s = engine.init({}, 1, seats2);
  s.discard = [card(3, 1)];
  s.currentSuit = 1;
  s.currentRank = 3;
  s.hands[0] = [card(3, 0), card(7, 1), card(6, 2), card(0, 3)];
  s.hands[1] = [card(0, 0), card(1, 0), card(2, 0)];
  s.turn = 0;
  s.phase = 'play';
  s.drawsThisTurn = 0;
  return s;
}

test('legal moves: rank match, suit match, and the wild 8 — plus draw', () => {
  const s = rigged();
  const plays = engine.legalMoves(s).filter((m) => m.type === 'play').map((m) => m.card).sort((a, b) => a - b);
  assert.deepEqual(plays, [card(3, 0), card(6, 2), card(7, 1)].sort((a, b) => a - b));
  assert.ok(engine.legalMoves(s).some((m) => m.type === 'draw'));
});

test('playing an 8 asks the same player for a suit, then play continues', () => {
  let s = rigged();
  s = engine.apply(s, { type: 'play', card: card(6, 2) }); // the 8♦
  assert.equal(s.phase, 'suit');
  assert.equal(s.turn, 0); // still the caller
  const suits = engine.legalMoves(s);
  assert.equal(suits.length, 4);
  s = engine.apply(s, { type: 'suit', suit: 3 });
  assert.equal(s.currentSuit, 3);
  assert.equal(s.turn, 1);
  // seat 1 must now match clubs or play an 8: 2♠ 3♠ 4♠ can't → draw available
  const m = engine.legalMoves(s);
  assert.ok(m.every((x) => x.type === 'draw'));
});

test('draw up to 3 then forced pass; blocked game ends with fewest cards winning', () => {
  let s = rigged();
  s.hands[0] = [card(0, 3)]; // only the dead 2♣
  s.stock = [card(1, 3), card(2, 3)]; // two dead clubs to draw
  s.hands[1] = [card(0, 0), card(1, 0)]; // dead spades (suit is hearts, rank 5)
  s = engine.apply(s, { type: 'draw' });
  s = engine.apply(s, { type: 'draw' });
  // stock empty, discard has only top → no more drawing → pass is forced
  const only = engine.legalMoves(s);
  assert.deepEqual(only, [{ type: 'pass' }]);
  s = engine.apply(s, { type: 'pass' });
  assert.equal(s.turn, 1);
  s = engine.apply(s, { type: 'pass' }); // seat 1 also stuck → blocked
  const st = engine.status(s);
  assert.equal(st.over, true);
  assert.equal(st.winner, 1); // 2 cards beats 3
  assert.match(st.reason, /blocked/);
});

test('going out on an 8 wins immediately, no suit call', () => {
  let s = rigged();
  s.hands[0] = [card(6, 2)]; // just the 8♦
  s = engine.apply(s, { type: 'play', card: card(6, 2) });
  const st = engine.status(s);
  assert.equal(st.over, true);
  assert.equal(st.winner, 0);
});

test('illegal moves throw', () => {
  const s = rigged();
  assert.throws(() => engine.apply(s, { type: 'play', card: card(0, 3) }), /illegal/); // dead card
  assert.throws(() => engine.apply(s, { type: 'suit', suit: 1 }), /illegal/); // not in suit phase
  assert.throws(() => engine.apply(s, { type: 'pass' }), /illegal/); // has plays
});

test('view hides other hands and the stock', () => {
  const s = engine.init({}, 9, seats2);
  const v = engine.view(s, 0);
  assert.deepEqual(v.hands[0], s.hands[0]);
  assert.ok(v.hands[1].every((c) => c === -1));
  assert.ok(v.stock.every((c) => c === -1));
  assert.deepEqual(engine.view(s, 1).hands[1], s.hands[1]);
});

test('apply is pure', () => {
  const s = rigged();
  const before = JSON.stringify(s);
  engine.apply(s, { type: 'draw' });
  assert.equal(JSON.stringify(s), before);
});

test('fuzz: both draw rules, 2 and 4 players', () => {
  // random crazy-8s is a long-tailed random walk: measured worst case over
  // 300 seeds was ~4200 moves, so 8000 is the "something is truly stuck" line
  fuzz(engine, { playouts: 100, moveCap: 8000, options: { draw: '3' }, seats: seats2 });
  fuzz(engine, { playouts: 60, moveCap: 8000, options: { draw: 'toPlay' }, seats: seats2 });
  fuzz(engine, { playouts: 60, moveCap: 8000, options: { draw: '3' }, seats: seats4 });
});
