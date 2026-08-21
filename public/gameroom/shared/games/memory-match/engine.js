// Memory Match (concentration). Flip two cards: a pair is yours and you go
// again; a miss shows both for a beat (phase 'memorize', the view sends
// {type:'continue'}) and play passes on. Most pairs wins; great solo too.
// Cells hold rank indices 0..12 (drawn as playing cards); pairs share a rank.
export { meta } from './meta.js';
import { shuffle } from '../../rng.js';

const clone = (s) => JSON.parse(JSON.stringify(s));

export function init(options, seed, seats) {
  const pairs = Number(options?.pairs) || 10;
  let rng = seed | 0;
  const rankPick = shuffle(rng, Array.from({ length: 13 }, (_, i) => i));
  rng = rankPick.state;
  const chosen = rankPick.value.slice(0, pairs);
  const layoutShuffle = shuffle(rng, [...chosen, ...chosen]);
  rng = layoutShuffle.state;
  return {
    players: seats ? seats.length : 1,
    rng,
    pairs,
    cells: layoutShuffle.value,          // rank per cell
    owner: Array(pairs * 2).fill(null),  // seat that claimed the pair
    up: [],                              // the 1–2 cells face-up this turn
    seen: Array(pairs * 2).fill(false),  // public knowledge (for fair AIs)
    turn: 0,
    scores: Array(seats ? seats.length : 1).fill(0),
    phase: 'flip',                       // 'flip' | 'memorize'
  };
}

const allMatched = (s) => s.owner.every((o) => o !== null);

export function legalMoves(state) {
  if (allMatched(state)) return [];
  if (state.phase === 'memorize') return [{ type: 'continue' }];
  const moves = [];
  state.cells.forEach((_, i) => {
    if (state.owner[i] === null && !state.up.includes(i)) {
      moves.push({ type: 'flip', cell: i });
    }
  });
  return moves;
}

export function apply(state, move) {
  if (!move || allMatched(state)) throw new Error('illegal move');
  const s = clone(state);

  if (s.phase === 'memorize') {
    if (move.type !== 'continue') throw new Error('illegal move');
    s.up = [];
    s.phase = 'flip';
    s.turn = (s.turn + 1) % s.players;
    return s;
  }
  if (move.type !== 'flip' || !Number.isInteger(move.cell) ||
      move.cell < 0 || move.cell >= s.cells.length ||
      s.owner[move.cell] !== null || s.up.includes(move.cell)) {
    throw new Error('illegal move');
  }
  s.up.push(move.cell);
  s.seen[move.cell] = true;
  if (s.up.length === 2) {
    const [a, b] = s.up;
    if (s.cells[a] === s.cells[b]) {
      s.owner[a] = s.turn;
      s.owner[b] = s.turn;
      s.scores[s.turn] += 1;
      s.up = [];
      // a pair earns another go — turn stays
    } else {
      s.phase = 'memorize';
    }
  }
  return s;
}

export function status(state) {
  const scores = [...state.scores];
  if (allMatched(state)) {
    const top = Math.max(...scores);
    const leaders = scores.map((v, i) => [v, i]).filter(([v]) => v === top);
    return {
      over: true,
      winner: state.players === 1 ? 0 : leaders.length === 1 ? leaders[0][1] : null,
      reason: 'all pairs found',
      scores,
    };
  }
  return {
    over: false, winner: null, scores,
    note: state.phase === 'memorize' ? 'no match — remember those!' : null,
  };
}

export function view(state) {
  return state; // an open table; memory is the whole game
}

const RANK_NAMES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

export function describe(state, move) {
  if (move.type === 'continue') return 'passes the turn';
  return `flips a ${RANK_NAMES[state.cells[move.cell]]}`;
}
