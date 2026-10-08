// Frame-level effects: background, bloom, vignette, glitch, transitions, captions.

const { createCanvas } = require('@napi-rs/canvas');
const { RES, W, H, BRAND, clamp, lerp, inv, ease, rng, noise1 } = require('./core');
const { F, setFont, measure, rr } = require('./draw');

const layer = () => createCanvas(W * RES.s, H * RES.s);

// ---------- background: glow, dot grid, drifting particles ----------

class Background {
  // o.bright: >1 lifts the glow, grid and base colour; o.bpm: glow pulses on every beat
  constructor(seed = 3, o = {}) {
    const b = o.bright ?? 1;
    this.bright = b;
    this.beat = o.bpm ? 60 / o.bpm : 0;
    this.base = b > 1 ? '#0B1222' : BRAND.bg;
    this.glow = createCanvas(1400, 1400);
    const g = this.glow.getContext('2d');
    const rg = g.createRadialGradient(700, 700, 0, 700, 700, 700);
    rg.addColorStop(0, `rgba(56,132,255,${0.34 * b})`);
    rg.addColorStop(0.35, `rgba(56,132,255,${0.13 * b})`);
    rg.addColorStop(0.7, `rgba(56,132,255,${0.03 * b})`);
    rg.addColorStop(1, 'rgba(56,132,255,0)');
    g.fillStyle = rg;
    g.fillRect(0, 0, 1400, 1400);

    const gs = RES.s;
    this.grid = createCanvas((W + 120) * gs, (H + 120) * gs);
    const gg = this.grid.getContext('2d');
    gg.scale(gs, gs);
    // faint blueprint lines: barely there on black, but they give glass panels straight edges to bend
    gg.fillStyle = `rgba(140,190,255,${0.045 * Math.min(b, 1.5)})`;
    for (let x = 0; x < W + 120; x += 60) gg.fillRect(x, 0, 1, H + 120);
    for (let y = 0; y < H + 120; y += 60) gg.fillRect(0, y, W + 120, 1);
    gg.fillStyle = 'rgba(140,150,170,0.12)';
    for (let y = 0; y < H + 120; y += 60) for (let x = 0; x < W + 120; x += 60) gg.fillRect(x - 1, y - 1, 3, 3);

    this.dot = createCanvas(64, 64);
    const d = this.dot.getContext('2d');
    const dg = d.createRadialGradient(32, 32, 0, 32, 32, 32);
    dg.addColorStop(0, 'rgba(200,225,255,1)');
    dg.addColorStop(0.2, 'rgba(140,190,255,0.8)');
    dg.addColorStop(1, 'rgba(56,132,255,0)');
    d.fillStyle = dg;
    d.fillRect(0, 0, 64, 64);

    const r = rng(seed);
    this.parts = Array.from({ length: 70 }, () => ({
      x: r() * W, y: r() * H, v: 12 + r() * 40, s: 6 + r() * 22, ph: r() * 10, drift: (r() - 0.5) * 30, a: 0.25 + r() * 0.6,
    }));
    this.nx = noise1(seed + 1);
    this.ny = noise1(seed + 2);
  }

  draw(ctx, t, streak = 0) {
    ctx.fillStyle = this.base;
    ctx.fillRect(0, 0, W, H);
    // grid with slow parallax
    ctx.drawImage(this.grid, -60 + Math.sin(t * 0.2) * 20, -60 - ((t * 8) % 60), W + 120, H + 120);
    // two drifting glows
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const gx = 540 + this.nx(t * 0.25) * 160;
    const gy = 760 + this.ny(t * 0.25) * 200;
    // kick pump: the glow swells and brightens on every beat, then eases off
    const kick = this.beat ? Math.exp(-(t % this.beat) / 0.13) : 0;
    const pulse = 1 + 0.06 * Math.sin(t * 1.3) + 0.07 * kick;
    ctx.globalAlpha = 1;
    ctx.drawImage(this.glow, gx - 700 * pulse, gy - 700 * pulse, 1400 * pulse, 1400 * pulse);
    if (kick > 0.02) {
      ctx.globalAlpha = 0.35 * kick;
      ctx.drawImage(this.glow, gx - 800, gy - 800, 1600, 1600);
    }
    ctx.globalAlpha = 0.55 * Math.min(this.bright, 1.6);
    ctx.drawImage(this.glow, 540 - this.nx(t * 0.2 + 9) * 200 - 600, 1500 - 600, 1200, 1200);
    // particles
    for (const p of this.parts) {
      const y = (((p.y - t * p.v) % (H + 100)) + H + 100) % (H + 100) - 50;
      const x = p.x + Math.sin(t * 0.5 + p.ph) * p.drift;
      const tw = 0.5 + 0.5 * Math.sin(t * 2 + p.ph * 3);
      ctx.globalAlpha = p.a * (0.4 + 0.6 * tw);
      if (streak > 0.01) {
        ctx.drawImage(this.dot, x - p.s / 2 - streak * 60, y - p.s / 4, p.s + streak * 120, p.s / 2);
      } else ctx.drawImage(this.dot, x - p.s / 2, y - p.s / 2, p.s, p.s);
    }
    ctx.restore();
  }
}

