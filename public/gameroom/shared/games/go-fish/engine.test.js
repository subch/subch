import { test } from 'node:test';
import assert from 'node:assert';
import * as engine from './engine.js';
import { fuzz } from '../fuzz.js';

const seats2 = [{ seat: 0 }, { seat: 1 }];
const seats3 = [{ seat: 0 }, { seat: 1 }, { seat: 2 }];
const card = (r, s) => s * 13 + r;

function rigged() {
  const s = engine.init({}, 1, seats2);
  s.hands = [[card(5, 0), card(5, 1), card(9, 2)], [card(5, 2), card(2, 0)]];
  s.books = [[], []];
  s.stock = [card(9, 0), card(3, 3), card(3, 2)];
  s.turn = 0;
  s.lastAction = null;
  return s;
}

test('init: 7 cards each heads-up, 5 with three players, dealt books collected', () => {
  for (let seed = 1; seed < 25; seed++) {
    const s2 = engine.init({}, seed, seats2);
    const inPlay = s2.hands.flat().length + s2.stock.length + s2.books.flat().length * 4;
    assert.equal(inPlay, 52);
    const s3 = engine.init({}, seed, seats3);
    assert.ok(s3.hands.every((h) => h.length <= 5));
  }
});

test('a hit hands over every card of the rank and you go again', () => {
  let s = rigged();
  s = engine.apply(s, { type: 'ask', target: 1, rank: 5 });
  assert.equal(s.turn, 0, 'goes again');
  assert.equal(s.hands[1].length, 1);
  assert.equal(s.hands[0].filter((c) => engine.rank(c) === 5).length, 3);
  assert.equal(s.lastAction.got, 1);
});

test('a miss goes fishing; fishing the asked rank keeps the turn', () => {
  let s = rigged();
  s = engine.apply(s, { type: 'ask', target: 1, rank: 9 }); // opp has no 9s; stock top IS a 9
  assert.equal(s.lastAction.luckyFish, true);
  assert.equal(s.turn, 0, 'lucky fish keeps the turn');
  s = engine.apply(s, { type: 'ask', target: 1, rank: 9 }); // now draws a 3 — miss
  assert.equal(s.lastAction.luckyFish, false);
  assert.equal(s.turn, 1, 'turn passes');
});

test('collecting all four makes a book and scores', () => {
  let s = rigged();
  s.hands[0] = [card(5, 0), card(5, 1), card(5, 3)];
  s.hands[1] = [card(5, 2), card(2, 0)];
  s = engine.apply(s, { type: 'ask', target: 1, rank: 5 });
  assert.deepEqual(s.books[0], [5]);
  assert.equal(s.hands[0].length, 0, 'book left the hand');
  assert.equal(engine.status(s).scores[0], 1);
});

test('empty hand draws five; game ends when everything is booked', () => {
  let s = rigged();
  s.hands[0] = [];
  const moves = engine.legalMoves(s);
  assert.deepEqual(moves, [{ type: 'draw5' }]);
  s = engine.apply(s, moves[0]);
  assert.equal(s.hands[0].length, 3, 'only three left in stock');

  const done = engine.init({}, 1, seats2);
  done.books = [[0, 1, 2, 3, 4, 5, 6], [7, 8, 9, 10, 11, 12]];
  done.hands = [[], []];
  done.stock = [];
  const st = engine.status(done);
  assert.equal(st.over, true);
  assert.equal(st.winner, 0);
});

test('illegal moves throw', () => {
  const s = rigged();
  assert.throws(() => engine.apply(s, { type: 'ask', target: 1, rank: 2 }), /illegal/); // rank not held
  assert.throws(() => engine.apply(s, { type: 'ask', target: 0, rank: 5 }), /illegal/); // can't ask self
  assert.throws(() => engine.apply(s, { type: 'draw5' }), /illegal/); // hand not empty
});

test('view hides the other hands and the stock', () => {
  const s = engine.init({}, 5, seats2);
  const v = engine.view(s, 1);
  assert.ok(v.hands[0].every((c) => c === -1));
  assert.deepEqual(v.hands[1], s.hands[1]);
  assert.ok(v.stock.every((c) => c === -1));
});

test('apply is pure', () => {
  const s = rigged();
  const before = JSON.stringify(s);
  engine.apply(s, engine.legalMoves(s)[0]);
  assert.equal(JSON.stringify(s), before);
});

test('fuzz: 2 and 3 players play out', () => {
  fuzz(engine, { playouts: 120, moveCap: 3000, seats: seats2 });
  fuzz(engine, { playouts: 80, moveCap: 4000, seats: seats3 });
});
