// Math Duel. Each player plays at their own profile level (1–5), so Wyatt
// and Dad share a game. Two modes:
//   Quick Fire — 3 rounds × 5 questions each, 20s per question, +1 bonus for
//   a perfect round. Turn-based: a "gate" phase sits between rounds so the
//   tablet gets passed (or the next device takes over).
//   Make 24 — take turns building the target from dealt cards with + − × ÷
//   (levels 1–2 get "Make 10" with three cards); solve = 1 point, first to 5.
// Only hands that are actually solvable (left-to-right evaluation, integer
// division only) are ever dealt — brute-forced at deal time from the rng.
// NOTE on the contract: legalMoves lists a correct answer/solution (so fuzz
// and future AIs can act), but apply also accepts any numeric answer or any
// valid-but-wrong expression — wrong answers are legal gameplay, they just
// score nothing.
export { meta } from './meta.js';
import { randInt } from '../../rng.js';

const ROUNDS = 3;
const QS = 5;
const FIRST_TO = 5;
const MAX_M24_TURNS = 40;

// ---------- question generation (pure, rng-threaded) -----------------------

function take(s, n) {
  const r = randInt(s.rng, n);
  s.rng = r.state;
  return r.value;
}

export function makeQuestion(s, level) {
  switch (level) {
    case 1: {
      const a = take(s, 6) + 1, b = take(s, Math.min(9 - a, 4)) + 1;
      return { text: `${a} + ${b}`, answer: a + b, dots: [a, b] };
    }
    case 2: {
      if (take(s, 2)) {
        const a = take(s, 15) + 3, b = take(s, Math.min(a, 10)) + 1;
        return { text: `${a} − ${b}`, answer: a - b };
      }
      const a = take(s, 12) + 2, b = take(s, 18 - a) + 1;
      return { text: `${a} + ${b}`, answer: a + b };
    }
    case 3: {
      if (take(s, 2)) {
        const a = take(s, 4) + 2, b = take(s, 8) + 2;
        return { text: `${a} × ${b}`, answer: a * b };
      }
      const a = take(s, 70) + 12, b = take(s, 25) + 4;
      return take(s, 2)
        ? { text: `${a} + ${b}`, answer: a + b }
        : { text: `${a} − ${b}`, answer: a - b };
    }
    case 4: {
      const a = take(s, 11) + 2, b = take(s, 11) + 2;
      return take(s, 2)
        ? { text: `${a} × ${b}`, answer: a * b }
        : { text: `${a * b} ÷ ${a}`, answer: b };
    }
    default: {
      if (take(s, 2)) {
        const a = take(s, 7) + 3, b = take(s, 7) + 3, c = take(s, a * b - 1) + 1;
        return { text: `${a} × ${b} − ${c}`, answer: a * b - c };
      }
      const d = [2, 3, 4, 5][take(s, 4)];
      const n = take(s, d - 1) + 1;
      const q = d * (take(s, 8) + 2);
      return { text: `${n}/${d} of ${q}`, answer: (q / d) * n };
    }
  }
}

// ---------- Make 24 dealing + evaluation -----------------------------------

// left-to-right evaluation, division only when exact; null = invalid
export function evalExpr(expr) {
  if (!Array.isArray(expr) || expr.length < 3 || expr.length % 2 === 0) return null;
  let acc = expr[0];
  if (typeof acc !== 'number') return null;
  for (let i = 1; i < expr.length; i += 2) {
    const op = expr[i], n = expr[i + 1];
    if (typeof n !== 'number') return null;
    if (op === '+') acc += n;
    else if (op === '-') acc -= n;
    else if (op === '*') acc *= n;
    else if (op === '/') {
      if (n === 0 || acc % n !== 0) return null;
      acc /= n;
    } else return null;
  }
  return acc;
}

function permutations(arr) {
  if (arr.length <= 1) return [arr];
  const out = [];
  for (let i = 0; i < arr.length; i++) {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
    for (const p of permutations(rest)) out.push([arr[i], ...p]);
  }
  return out;
}

const OPS = ['+', '-', '*', '/'];

export function findSolution(cards, target) {
  const opCount = cards.length - 1;
  for (const perm of permutations(cards)) {
    for (let mask = 0; mask < 4 ** opCount; mask++) {
      const expr = [perm[0]];
      let m = mask;
      for (let i = 0; i < opCount; i++) {
        expr.push(OPS[m % 4], perm[i + 1]);
        m = (m / 4) | 0;
      }
      if (evalExpr(expr) === target) return expr;
    }
  }
  return null;
}

function dealSolvable(s, level) {
  const target = level <= 2 ? 10 : 24;
  const count = level <= 2 ? 3 : 4;
  for (let tries = 0; tries < 200; tries++) {
    const cards = Array.from({ length: count }, () => take(s, 9) + 1);
    const solution = findSolution(cards, target);
    if (solution) return { cards, target, solution };
  }
  // rng conspiracies notwithstanding, fall back to a classic
  return { cards: target === 10 ? [2, 3, 5] : [4, 6, 8, 8], target, solution: findSolution(target === 10 ? [2, 3, 5] : [4, 6, 8, 8], target) };
}

// ---------- init -----------------------------------------------------------