// ---------- post: bloom + vignette ----------

class Post {
  constructor(o = {}) {
    this.sw = (W * RES.s) / 4;
    this.sh = (H * RES.s) / 4;
    this.small = createCanvas(this.sw, this.sh);
    this.small2 = createCanvas(this.sw, this.sh);
    this.vig = createCanvas(W, H);
    const v = this.vig.getContext('2d');
    const vg = v.createRadialGradient(W / 2, H * 0.45, H * 0.25, W / 2, H * 0.45, H * 0.72);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, `rgba(0,0,0,${o.vignette ?? 0.62})`);
    v.fillStyle = vg;
    v.fillRect(0, 0, W, H);
    this.tmp = layer();
  }

  bloom(canvas, amount = 0.38) {
    const s = this.small.getContext('2d');
    const s2 = this.small2.getContext('2d');
    s.globalCompositeOperation = 'copy';
    s.drawImage(canvas, 0, 0, this.sw, this.sh);
    // keep only the bright parts: x^4
    for (let k = 0; k < 2; k++) {
      s2.globalCompositeOperation = 'copy';
      s2.drawImage(this.small, 0, 0);
      s.globalCompositeOperation = 'multiply';
      s.drawImage(this.small2, 0, 0);
    }
    s2.globalCompositeOperation = 'copy';
    s2.filter = 'blur(9px)';
    s2.drawImage(this.small, 0, 0);
    s2.filter = 'none';
    const ctx = canvas.getContext('2d');
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = amount;
    ctx.drawImage(this.small2, 0, 0, W, H);
    ctx.restore();
  }

  vignette(ctx) {
    ctx.drawImage(this.vig, 0, 0, W, H);
  }

  // RGB split + sliced displacement.
  glitch(canvas, amt, seed) {
    if (amt <= 0.01) return;
    const r = rng(seed);
    const tctx = this.tmp.getContext('2d');
    tctx.globalCompositeOperation = 'copy';
    tctx.drawImage(canvas, 0, 0);
    const ctx = canvas.getContext('2d');
    const S = RES.s;
    const DW = W * S;
    const DH = H * S;
    const off = (6 + amt * 18) * S;
    // channel split by multiplying a copy with pure R / G / B and adding them back offset
    const ch = this._ch || (this._ch = [layer(), layer(), layer()]);
    const cols = ['#FF0000', '#00FF00', '#0000FF'];
    ch.forEach((c, i) => {
      const x = c.getContext('2d');
      x.globalCompositeOperation = 'copy';
      x.fillStyle = cols[i];
      x.fillRect(0, 0, DW, DH);
      x.globalCompositeOperation = 'multiply';
      x.drawImage(this.tmp, 0, 0);
    });
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'copy';
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, DW, DH);
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(ch[0], off, 0);
    ctx.drawImage(ch[1], 0, 0);
    ctx.drawImage(ch[2], -off, 0);
    ctx.restore();
    // slices
    tctx.drawImage(canvas, 0, 0);
    const n = Math.floor(3 + amt * 6);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    for (let i = 0; i < n; i++) {
      const y = r() * DH;
      const h = (8 + r() * 70 * amt) * S;
      const dx = (r() - 0.5) * 120 * amt * S;
      ctx.drawImage(this.tmp, 0, y, DW, h, dx, y, DW, h);
    }
    ctx.restore();
  }
}

// ---------- transitions ----------

