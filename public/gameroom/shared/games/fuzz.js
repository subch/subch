// Shared fuzz harness for engine tests: N random legal playouts must
// terminate under the move cap without throwing, with status() consistent
// with legalMoves() at every step, and states surviving a JSON round-trip.
// (Not named *.test.js so the runner doesn't execute it directly.)
import assert from 'node:assert';
import { next, randInt } from '../rng.js';

export function fuzz(engine, {
  playouts = 300,
  moveCap = 500,
  options = {},
  seats = [{ seat: 0 }, { seat: 1 }],
} = {}) {
  let seedState = 0x5eed;
  for (let p = 0; p < playouts; p++) {
    seedState = next(seedState).state;
    let state = engine.init(options, seedState, seats);
    let pick = seedState;
    let moves = 0;
    for (;;) {
      const st = engine.status(state);
      const legal = engine.legalMoves(state);
      if (st.over) {
        assert.equal(legal.length, 0, `playout ${p}: game over but legalMoves is non-empty`);
        break;
      }
      assert.ok(legal.length > 0, `playout ${p}: not over but no legal moves (after ${moves} moves)`);
      assert.ok(moves < moveCap, `playout ${p}: exceeded ${moveCap} moves without ending`);
      if (moves % 25 === 0) {
        assert.deepEqual(JSON.parse(JSON.stringify(state)), state,
          `playout ${p}: state does not round-trip through JSON`);
      }
      const r = randInt(pick, legal.length);
      pick = r.state;
      state = engine.apply(state, legal[r.value]);
      moves++;
    }
  }
}
