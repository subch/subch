// Synthesized WebAudio effects — no files, everything under -12 dBFS,
// per-profile mute. Lives in a living room; keep it soft.
let ctx = null;
let muted = false;

export const setMuted = (m) => { muted = !!m; };

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, { dur = 0.12, type = 'sine', gain = 0.12, when = 0, slide = 0 } = {}) {
  const a = ac();
  if (!a || muted) return;
  const t0 = a.currentTime + when;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(a.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function thump(freq, { dur = 0.09, gain = 0.16, when = 0 } = {}) {
  const a = ac();
  if (!a || muted) return;
  const t0 = a.currentTime + when;
  // filtered noise burst + low sine decay = a soft wooden tap
  const len = Math.floor(a.sampleRate * 0.04);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const noise = a.createBufferSource();
  noise.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 900;
  const ng = a.createGain();
  ng.gain.setValueAtTime(gain * 0.6, t0);
  ng.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.05);
  noise.connect(f).connect(ng).connect(a.destination);
  noise.start(t0);
  tone(freq, { dur, type: 'sine', gain, when });
}

export const sfx = {
  tap: () => thump(120),
  capture: () => thump(85, { dur: 0.12, gain: 0.18 }),
  chime: () => { tone(660, { gain: 0.08 }); tone(880, { when: 0.09, gain: 0.08 }); },
  win: () => { tone(523, { gain: 0.09 }); tone(659, { when: 0.11, gain: 0.09 }); tone(784, { when: 0.22, dur: 0.25, gain: 0.09 }); },
  yourTurn: () => tone(220, { dur: 0.2, gain: 0.07 }),
  deny: () => tone(160, { dur: 0.08, type: 'square', gain: 0.04 }),
};
