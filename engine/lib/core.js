// Core helpers: easing, math, seeded randomness, timeline lookups, SFX cue registry.

const W = 1080;
const H = 1920;
const FPS = 30;

const BRAND = {
  blue: '#3884FF',
  blue2: '#8CBEFF',
  bg: '#080A10',
  text: '#F2F5FA',
  muted: '#8C96AA',
  panel: '#101520',
  border: '#323E56',
  bad: '#FF5C6C', // used only to mark "wrong" examples
  good: '#3DDC97', // used only for success ticks
};

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const inv = (a, b, v) => clamp((v - a) / (b - a)); // progress of v between a and b

const ease = {
  linear: (t) => t,
  inQuad: (t) => t * t,
  outQuad: (t) => 1 - (1 - t) * (1 - t),
  inOutQuad: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  inCubic: (t) => t * t * t,
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outExpo: (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  inExpo: (t) => (t <= 0 ? 0 : Math.pow(2, 10 * t - 10)),
  inOutExpo: (t) =>
    t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2,
  outBack: (t, s = 1.9) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2),
  outBackSoft: (t) => ease.outBack(t, 1.2),
  outElastic: (t) =>
    t <= 0 ? 0 : t >= 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1,
};

// Progress of an animation that starts at t0 and lasts dur, with easing.
const prog = (t, t0, dur, e = ease.outCubic) => e(inv(t0, t0 + dur, t));

// Deterministic PRNG so every render is identical.
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 1e9) / 1e9;
  };
}

// Smooth 1D value noise for shake/drift.
function noise1(seed) {
  const r = rng(seed);
  const pts = Array.from({ length: 512 }, () => r() * 2 - 1);
  return (x) => {
    const i = Math.floor(x);
    const f = x - i;
    const a = pts[((i % 512) + 512) % 512];
    const b = pts[(((i + 1) % 512) + 512) % 512];
    const u = f * f * (3 - 2 * f);
    return a + (b - a) * u;
  };
}

// Timeline built from tts.py output.
class Timeline {
  constructor(data) {
    this.data = data;
    this.duration = data.duration;
    this.seg = {};
    for (const s of data.segments) this.seg[s.id] = s;
  }
  // start time of word idx in segment id (negative idx counts from end)
  w(id, idx) {
    const words = this.seg[id].words;
    return words[idx < 0 ? words.length + idx : idx].start;
  }
  wend(id, idx) {
    const words = this.seg[id].words;
    return words[idx < 0 ? words.length + idx : idx].end;
  }
  // first word in segment whose text starts with `prefix` (case-insensitive), nth match
  find(id, prefix, nth = 0) {
    const p = prefix.toLowerCase();
    const hits = this.seg[id].words.filter((x) => x.w.toLowerCase().replace(/[^a-z0-9']/g, '').startsWith(p));
    if (!hits[nth]) throw new Error(`word "${prefix}" #${nth} not in segment ${id}`);
    return hits[nth].start;
  }
  start(id) {
    return this.seg[id].start;
  }
  end(id) {
    return this.seg[id].end;
  }
  words() {
    return this.data.segments.flatMap((s) => s.words.map((w) => ({ ...w, seg: s.id })));
  }
}

// Every animation that makes a sound registers a cue here, so picture and SFX share one clock.
class Cues {
  constructor() {
    this.list = [];
  }
  add(type, t, gain = 1, extra = {}) {
    this.list.push({ type, t: Math.round(t * 1000) / 1000, gain, ...extra });
    return t;
  }
  sorted() {
    return [...this.list].sort((a, b) => a.t - b.t);
  }
}

module.exports = { W, H, FPS, BRAND, clamp, lerp, inv, ease, prog, rng, noise1, Timeline, Cues };