// Blue circle wipe: circle grows to cover A, then a hole grows to reveal B.
function circleWipe(ctx, layerA, layerB, p, cx = 540, cy = 860) {
  const R = Math.hypot(Math.max(cx, W - cx), Math.max(cy, H - cy)) + 20;
  if (p < 0.5) {
    const u = ease.inCubic(p / 0.5);
    ctx.drawImage(layerA, 0, 0, W, H);
    ctx.save();
    ctx.fillStyle = BRAND.blue;
    ctx.beginPath();
    ctx.arc(cx, cy, R * u, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = BRAND.blue2;
    ctx.lineWidth = 10;
    ctx.stroke();
    ctx.restore();
  } else {
    const u = ease.outCubic((p - 0.5) / 0.5);
    ctx.drawImage(layerB, 0, 0, W, H);
    ctx.save();
    ctx.fillStyle = BRAND.blue;
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.arc(cx, cy, R * u, 0, Math.PI * 2, true);
    ctx.fill('evenodd');
    ctx.strokeStyle = BRAND.blue2;
    ctx.lineWidth = 10 * (1 - u) + 2;
    ctx.beginPath();
    ctx.arc(cx, cy, R * u, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

// Whip-pan: A flies out left, B flies in from the right, both motion-blurred.
function whipPan(ctx, layerA, layerB, p) {
  const dist = W * 1.15;
  const samples = 7;
  let L;
  let x;
  let vel;
  if (p < 0.5) {
    const u = p / 0.5;
    L = layerA;
    x = -dist * ease.inCubic(u);
    vel = 3 * u * u;
  } else {
    const u = (p - 0.5) / 0.5;
    L = layerB;
    x = dist * (1 - ease.outCubic(u));
    vel = 3 * (1 - u) * (1 - u);
  }
  const spread = vel * 110;
  ctx.save();
  for (let i = 0; i < samples; i++) {
    const k = i / (samples - 1) - 0.5;
    ctx.globalAlpha = i === Math.floor(samples / 2) ? 0.4 : 0.6 / (samples - 1);
    ctx.drawImage(L, x + k * spread, 0, W, H);
  }
  ctx.restore();
  return vel / 3;
}

// ---------- camera: push-in + shake ----------

function camera(ctx, t, s0, s1, o = {}) {
  const p = clamp((t - s0) / Math.max(0.1, s1 - s0));
  const sc = 1 + (o.push ?? 0.055) * ease.inOutQuad(p);
  const cx = o.cx ?? 540;
  const cy = o.cy ?? 800;
  ctx.translate(cx, cy);
  ctx.scale(sc, sc);
  ctx.translate(-cx, -cy);
}

class Shake {
  constructor(events, seed = 5) {
    this.ev = events;
    this.nx = noise1(seed);
    this.ny = noise1(seed + 9);
  }
  at(t) {
    let amp = 0;
    for (const e of this.ev) {
      if (t < e.t || t > e.t + (e.dur ?? 0.35)) continue;
      const k = 1 - (t - e.t) / (e.dur ?? 0.35);
      amp = Math.max(amp, (e.amp ?? 18) * k * k);
    }
    return amp > 0.2 ? [this.nx(t * 38) * amp, this.ny(t * 38) * amp, amp] : null;
  }
}

// ---------- captions ----------

const CAP = { size: 64, y: 1522, maxW: 800, gap: 20 };

function clean(w) {
  return w.replace(/\.\.\.$/, '').replace(/[.,:;!?…]+$/, '').toUpperCase();
}

function buildCaptions(words) {
  const chunks = [];
  let cur = [];
  let width = 0;
  const flush = () => {
    if (cur.length) chunks.push(cur);
    cur = [];
    width = 0;
  };
  words.forEach((w, i) => {
    const txt = clean(w.w);
    const ww = measure(txt, CAP.size, F.x);
    if (cur.length && (cur[0].seg !== w.seg || width + CAP.gap + ww > CAP.maxW || cur.length >= 4)) flush();
    cur.push({ ...w, txt, ww });
    width += (cur.length > 1 ? CAP.gap : 0) + ww;
    const brk = /[.:!?]$|\.\.\.$/.test(w.w) || (/,$/.test(w.w) && cur.length >= 2);
    if (brk) flush();
  });
  flush();
  // display windows
  return chunks.map((c, i) => {
    const next = chunks[i + 1];
    const last = c[c.length - 1];
    const end = next ? Math.min(next[0].start - 0.02, last.end + 0.6) : last.end + 0.8;
    return { words: c, start: c[0].start - 0.06, end };
  });
}

function drawCaptions(ctx, chunks, t) {
  const c = chunks.find((k) => t >= k.start && t < k.end);
  if (!c) return;
  const total = c.words.reduce((s, w, i) => s + w.ww + (i ? CAP.gap : 0), 0);
  let x = 540 - total / 2;
  const enter = ease.outBack(inv(c.start, c.start + 0.16, t), 1.6);
  const fadeOut = 1 - inv(c.end - 0.08, c.end, t);
  setFont(ctx, CAP.size, F.x);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  for (const w of c.words) {
    const cx = x + w.ww / 2;
    const active = t >= w.start - 0.03 && t < (w.end + 0.02);
    const spoken = t >= w.start - 0.03;
    const pop = active ? 1 + 0.16 * (1 - ease.outCubic(inv(w.start - 0.03, w.start + 0.15, t))) : 1;
    ctx.save();
    ctx.globalAlpha = fadeOut * clamp(enter * 1.4);
    // scale around the shared baseline so every word keeps the same baseline
    ctx.translate(cx, CAP.y);
    ctx.scale(pop * lerp(0.86, 1, enter), pop * lerp(0.86, 1, enter));
    ctx.lineWidth = 12;
    ctx.strokeStyle = 'rgba(8,10,16,0.92)';
    ctx.shadowColor = 'rgba(0,0,0,0.65)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 4;
    ctx.strokeText(w.txt, 0, 0);
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    if (active) {
      ctx.shadowColor = BRAND.blue;
      ctx.shadowBlur = 22;
    }
    ctx.fillStyle = active ? BRAND.blue : spoken ? BRAND.text : 'rgba(242,245,250,0.78)';
    ctx.fillText(w.txt, 0, 0);
    ctx.restore();
    x += w.ww + CAP.gap;
  }
}

module.exports = { layer, Background, Post, circleWipe, whipPan, camera, Shake, buildCaptions, drawCaptions, CAP };
