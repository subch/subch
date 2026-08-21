import { test } from 'node:test';
import assert from 'node:assert';
import * as engine from './engine.js';
import { fuzz } from '../fuzz.js';

const kids = [{ seat: 0, level: 1 }, { seat: 1, level: 5 }];
const solo = [{ seat: 0, level: 3 }];

test('init: gate phase, per-seat levels clamped', () => {
  const s = engine.init({}, 7, kids);
  assert.equal(s.phase, 'gate');
  assert.deepEqual(s.levels, [1, 5]);
  assert.deepEqual(engine.legalMoves(s), [{ type: 'begin' }]);
  assert.equal(engine.timer(s), null, 'no clock at the gate');
  assert.deepEqual(JSON.parse(JSON.stringify(s)), s);
});

test('questions match the level', () => {
  for (let seed = 1; seed < 60; seed++) {
    const s = { rng: seed };
    const q1 = engine.makeQuestion(s, 1);
    assert.ok(q1.answer <= 10, `L1 within 10 (${q1.text})`);
    assert.ok(q1.dots, 'L1 shows dots');
    const q2 = engine.makeQuestion(s, 2);
    assert.ok(q2.answer >= 0 && q2.answer <= 20, `L2 within 20 (${q2.text})`);
    const q4 = engine.makeQuestion(s, 4);
    assert.ok(Number.isInteger(q4.answer), `L4 integer (${q4.text})`);
    const q5 = engine.makeQuestion(s, 5);
    assert.ok(Number.isInteger(q5.answer) && q5.answer >= 0, `L5 sane (${q5.text})`);
  }
});

test('quick fire: right answers score, wrong do not, perfect round earns a bonus', () => {
  let s = engine.init({}, 3, kids);
  s = engine.apply(s, { type: 'begin' });
  assert.equal(s.phase, 'quickfire');
  assert.deepEqual(engine.timer(s), { kind: 'turn', seconds: 20 });
  // five perfect answers → 5 + 1 bonus
  for (let i = 0; i < 5; i++) {
    s = engine.apply(s, { type: 'answer', value: s.current.answer });
  }
  assert.equal(s.scores[0], 6);
  assert.equal(s.turn, 1);
  assert.equal(s.phase, 'gate');
  // player 2 fumbles everything
  s = engine.apply(s, { type: 'begin' });
  for (let i = 0; i < 5; i++) {
    s = engine.apply(s, { type: 'answer', value: -1 });
  }
  assert.equal(s.scores[1], 0);
  assert.equal(s.round, 1);
  assert.equal(s.turn, 0);
});

test('quick fire finishes after three rounds each; scores decide', () => {
  let s = engine.init({}, 11, kids);
  let guard = 0;
  while (!engine.status(s).over && guard++ < 200) {
    const legal = engine.legalMoves(s);
    // player 0 always right, player 1 always times out
    if (s.phase === 'gate') s = engine.apply(s, { type: 'begin' });
    else if (s.turn === 0) s = engine.apply(s, legal[0]);
    else s = engine.apply(s, { type: 'timeout' });
  }
  const st = engine.status(s);
  assert.equal(st.over, true);
  assert.equal(st.winner, 0);
  assert.equal(st.scores[0], 18); // 3 rounds × (5 + bonus)
  assert.equal(st.scores[1], 0);
});

test('make 24: deals are always solvable, valid solve scores, wrong is illegal', () => {
  let s = engine.init({ mode: 'make24' }, 5, kids);
  s = engine.apply(s, { type: 'begin' });
  assert.equal(s.current.target, 10, 'level 1 gets Make 10');
  assert.equal(s.current.cards.length, 3);
  assert.equal(engine.evalExpr(s.current.solution), 10);
  assert.throws(() => engine.apply(s, { type: 'solve', expr: [1, '+', 1] }), /illegal/);
  s = engine.apply(s, { type: 'solve', expr: s.current.solution });
  assert.equal(s.scores[0], 1);
  // level 5 player gets Make 24 with four cards
  s = engine.apply(s, { type: 'begin' });
  assert.equal(s.current.target, 24);
  assert.equal(s.current.cards.length, 4);
});

test('make 24 ends at first-to-5', () => {
  let s = engine.init({ mode: 'make24' }, 9, solo);
  let guard = 0;
  while (!engine.status(s).over && guard++ < 60) {
    s = engine.apply(s, engine.legalMoves(s)[0]);
  }
  const st = engine.status(s);
  assert.equal(st.over, true);
  assert.equal(st.scores[0], 5);
  assert.equal(st.winner, 0);
});

test('evalExpr: left-to-right, integer division only', () => {
  assert.equal(engine.evalExpr([2, '+', 3, '*', 4]), 20); // (2+3)*4, not 14
  assert.equal(engine.evalExpr([9, '/', 3, '+', 1]), 4);
  assert.equal(engine.evalExpr([7, '/', 2]), null, 'no fractions');
  assert.equal(engine.evalExpr([5, '/', 0]), null);
  assert.equal(engine.evalExpr([5, '%', 2]), null, 'unknown op');
});

test('view hides the answer from the other seats', () => {
  let s = engine.init({}, 3, kids);
  s = engine.apply(s, { type: 'begin' });
  assert.equal(engine.view(s, 0).current.answer, s.current.answer);
  assert.equal(engine.view(s, 1).current.answer, undefined);
});

test('apply is pure; illegal moves throw', () => {
  const s = engine.init({}, 3, kids);
  const before = JSON.stringify(s);
  engine.apply(s, { type: 'begin' });
  assert.equal(JSON.stringify(s), before);
  assert.throws(() => engine.apply(s, { type: 'answer', value: 4 }), /illegal/); // still gated
});

test('fuzz: both modes, 1-4 players', () => {
  fuzz(engine, { playouts: 60, moveCap: 80, seats: kids });
  fuzz(engine, { playouts: 60, moveCap: 120, options: { mode: 'make24' }, seats: kids });
  fuzz(engine, { playouts: 40, moveCap: 160, seats: [{ seat: 0, level: 2 }, { seat: 1, level: 3 }, { seat: 2, level: 4 }, { seat: 3, level: 5 }] });
  fuzz(engine, { playouts: 40, moveCap: 60, seats: solo });
});
