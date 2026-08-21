# Go — deferred, decisions to make when picking this up

The tile in the hub shows "coming soon" (`meta.enabled: false`). Before
building the engine, decide:

1. **Board sizes** — offer 9×9 (teaching), 13×13, 19×19? Recommend starting
   9×9 only; it fits tablets and short attention spans.
2. **Ko rule** — simple ko (forbid immediate recapture) vs. positional
   superko (forbid any repeated whole-board position). Superko needs a
   position-hash set in state (Zobrist or a string key), like chess's `reps`.
3. **Scoring** — area (Chinese) vs. territory (Japanese). Area scoring is far
   easier to implement correctly and ends with a simple "two passes" rule.
4. **Dead-stone marking** — after two passes, players must agree which stones
   are dead. Needs a marking UI phase (`state.phase='marking'`) with both
   players confirming, or "play it out" Chinese-style to avoid the UI.
5. **Handicap stones** — worthwhile for Dad vs. the boys; standard star-point
   placement, White gets komi 0.5 only.
6. **Komi** — 7.5 (Chinese) if area scoring, 6.5 (Japanese) if territory.

Engine notes: state is `{ board: Int8Array-as-plain-array, turn, captures,
koKey?, passes, rng }`; moves are `{type:'place', x, y}` and `{type:'pass'}`;
flood-fill for liberties on apply; `legalMoves` must filter suicide and ko.
The fuzz test needs a move cap around 800 for 9×9 with superko.
