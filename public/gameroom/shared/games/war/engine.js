// War. 2–4 players, aces high. Cards are ints 0..51: rank = c % 13 (0='2' …
// 12='A'), suit = c / 13 | 0 (♠♥♦♣). Each round every alive player flips
// (taps their own deck on their turn); highest value takes the pot; ties
// trigger a war (3 down + the scoring cards up, repeat). Won cards go to a
// face-up winnings pile; when the deck runs out the winnings are shuffled
// (rng) and turned over as the new deck. Sum/Product flip 2 cards and score
// arithmetic — the math versions for the boys.
export { meta } from './meta.js';
import { shuffle } from '../../rng.js';

export const rank = (c) => c % 13;
export const suit = (c) => (c / 13) | 0;
export const cardValue = (c) => rank(c) + 2; // 2..14, ace high

const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const SUITS = ['♠', '♥', '♦', '♣'];
export const cardName = (c) => `${RANKS[rank(c)]}${SUITS[suit(c)]}`;

const clone = (s) => JSON.parse(JSON.stringify(s));

export function init(options, seed, seats) {
  const n = seats ? seats.length : 2;
  const flipCount = (options?.variant === 'sum' || options?.variant === 'product') ? 2 : 1;
  let rng = seed | 0;
  const all = Array.from({ length: 52 }, (_, i) => i);
  const sh = shuffle(rng, all);
  rng = sh.state;
  const per = Math.floor(52 / n);
  const decks = [];
  for (let i = 0; i < n; i++) decks.push(sh.value.slice(i * per, (i + 1) * per));
  const state = {
    players: n, rng, flipCount,
    variant: options?.variant || 'classic',
    showdown: (options?.length || 'showdown') === 'showdown',
    turn: 0,
    decks,
    wons: decks.map(() => []),
    out: decks.map(() => false),
    faceUp: decks.map(() => null),
    pot: [],
    need: [],
    contenders: [],
    phase: 'flip',
    warDepth: 0,
    timeUp: false,
    suddenDeath: false,
    finished: null,
    lastRound: null,
  };
  startRound(state);
  return state;
}

const total = (s, i) => s.decks[i].length + s.wons[i].length;

export function totals(state) {
  return state.decks.map((_, i) => total(state, i) + (state.faceUp[i]?.length || 0));
}

function uniqueLeader(s) {
  const t = totals(s);
  const max = Math.max(...t);
  const leaders = t.map((v, i) => [v, i]).filter(([v, i]) => v === max && !s.out[i]);
  return leaders.length === 1 ? leaders[0][1] : null;
}

// Mutates the working copy: eliminations, game end, fresh round.
function startRound(s) {
  for (let i = 0; i < s.players; i++) {
    if (!s.out[i] && total(s, i) === 0) s.out[i] = true;
  }
  const alive = [];
  for (let i = 0; i < s.players; i++) if (!s.out[i]) alive.push(i);
  if (alive.length <= 1) {
    s.finished = { winner: alive[0] ?? null, reason: alive.length ? 'took every card' : 'everyone ran dry' };
    return;
  }
  if (s.timeUp) {
    const leader = uniqueLeader(s);
    if (leader !== null) {
      s.finished = { winner: leader, reason: 'most cards at time' };
      return;
    }
    s.suddenDeath = true; // tied at the bell — next decisive round wins
  }
  s.faceUp = s.decks.map(() => null);
  s.pot = [];
  s.contenders = alive.slice();
  s.need = alive.slice();
  s.phase = 'flip';
  s.warDepth = 0;
  s.turn = s.need[0];
}

export function legalMoves(state) {
  if (state.finished) return [];
  const moves = [{ type: 'flip' }];
  if (state.showdown && !state.timeUp) moves.push({ type: 'timeout' });
  return moves;
}

// Replenish: turning the winnings pile over shuffles it under the deck.
function ensureDeck(s, seat, needed) {
  if (s.decks[seat].length < needed && s.wons[seat].length > 0) {
    const sh = shuffle(s.rng, s.wons[seat]);
    s.rng = sh.state;
    s.decks[seat] = s.decks[seat].concat(sh.value);
    s.wons[seat] = [];
  }
}