export function init(options, seed, seats) {
  const players = seats ? seats.length : 1;
  const levels = (seats || [{}]).map((x) => Math.min(5, Math.max(1, x.level || 1)));
  const s = {
    mode: options?.mode === 'make24' ? 'make24' : 'quickfire',
    players,
    levels,
    turn: 0,
    rng: seed | 0,
    phase: 'gate', // every round/turn starts behind a "ready?" gate
    scores: Array(players).fill(0),
    done: false,
    current: null,
    round: 0,       // quickfire: 0..2
    q: 0,           // quickfire: 0..4
    roundCorrect: 0,
    m24Turns: 0,
  };
  return s;
}

// ---------- moves ----------------------------------------------------------

export function legalMoves(state) {
  if (state.done) return [];
  if (state.phase === 'gate') return [{ type: 'begin' }];
  if (state.mode === 'quickfire') {
    return [
      { type: 'answer', value: state.current.answer },
      { type: 'timeout' },
    ];
  }
  return [
    { type: 'solve', expr: state.current.solution },
    { type: 'skip' },
    { type: 'timeout' },
  ];
}

function nextQuickfire(s) {
  s.q += 1;
  if (s.q < QS) {
    s.current = makeQuestion(s, s.levels[s.turn]);
    return;
  }
  // round finished for this player
  if (s.roundCorrect === QS) s.scores[s.turn] += 1; // perfect-round bonus
  s.q = 0;
  s.roundCorrect = 0;
  s.current = null;
  if (s.turn + 1 < s.players) {
    s.turn += 1;
  } else {
    s.turn = 0;
    s.round += 1;
    if (s.round >= ROUNDS) { s.done = true; return; }
  }
  s.phase = 'gate';
}

function nextMake24(s) {
  s.m24Turns += 1;
  s.current = null;
  if (Math.max(...s.scores) >= FIRST_TO || s.m24Turns >= MAX_M24_TURNS) {
    s.done = true;
    return;
  }
  s.turn = (s.turn + 1) % s.players;
  s.phase = 'gate';
}

export function apply(state, move) {
  if (!move || state.done) throw new Error('illegal move');
  const s = JSON.parse(JSON.stringify(state));

  if (s.phase === 'gate') {
    if (move.type !== 'begin') throw new Error('illegal move');
    s.phase = s.mode;
    if (s.mode === 'quickfire') {
      s.current = makeQuestion(s, s.levels[s.turn]);
      s.phase = 'quickfire';
    } else {
      s.current = dealSolvable(s, s.levels[s.turn]);
      s.phase = 'make24';
    }
    return s;
  }

  if (s.mode === 'quickfire') {
    if (move.type === 'answer') {
      if (typeof move.value !== 'number') throw new Error('illegal move');
      const right = move.value === s.current.answer;
      if (right) { s.scores[s.turn] += 1; s.roundCorrect += 1; }
      s.lastResult = { right, answer: s.current.answer };
      nextQuickfire(s);
      return s;
    }
    if (move.type === 'timeout') {
      s.lastResult = { right: false, answer: s.current.answer };
      nextQuickfire(s);
      return s;
    }
    throw new Error('illegal move');
  }

  // make24
  if (move.type === 'solve') {
    const expr = move.expr;
    const used = (expr || []).filter((x) => typeof x === 'number');
    const sorted = [...used].sort((a, b) => a - b);
    const cards = [...s.current.cards].sort((a, b) => a - b);
    const valid = JSON.stringify(sorted) === JSON.stringify(cards) &&
      evalExpr(expr) === s.current.target;
    if (!valid) throw new Error('illegal move');
    s.scores[s.turn] += 1;
    s.lastResult = { right: true };
    nextMake24(s);
    return s;
  }
  if (move.type === 'skip' || move.type === 'timeout') {
    s.lastResult = { right: false };
    nextMake24(s);
    return s;
  }
  throw new Error('illegal move');
}

export function status(state) {
  const scores = [...state.scores];
  if (state.done) {
    const top = Math.max(...scores);
    const leaders = scores.map((v, i) => [v, i]).filter(([v]) => v === top);
    return {
      over: true,
      winner: state.players === 1 ? 0 : leaders.length === 1 ? leaders[0][1] : null,
      reason: state.mode === 'quickfire' ? 'three rounds played' : `first to ${FIRST_TO}`,
      scores,
    };
  }
  let note = null;
  if (state.phase === 'quickfire') note = `Round ${state.round + 1} of ${ROUNDS} · question ${state.q + 1} of ${QS}`;
  else if (state.phase === 'make24') note = `Make ${state.current.target}!`;
  return { over: false, winner: null, scores, note };
}

export function view(state, seat) {
  // hide the answer/solution from other seats (it's shown to nobody anyway,
  // but a Phase-2 table shouldn't leak it over the wire to opponents)
  if (seat === state.turn || !state.current) return state;
  const v = JSON.parse(JSON.stringify(state));
  if (v.current) { delete v.current.answer; delete v.current.solution; }
  return v;
}

export function timer(state) {
  if (state.done || state.phase === 'gate') return null;
  return { kind: 'turn', seconds: state.mode === 'quickfire' ? 20 : 60 };
}

export function describe(state, move) {
  if (move.type === 'begin') return 'starts their round';
  if (move.type === 'answer') return `answers ${move.value}`;
  if (move.type === 'solve') return 'solves it!';
  if (move.type === 'skip') return 'skips';
  return 'runs out of time';
}
