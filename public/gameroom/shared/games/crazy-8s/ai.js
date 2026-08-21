// Crazy 8's AI (bonus, not in the original plan): a simple family-strength
// heuristic — dump high cards, save 8s for when you're stuck, call the suit
// you hold the most of.
import * as engine from './engine.js';
import { rank, suit } from './engine.js';

const cardValue = (c) => rank(c) + 2;

export function chooseMove(state, level, rng = Math.random) {
  const moves = engine.legalMoves(state);
  const hand = state.hands[state.turn];

  if (state.phase === 'suit') {
    const counts = [0, 0, 0, 0];
    for (const c of hand) counts[suit(c)] += 1;
    const best = counts.indexOf(Math.max(...counts));
    return { type: 'suit', suit: best };
  }

  const plays = moves.filter((m) => m.type === 'play');
  const nonEights = plays.filter((m) => rank(m.card) !== 6);
  if (nonEights.length) {
    nonEights.sort((a, b) => cardValue(b.card) - cardValue(a.card));
    return nonEights[0];
  }
  if (plays.length) return plays[0]; // only an 8 left to play
  const draw = moves.find((m) => m.type === 'draw');
  if (draw) return draw;
  return moves[0]; // forced pass
}