function score(s, cards) {
  if (s.variant === 'sum') return cards.reduce((a, c) => a + cardValue(c), 0);
  if (s.variant === 'product') return cards.reduce((a, c) => a * cardValue(c), 1);
  return cardValue(cards[cards.length - 1]);
}

function resolve(s) {
  const inPlay = s.contenders.filter((i) => s.faceUp[i] && s.faceUp[i].length > 0);
  if (inPlay.length === 0) { startRound(s); return; }

  const values = {};
  for (const i of inPlay) values[i] = score(s, s.faceUp[i]);
  const max = Math.max(...inPlay.map((i) => values[i]));
  const tied = inPlay.filter((i) => values[i] === max);

  if (tied.length > 1) {
    // WAR: everything on the table goes into the pot; tied players go again.
    for (let i = 0; i < s.players; i++) {
      if (s.faceUp[i]) { s.pot.push(...s.faceUp[i]); s.faceUp[i] = null; }
    }
    s.contenders = tied;
    s.need = tied.slice();
    s.phase = 'war';
    s.warDepth += 1;
    s.turn = s.need[0];
    s.lastRound = { war: true, depth: s.warDepth };
    return;
  }

  const w = tied[0];
  const take = [...s.pot];
  for (let i = 0; i < s.players; i++) {
    if (s.faceUp[i]) { take.push(...s.faceUp[i]); s.faceUp[i] = null; }
  }
  s.pot = [];
  s.wons[w].push(...take);
  s.lastRound = { winner: w, take: take.length, war: s.warDepth > 0 };
  startRound(s);
}

export function apply(state, move) {
  if (!move || state.finished) throw new Error('illegal move');
  const s = clone(state);

  if (move.type === 'timeout') {
    if (!s.showdown || s.timeUp) throw new Error('illegal move');
    s.timeUp = true;
    const leader = uniqueLeader(s);
    if (leader !== null) s.finished = { winner: leader, reason: 'most cards at time' };
    else s.suddenDeath = true;
    return s;
  }

  if (move.type !== 'flip' || !s.need.includes(s.turn)) throw new Error('illegal move');

  const seat = s.turn;
  const down = s.phase === 'war' ? 3 : 0;
  const upNeed = s.flipCount;

  // Bring enough cards to the deck (shuffling the winnings pile over).
  ensureDeck(s, seat, down + upNeed);
  const avail = s.decks[seat].length;

  if (avail === 0) {
    // Can't fight this war — out of contention, cards on the table are lost.
    s.contenders = s.contenders.filter((i) => i !== seat);
  } else {
    // "…or all they have if fewer, the last card face-up."
    const downActual = Math.max(0, Math.min(down, avail - 1));
    const upActual = Math.min(upNeed, avail - downActual);
    s.pot.push(...s.decks[seat].splice(0, downActual));
    s.faceUp[seat] = s.decks[seat].splice(0, upActual);
  }

  s.need = s.need.filter((i) => i !== seat);
  if (s.need.length === 0) resolve(s); // resolve/startRound set the next turn
  else s.turn = s.need[0];
  return s;
}

export function status(state) {
  if (state.finished) {
    return {
      over: true,
      winner: state.finished.winner,
      reason: state.finished.reason,
      scores: totals(state),
    };
  }
  const note = state.phase === 'war'
    ? `WAR! ${'⚔'.repeat(Math.min(3, state.warDepth))}`
    : (state.suddenDeath ? 'Sudden death — next win takes it' : null);
  return { over: false, winner: null, scores: totals(state), note };
}

export function view(state) {
  return state; // pile order is the only secret, and nobody can see it
}

export function timer(state) {
  if (state.showdown && !state.timeUp && !state.finished) {
    return { kind: 'game', seconds: 600 };
  }
  return null;
}

export function describe(state, move) {
  if (move.type === 'timeout') return 'Time!';
  const seat = state.turn;
  const top = state.decks[seat][state.phase === 'war' ? 3 : 0];
  return top === undefined ? 'flips' : `flips ${cardName(top)}`;
}
