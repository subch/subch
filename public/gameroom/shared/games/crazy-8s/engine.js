// Crazy 8's (owner addition). Match the top discard by suit or rank; 8s are
// wild and the player calls the next suit; can't play → draw (up to 3, or
// until playable, per option) then pass; first empty hand wins. If the game
// blocks (everyone passes with nothing to draw), fewest cards wins.
// Cards are ints 0..51 like War: rank = c % 13 (0='2'…12='A'), suit = c/13|0.
export { meta } from './meta.js';
import { shuffle } from '../../rng.js';

export const rank = (c) => c % 13;
export const suit = (c) => (c / 13) | 0;
const EIGHT = 6; // rank index of '8'

const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const SUIT_GLYPHS = ['♠', '♥', '♦', '♣'];
export const SUIT_NAMES = ['spades', 'hearts', 'diamonds', 'clubs'];
export const cardName = (c) => `${RANKS[rank(c)]}${SUIT_GLYPHS[suit(c)]}`;

const clone = (s) => JSON.parse(JSON.stringify(s));

export function init(options, seed, seats) {
  const n = seats ? seats.length : 2;
  let rng = seed | 0;
  const sh = shuffle(rng, Array.from({ length: 52 }, (_, i) => i));
  rng = sh.state;
  const stock = sh.value;
  const per = n === 2 ? 7 : 5;
  const hands = [];
  for (let i = 0; i < n; i++) hands.push(stock.splice(0, per));
  // starter card: an 8 goes to the bottom and we flip again
  let starter = stock.shift();
  while (rank(starter) === EIGHT) {
    stock.push(starter);
    starter = stock.shift();
  }
  return {
    players: n, rng,
    drawLimit: options?.draw === 'toPlay' ? 99 : 3,
    turn: 0,
    hands,
    stock,
    discard: [starter],
    currentSuit: suit(starter),
    currentRank: rank(starter),
    phase: 'play', // 'play' | 'suit' (after an 8, same player calls the suit)
    drawsThisTurn: 0,
    passes: 0, // consecutive passes → blocked game
    blocked: false,
    lastAction: null,
  };
}

const playable = (s, c) =>
  rank(c) === EIGHT || rank(c) === s.currentRank || suit(c) === s.currentSuit;

const canDraw = (s) =>
  s.drawsThisTurn < s.drawLimit && (s.stock.length > 0 || s.discard.length > 1);

function winnerBySeat(s) {
  for (let i = 0; i < s.players; i++) if (s.hands[i].length === 0) return i;
  return null;
}

export function legalMoves(state) {
  if (winnerBySeat(state) !== null || state.blocked) return [];
  if (state.phase === 'suit') {
    return [0, 1, 2, 3].map((su) => ({ type: 'suit', suit: su }));
  }
  const moves = [];
  const hand = state.hands[state.turn];
  for (const c of hand) if (playable(state, c)) moves.push({ type: 'play', card: c });
  if (canDraw(state)) moves.push({ type: 'draw' });
  if (moves.length === 0) moves.push({ type: 'pass' });
  return moves;
}

function nextTurn(s) {
  s.turn = (s.turn + 1) % s.players;
  s.drawsThisTurn = 0;
}

// Reshuffle everything but the top discard back into the stock.
function replenish(s) {
  if (s.stock.length === 0 && s.discard.length > 1) {
    const top = s.discard.pop();
    const sh = shuffle(s.rng, s.discard);
    s.rng = sh.state;
    s.stock = sh.value;
    s.discard = [top];
  }
}

export function apply(state, move) {
  if (!move || winnerBySeat(state) !== null || state.blocked) throw new Error('illegal move');
  const s = clone(state);
  const seat = s.turn;

  if (s.phase === 'suit') {
    if (move.type !== 'suit' || ![0, 1, 2, 3].includes(move.suit)) throw new Error('illegal move');
    s.currentSuit = move.suit;
    s.currentRank = EIGHT;
    s.phase = 'play';
    s.passes = 0;
    s.lastAction = { seat, type: 'suit', suit: move.suit };
    nextTurn(s);
    return s;
  }

  if (move.type === 'play') {
    const hand = s.hands[seat];
    const idx = hand.indexOf(move.card);
    if (idx < 0 || !playable(s, move.card)) throw new Error('illegal move');
    hand.splice(idx, 1);
    s.discard.push(move.card);
    s.passes = 0;
    s.lastAction = { seat, type: 'play', card: move.card };
    if (rank(move.card) === EIGHT) {
      if (hand.length === 0) return s; // out on an 8 — no suit call needed
      s.phase = 'suit'; // same player calls the suit
      return s;
    }
    s.currentSuit = suit(move.card);
    s.currentRank = rank(move.card);
    nextTurn(s);
    return s;
  }

  if (move.type === 'draw') {
    if (!canDraw(s)) throw new Error('illegal move');
    replenish(s);
    s.hands[seat].push(s.stock.shift());
    s.drawsThisTurn += 1;
    s.passes = 0;
    s.lastAction = { seat, type: 'draw' };
    return s;
  }

  if (move.type === 'pass') {
    const hasPlay = s.hands[seat].some((c) => playable(s, c));
    if (hasPlay || canDraw(s)) throw new Error('illegal move');
    s.passes += 1;
    s.lastAction = { seat, type: 'pass' };
    if (s.passes >= s.players) s.blocked = true;
    else nextTurn(s);
    return s;
  }

  throw new Error('illegal move');
}

export function status(state) {
  const w = winnerBySeat(state);
  const scores = state.hands.map((h) => -h.length);
  if (w !== null) {
    return { over: true, winner: w, reason: 'played every card', scores };
  }
  if (state.blocked) {
    const best = Math.max(...scores);
    const leaders = scores.map((v, i) => [v, i]).filter(([v]) => v === best);
    return {
      over: true,
      winner: leaders.length === 1 ? leaders[0][1] : null,
      reason: 'blocked — fewest cards wins',
      scores,
    };
  }
  const note = state.phase === 'suit'
    ? 'Calling the suit…'
    : state.currentRank === EIGHT
      ? `Suit is ${SUIT_GLYPHS[state.currentSuit]}`
      : null;
  return { over: false, winner: null, scores, note };
}

// Hidden info: other players' cards (and the piles) mask to -1.
export function view(state, seat) {
  const v = clone(state);
  v.hands = v.hands.map((h, i) => (i === seat ? h : h.map(() => -1)));
  v.stock = v.stock.map(() => -1);
  return v;
}

export function describe(state, move) {
  if (move.type === 'play') {
    return rank(move.card) === EIGHT
      ? `plays ${cardName(move.card)} (wild!)`
      : `plays ${cardName(move.card)}`;
  }
  if (move.type === 'suit') return `calls ${SUIT_NAMES[move.suit]}`;
  if (move.type === 'draw') return 'draws a card';
  return 'passes';
}
