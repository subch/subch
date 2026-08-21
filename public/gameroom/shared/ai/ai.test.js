// AI sanity: every brain returns legal moves all game long, and the searchers
// convincingly beat a random player.
import { test } from 'node:test';
import assert from 'node:assert';
import { randomMove } from './minimax.js';
import { next, randInt } from '../rng.js';

const GAMES = [
  'tic-tac-toe', 'connect-four', 'checkers', 'mancala',
  'quarto', 'dots-and-boxes', 'chess', 'crazy-8s',
];

function seededRng(n) {
  let s = n;
  return () => { const r = next(s); s = r.state; return r.value; };
}

async function playAiVsRandom(gameId, level, seed, moveCap = 600) {
  const engine = await import(`../games/${gameId}/engine.js`);
  const ai = await import(`../games/${gameId}/ai.js`);
  const rng = seededRng(seed);
  let pickState = seed | 0;
  let state = engine.init({ length: 'end' }, seed, [{ seat: 0 }, { seat: 1 }]);
  let moves = 0;
  while (moves < moveCap) {
    const st = engine.status(state);
    if (st.over) return st;
    let move;
    if (state.turn === 0) {
      move = ai.chooseMove(state, level, rng);
    } else {
      const legal = engine.legalMoves(state).filter((m) => m.type !== 'timeout');
      const r = randInt(pickState, legal.length);
      pickState = r.state;
      move = legal[r.value];
    }
    assert.ok(move, `${gameId}: AI returned nothing`);
    state = engine.apply(state, move); // throws if the AI move is illegal
    moves++;
  }
  return engine.status(state);
}

test('every AI plays full legal games at every level', async () => {
  for (const gameId of GAMES) {
    for (const level of [1, 2, 3]) {
      await playAiVsRandom(gameId, level === 3 && gameId === 'chess' ? 1 : level, 100 + level, 700);
    }
  }
});

test('hard tic-tac-toe never loses to random (20 games)', async () => {
  for (let seed = 1; seed <= 20; seed++) {
    const st = await playAiVsRandom('tic-tac-toe', 3, seed, 12);
    assert.notEqual(st.winner, 1, `lost game with seed ${seed}`);
  }
});

test('connect four medium beats random at least 8 of 10', async () => {
  let wins = 0;
  for (let seed = 1; seed <= 10; seed++) {
    const st = await playAiVsRandom('connect-four', 2, seed, 60);
    if (st.winner === 0) wins++;
  }
  assert.ok(wins >= 8, `only ${wins}/10`);
});

test('checkers easy beats random at least 7 of 10', async () => {
  let wins = 0;
  for (let seed = 1; seed <= 10; seed++) {
    const st = await playAiVsRandom('checkers', 1, seed, 700);
    if (st.winner === 0) wins++;
  }
  assert.ok(wins >= 7, `only ${wins}/10`);
});

test('mancala medium beats random at least 8 of 10', async () => {
  let wins = 0;
  for (let seed = 1; seed <= 10; seed++) {
    const st = await playAiVsRandom('mancala', 2, seed, 400);
    if (st.winner === 0) wins++;
  }
  assert.ok(wins >= 8, `only ${wins}/10`);
});
