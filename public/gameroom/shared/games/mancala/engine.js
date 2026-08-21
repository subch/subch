// Mancala, Kalah rules. Pits 0–5 belong to seat 0, pits 6–11 to seat 1
// (counter-clockwise), one store each. Sow one stone per pit skipping the
// opponent's store; last stone in your store = go again; last stone in an
// empty pit on your side captures it plus the opposite pit (if non-empty).
// When either side empties, the other side keeps its remaining stones.
export { meta } from './meta.js';

const ownPits = (seat) => (seat === 0 ? [0, 1, 2, 3, 4, 5] : [6, 7, 8, 9, 10, 11]);
const opposite = (pit) => 11 - pit;
const owns = (seat, pit) => (seat === 0 ? pit < 6 : pit >= 6);

export function init(options, seed) {
  const stones = Number(options?.stones) || 4;
  return {
    pits: Array(12).fill(stones),
    stores: [0, 0],
    turn: 0,
    players: 2,
    rng: seed | 0,
    swept: false,
    lastSown: null,
  };
}

export function legalMoves(state) {
  if (state.swept) return [];
  return ownPits(state.turn)
    .filter((p) => state.pits[p] > 0)
    .map((p) => ({ type: 'sow', pit: p }));
}

// The sowing path for a seat: own pits → own store (as index 12+seat) →
// opponent's pits → wrap. Opponent's store is skipped entirely.
function path(seat) {
  return seat === 0
    ? [0, 1, 2, 3, 4, 5, 12, 6, 7, 8, 9, 10, 11]
    : [6, 7, 8, 9, 10, 11, 13, 0, 1, 2, 3, 4, 5];
}

export function apply(state, move) {
  if (!move || move.type !== 'sow' ||
      !legalMoves(state).some((m) => m.pit === move.pit)) {
    throw new Error('illegal move');
  }
  const s = JSON.parse(JSON.stringify(state));
  const seat = s.turn;
  const walk = path(seat);
  let at = walk.indexOf(move.pit);
  let stones = s.pits[move.pit];
  s.pits[move.pit] = 0;
  let last = null;

  while (stones > 0) {
    at = (at + 1) % walk.length;
    last = walk[at];
    if (last >= 12) s.stores[last - 12] += 1;
    else s.pits[last] += 1;
    stones -= 1;
  }
  s.lastSown = last;

  let extraTurn = false;
  if (last >= 12) {
    extraTurn = true; // ended in own store
  } else if (owns(seat, last) && s.pits[last] === 1 && s.pits[opposite(last)] > 0) {
    // landed in a previously-empty own pit: capture both
    s.stores[seat] += s.pits[last] + s.pits[opposite(last)];
    s.pits[last] = 0;
    s.pits[opposite(last)] = 0;
  }

  // side empty → the other side keeps what's left
  const side0 = ownPits(0).reduce((a, p) => a + s.pits[p], 0);
  const side1 = ownPits(1).reduce((a, p) => a + s.pits[p], 0);
  if (side0 === 0 || side1 === 0) {
    s.stores[0] += side0;
    s.stores[1] += side1;
    for (let i = 0; i < 12; i++) s.pits[i] = 0;
    s.swept = true;
    return s;
  }

  if (!extraTurn) s.turn = 1 - seat;
  return s;
}

export function status(state) {
  if (state.swept) {
    const [a, b] = state.stores;
    return {
      over: true,
      winner: a === b ? null : a > b ? 0 : 1,
      reason: a === b ? 'dead even' : 'most stones',
      scores: [a, b],
    };
  }
  return {
    over: false,
    winner: null,
    scores: [...state.stores],
    note: state.lastSown !== null && state.lastSown >= 12
      ? 'landed in the store — go again!' : null,
  };
}

export function view(state) {
  return state;
}

export function describe(state, move) {
  const n = move.pit % 6 + 1;
  return `sows from pit ${n}`;
}
