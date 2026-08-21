// Go Fish. Ask someone for a rank you're holding: they hand over every card
// of it and you go again, or you "go fish" from the stock — and if you fish
// the very rank you asked for, you go again anyway. Four of a kind lays down
// as a book. Most books when the cards run out wins. Cards are ints 0..51,
// rank = c % 13 like the other card games.
export { meta } from './meta.js';
import { shuffle } from '../../rng.js';

export const rank = (c) => c % 13;
export const suit = (c) => (c / 13) | 0;
const RANK_NAMES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
export const rankName = (r) => RANK_NAMES[r];

const clone = (s) => JSON.parse(JSON.stringify(s));

// pull any completed books out of a hand
function collectBooks(s, seat) {
  const counts = {};
  for (const c of s.hands[seat]) counts[rank(c)] = (counts[rank(c)] || 0) + 1;
  for (const [r, n] of Object.entries(counts)) {
    if (n === 4) {
      s.hands[seat] = s.hands[seat].filter((c) => rank(c) !== Number(r));
      s.books[seat].push(Number(r));
      s.lastBook = { seat, rank: Number(r) };
    }
  }
}

export function init(options, seed, seats) {
  const n = seats ? seats.length : 2;
  let rng = seed | 0;
  const sh = shuffle(rng, Array.from({ length: 52 }, (_, i) => i));
  rng = sh.state;
  const stock = sh.value;
  const per = n === 2 ? 7 : 5;
  const s = {
    players: n, rng, turn: 0,
    hands: Array.from({ length: n }, () => stock.splice(0, per)),
    books: Array.from({ length: n }, () => []),
    stock,
    lastAction: null,
    lastBook: null,
  };
  for (let i = 0; i < n; i++) collectBooks(s, i); // dealt books count too
  return s;
}

const totalBooks = (s) => s.books.reduce((a, b) => a + b.length, 0);

function isOver(s) {
  if (totalBooks(s) === 13) return true;
  return s.stock.length === 0 && s.hands.every((h) => h.length === 0);
}

export function legalMoves(state) {
  if (isOver(state)) return [];
  const hand = state.hands[state.turn];
  if (hand.length === 0) {
    if (state.stock.length > 0) return [{ type: 'draw5' }];
    return [{ type: 'pass' }]; // out of the running until it ends
  }
  const ranks = [...new Set(hand.map(rank))].sort((a, b) => a - b);
  const moves = [];
  for (const r of ranks) {
    for (let t = 0; t < state.players; t++) {
      if (t !== state.turn && state.hands[t].length > 0) {
        moves.push({ type: 'ask', target: t, rank: r });
      }
    }
  }
  if (!moves.length) return [{ type: 'pass' }]; // nobody has cards to ask for
  return moves;
}

export function apply(state, move) {
  if (!move || isOver(state) ||
      !legalMoves(state).some((m) => m.type === move.type &&
        (m.type !== 'ask' || (m.target === move.target && m.rank === move.rank)))) {
    throw new Error('illegal move');
  }
  const s = clone(state);
  const seat = s.turn;
  s.lastBook = null;

  if (move.type === 'draw5') {
    s.hands[seat].push(...s.stock.splice(0, 5));
    collectBooks(s, seat);
    s.lastAction = { type: 'draw5', seat };
    return s;
  }
  if (move.type === 'pass') {
    s.turn = (s.turn + 1) % s.players;
    s.lastAction = { type: 'pass', seat };
    return s;
  }

  // the ask
  const taken = s.hands[move.target].filter((c) => rank(c) === move.rank);
  if (taken.length > 0) {
    s.hands[move.target] = s.hands[move.target].filter((c) => rank(c) !== move.rank);
    s.hands[seat].push(...taken);
    collectBooks(s, seat);
    s.lastAction = { type: 'ask', seat, target: move.target, rank: move.rank, got: taken.length };
    // you go again (turn unchanged)
    return s;
  }
  // "Go fish!"
  let luckyFish = false;
  if (s.stock.length > 0) {
    const drawn = s.stock.shift();
    s.hands[seat].push(drawn);
    luckyFish = rank(drawn) === move.rank;
    collectBooks(s, seat);
  }
  s.lastAction = { type: 'ask', seat, target: move.target, rank: move.rank, got: 0, luckyFish };
  if (!luckyFish) s.turn = (s.turn + 1) % s.players;
  return s;
}

export function status(state) {
  const scores = state.books.map((b) => b.length);
  if (isOver(state)) {
    const top = Math.max(...scores);
    const leaders = scores.map((v, i) => [v, i]).filter(([v]) => v === top);
    return {
      over: true,
      winner: leaders.length === 1 ? leaders[0][1] : null,
      reason: 'most books',
      scores,
    };
  }
  return { over: false, winner: null, scores };
}

// hands and the stock are secret
export function view(state, seat) {
  const v = clone(state);
  v.hands = v.hands.map((h, i) => (i === seat ? h : h.map(() => -1)));
  v.stock = v.stock.map(() => -1);
  return v;
}

export function describe(state, move) {
  if (move.type === 'ask') return `asks for ${rankName(move.rank)}s`;
  if (move.type === 'draw5') return 'draws a fresh hand';
  return 'passes';
}
