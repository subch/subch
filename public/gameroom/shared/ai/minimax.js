// Generic alpha-beta with iterative deepening and a wall-clock cap. Works
// against any engine in this repo: multi-step turns (multi-jumps, extra
// turns, give/place) fall out naturally because "whose node is this" is just
// state.turn. Pure JS, runs in the AI web worker.
//
//   bestMove(engine, state, {
//     evaluate(state, seat) → number   // heuristic, from `seat`'s viewpoint
//     maxDepth, timeMs,                // deepening caps
//     rng: () => float,                // tie-breaking / Easy noise
//   })
const WIN = 1e9;

export function bestMove(engine, state, opts) {
  const me = state.turn;
  const { evaluate, maxDepth = 4, timeMs = 900, rng = Math.random } = opts;
  const deadline = Date.now() + timeMs;
  let timedOut = false;

  function score(s, depth) {
    const st = engine.status(s);
    if (st.over) {
      if (st.winner === null || st.winner === undefined) {
        if (!Array.isArray(st.scores)) return 0;
        // multiplayer: fall back to score margin
        const mine = st.scores[me] ?? 0;
        const best = Math.max(...st.scores.filter((_, i) => i !== me));
        return (mine - best) * 1000;
      }
      // prefer faster wins, slower losses
      return st.winner === me ? WIN - depth : -WIN + depth;
    }
    return evaluate(s, me);
  }

  function search(s, depth, alpha, beta) {
    if (Date.now() > deadline) { timedOut = true; return 0; }
    const st = engine.status(s);
    if (depth === 0 || st.over) return score(s, depth);
    const moves = engine.legalMoves(s).filter((m) => m.type !== 'timeout');
    if (!moves.length) return score(s, depth);
    const maxing = s.turn === me;
    let best = maxing ? -Infinity : Infinity;
    for (const m of moves) {
      let next;
      try { next = engine.apply(s, m); } catch { continue; }
      const v = search(next, depth - 1, alpha, beta);
      if (timedOut) return 0;
      if (maxing) {
        if (v > best) best = v;
        if (best > alpha) alpha = best;
      } else {
        if (v < best) best = v;
        if (best < beta) beta = best;
      }
      if (beta <= alpha) break;
    }
    return best;
  }

  const rootMoves = engine.legalMoves(state).filter((m) => m.type !== 'timeout');
  if (rootMoves.length === 0) return null;
  if (rootMoves.length === 1) return rootMoves[0];

  let chosen = rootMoves[(rng() * rootMoves.length) | 0];
  for (let depth = 1; depth <= maxDepth; depth++) {
    let bestVal = -Infinity;
    let bestAtDepth = null;
    // light shuffle so equal moves vary game to game
    const order = [...rootMoves].sort(() => rng() - 0.5);
    for (const m of order) {
      let next;
      try { next = engine.apply(state, m); } catch { continue; }
      const v = search(next, depth - 1, -Infinity, Infinity);
      if (timedOut) break;
      if (v > bestVal) { bestVal = v; bestAtDepth = m; }
    }
    if (timedOut) break;
    if (bestAtDepth) chosen = bestAtDepth;
    if (bestVal >= WIN - depth - 1) break; // found a forced win
  }
  return chosen;
}

// Utility for "Easy" levels and safe-random fallbacks.
export function randomMove(engine, state, rng = Math.random) {
  const moves = engine.legalMoves(state).filter((m) => m.type !== 'timeout');
  if (!moves.length) return null;
  return moves[(rng() * moves.length) | 0];
}

// Random, but never a move that hands the opponent an immediate win, and
// always a move that wins immediately if one exists.
export function safeRandomMove(engine, state, rng = Math.random) {
  const me = state.turn;
  const moves = engine.legalMoves(state).filter((m) => m.type !== 'timeout');
  if (!moves.length) return null;
  const safe = [];
  for (const m of moves) {
    let next;
    try { next = engine.apply(state, m); } catch { continue; }
    const st = engine.status(next);
    if (st.over && st.winner === me) return m; // take the win
    if (st.over && st.winner !== null && st.winner !== me) continue;
    // does any opponent reply win at once?
    let bad = false;
    if (!st.over && next.turn !== me) {
      for (const reply of engine.legalMoves(next).filter((x) => x.type !== 'timeout')) {
        try {
          const rs = engine.status(engine.apply(next, reply));
          if (rs.over && rs.winner === next.turn) { bad = true; break; }
        } catch { /* skip */ }
      }
    }
    if (!bad) safe.push(m);
  }
  const pool = safe.length ? safe : moves;
  return pool[(rng() * pool.length) | 0];
}
