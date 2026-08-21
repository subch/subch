// mulberry32 seeded PRNG. The state is a plain 32-bit integer that lives in
// game state (state.rng), so the same seed + the same moves replays the same
// game on every device. Pure: every call returns { state, value }.

export function seedFromClock() {
  return (Date.now() ^ (Math.random() * 0xffffffff)) | 0;
}

export function next(state) {
  const t = (state + 0x6d2b79f5) | 0;
  let r = t;
  r = Math.imul(r ^ (r >>> 15), r | 1);
  r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
  const value = ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  return { state: t, value };
}

// Integer in [0, n)
export function randInt(state, n) {
  const r = next(state);
  return { state: r.state, value: Math.floor(r.value * n) };
}

// Fisher–Yates; returns a NEW array, input untouched.
export function shuffle(state, arr) {
  const out = arr.slice();
  let s = state;
  for (let i = out.length - 1; i > 0; i--) {
    const r = randInt(s, i + 1);
    s = r.state;
    [out[i], out[r.value]] = [out[r.value], out[i]];
  }
  return { state: s, value: out };
}
