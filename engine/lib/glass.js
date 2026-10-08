// Liquid-glass material (iOS 26 style) for panels, cards and chips.
//
// What makes it read as glass, in draw order:
//   1. a faint brand-blue under-glow outside the shape (depth on a near-black brand)
//   2. the backdrop, resampled into the panel's own space (so camera scale and
//      rotation are respected), lightly blurred
//   3. lens refraction at the rim: pixels near the edge sample from further out,
//      from a sharper copy, with a slight per-channel split
//   4. a light tint + frost, and a soft top sheen
//   5. a conic specular rim: bright where the light hits (top-left) and on the
//      opposite corner, dark on the unlit sides, plus a broad bevel catch-light

const { createCanvas, ImageData } = require('@napi-rs/canvas');
const { RES } = require('./core');

// sat: how much colour the backdrop keeps under this tint (low for red, so the
// blue background glow doesn't turn it purple); alpha: tint strength.
const TINTS = {
  blue: { rgb: [56, 132, 255], rim: [190, 220, 255], sat: 130, alpha: 0.11 },
  red: { rgb: [255, 92, 108], rim: [255, 205, 210], sat: 35, alpha: 0.26 },
  neutral: { rgb: [170, 185, 215], rim: [240, 245, 255], sat: 110, alpha: 0.05 },
  // clear blue glass: barely frosted, deep lens edge, blue at the edges (fresnel), glare streak
  clear: {
    rgb: [70, 150, 255], rim: [205, 230, 255], sat: 150, alpha: 0.05,
    blur: 2.5, blurSmall: 1.5, darken: 0.03, frost: 0, bevel: 54, refract: 1.1,
    fresnel: 0.45, glare: 2.4, peak: 1,
  },
  // Apple-style liquid glass: see-through, magnifying lens, hard bend at the rim, bright specular
  liquid: {
    rgb: [80, 155, 255], rim: [215, 235, 255], sat: 145, alpha: 0.035,
    blur: 1, blurSmall: 0.6, darken: 0, frost: 0.015, bevel: 64, refract: 0.38,
    fresnel: 0.3, glare: 2.6, peak: 1, magnify: 1.06, specular: 1,
  },
};

// Global look, set per reel: 'blue' | 'red' | 'mixed' | null (solid panels).
// under: background canvas when scenes draw on a transparent layer (transitions).
// cheap: set while drawing motion-trail ghosts, which skip the full material.
const theme = { glass: null, under: null, cheap: false };

function toneColor(tone) {
  const mode = theme.glass;
  if (mode === 'blue' || mode === 'red' || mode === 'clear' || mode === 'liquid') return mode;
  // mixed: clear glass for neutral UI, red only on "wrong" examples, blue otherwise
  if (tone === 'bad') return 'red';
  if (tone === 'neutral') return 'neutral';
  return 'blue';
}

// ---------- caches ----------
const scratch = new Map();
function canvasFor(key, w, h) {
  const k = `${key}:${w}x${h}`;
  let c = scratch.get(k);
  if (!c) {
    c = createCanvas(w, h);
    scratch.set(k, c);
  }
  return c;
}

function sdRoundRect(px, py, hw, hh, r) {
  const qx = Math.abs(px) - (hw - r);
  const qy = Math.abs(py) - (hh - r);
  const ox = Math.max(qx, 0);
  const oy = Math.max(qy, 0);
  return Math.hypot(ox, oy) + Math.min(Math.max(qx, qy), 0) - r;
}

// Per-size refraction map: where each rim pixel samples from (offset, pointing
// outward) and how much it uses the sharp backdrop instead of the blurred one.
const maps = new Map();
function refractionMap(w, h, r, bevel, strength, m) {
  const key = `${w}|${h}|${r}|${bevel}|${strength}|${m}`;
  let M = maps.get(key);
  if (M) return M;
  const W2 = w + 2 * m;
  const H2 = h + 2 * m;
  const dx = new Float32Array(W2 * H2);
  const dy = new Float32Array(W2 * H2);
  const sharp = new Float32Array(W2 * H2);
  const idx = [];
  const hw = w / 2;
  const hh = h / 2;
  for (let v = 0; v < H2; v++) {
    const py = v + 0.5 - m - hh;
    for (let u = 0; u < W2; u++) {
      const px = u + 0.5 - m - hw;
      const sd = sdRoundRect(px, py, hw, hh, r);
      const depth = -sd;
      if (depth < -1 || depth > bevel) continue;
      const nx = sdRoundRect(px + 1, py, hw, hh, r) - sdRoundRect(px - 1, py, hw, hh, r);
      const ny = sdRoundRect(px, py + 1, hw, hh, r) - sdRoundRect(px, py - 1, hw, hh, r);
      const nl = Math.hypot(nx, ny) || 1;
      const k = 1 - Math.max(0, depth) / bevel; // 1 at the edge, 0 where the bevel ends
      const mag = strength * bevel * Math.pow(k, 1.7); // convex bevel: bends hardest at the rim
      const i = v * W2 + u;
      dx[i] = (nx / nl) * mag;
      dy[i] = (ny / nl) * mag;
      sharp[i] = Math.pow(k, 0.8);
      idx.push(i);
    }
  }
  M = { W2, H2, dx, dy, sharp, idx: Int32Array.from(idx) };
  maps.set(key, M);
  return M;
}

function rrPath(ctx, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

// Conic gradient for the rim: lit at `ang` and at the opposite corner, dark at 90 degrees.
function rimGradient(ctx, ang, cx, cy, rim, peak = 0.95) {
  const [r, g, b] = rim;
  const g1 = ctx.createConicGradient(ang, cx, cy);
  g1.addColorStop(0, `rgba(255,255,255,${peak})`);
  g1.addColorStop(0.12, `rgba(${r},${g},${b},0.28)`);
  g1.addColorStop(0.25, `rgba(${r},${g},${b},0.04)`);
  g1.addColorStop(0.38, `rgba(${r},${g},${b},0.22)`);
  g1.addColorStop(0.5, `rgba(255,255,255,${peak * 0.6})`);
  g1.addColorStop(0.62, `rgba(${r},${g},${b},0.22)`);
  g1.addColorStop(0.75, `rgba(${r},${g},${b},0.04)`);
  g1.addColorStop(0.88, `rgba(${r},${g},${b},0.28)`);
  g1.addColorStop(1, `rgba(255,255,255,${peak})`);
  return g1;
}

// Draw a liquid-glass rounded rectangle at (x, y, w, h) in the current transform.
function glass(ctx, x, y, w, h, r, o = {}) {
  const alpha = o.alpha ?? 1;
  if (alpha <= 0.002) return;
  const tint = TINTS[o.color || toneColor(o.tone)];
  const [tr, tg, tb] = tint.rgb;
  w = Math.round(w);
  h = Math.round(h);
  const small = Math.min(w, h) < 140;
  const bevel = o.bevel ?? Math.round(Math.min(small ? 18 : tint.bevel ?? 40, Math.min(w, h) / 3));
  const strength = o.refract ?? tint.refract ?? 0.95;
  const blur = o.blur ?? (small ? tint.blurSmall ?? 4 : tint.blur ?? 7);
  const m = Math.ceil(bevel * strength) + 6;
  const t = o.t ?? 0;
  // the pixel work happens at output resolution (k px per scene unit)
  const k = RES.s;
  const W2 = (w + 2 * m) * k;
  const H2 = (h + 2 * m) * k;

  // 1. backdrop -> panel space (inverse of the current transform): blurred + sharp copies
  const T = ctx.getTransform();
  const det = T.a * T.d - T.b * T.c || 1;
  const ia = T.d / det;
  const ib = -T.b / det;
  const ic = -T.c / det;
  const id = T.a / det;
  const ie = (T.c * T.f - T.d * T.e) / det;
  const iff = (T.b * T.e - T.a * T.f) / det;
  const filt = `saturate(${o.saturate ?? tint.sat}%) brightness(${o.brightness ?? 102}%)`;
  const B = canvasFor('back', W2, H2);
  const S2 = canvasFor('sharp', W2, H2);
  const bx = B.getContext('2d');
  const sx = S2.getContext('2d');
  for (const [c2, bl] of [[bx, blur], [sx, small ? 1 : 1.5]]) {
    c2.setTransform(1, 0, 0, 1, 0, 0);
    c2.filter = 'none';
    c2.globalAlpha = 1;
    c2.fillStyle = '#080A10';
    c2.fillRect(0, 0, W2, H2);
    // optional lens magnification about the pane's centre
    const mg = o.magnify ?? tint.magnify ?? 1;
    const lcx = (w / 2 + m) * k;
    const lcy = (h / 2 + m) * k;
    c2.setTransform(
      mg * k * ia, mg * k * ib, mg * k * ic, mg * k * id,
      mg * (k * (ie - (x - m)) - lcx) + lcx, mg * (k * (iff - (y - m)) - lcy) + lcy,
    );
    c2.filter = `blur(${bl}px) ${filt}`;
    if (theme.under && theme.under !== ctx.canvas) c2.drawImage(theme.under, 0, 0);
    c2.drawImage(ctx.canvas, 0, 0);
    c2.filter = 'none';
    c2.setTransform(1, 0, 0, 1, 0, 0);
  }

  // 2. refraction at the rim, with a small per-channel split
  const map = refractionMap(w * k, h * k, r * k, bevel * k, strength, m * k);
  const s = bx.getImageData(0, 0, W2, H2).data;
  const sh = sx.getImageData(0, 0, W2, H2).data;
  const out = new Uint8ClampedArray(s);
  const disp = [1.0, 0.96, 0.92];
  for (let n = 0; n < map.idx.length; n++) {
    const i = map.idx[n];
    const u = i % W2;
    const v = (i - u) / W2;
    const k = map.sharp[i];
    for (let c = 0; c < 3; c++) {
      let fx = u + map.dx[i] * disp[c];
      let fy = v + map.dy[i] * disp[c];
      fx = fx < 0 ? 0 : fx > W2 - 1.001 ? W2 - 1.001 : fx;
      fy = fy < 0 ? 0 : fy > H2 - 1.001 ? H2 - 1.001 : fy;
      const x0 = fx | 0;
      const y0 = fy | 0;
      const wx = fx - x0;
      const wy = fy - y0;
      const p00 = (y0 * W2 + x0) * 4 + c;
      const p10 = p00 + 4;
      const p01 = p00 + W2 * 4;
      const p11 = p01 + 4;
      const soft = (s[p00] * (1 - wx) + s[p10] * wx) * (1 - wy) + (s[p01] * (1 - wx) + s[p11] * wx) * wy;
      const hard = (sh[p00] * (1 - wx) + sh[p10] * wx) * (1 - wy) + (sh[p01] * (1 - wx) + sh[p11] * wx) * wy;
      out[i * 4 + c] = soft + (hard - soft) * k;
    }
  }
  const G = canvasFor('glass', W2, H2);
  G.getContext('2d').putImageData(new ImageData(out, W2, H2), 0, 0);

  ctx.save();
  ctx.globalAlpha *= alpha;

  // 0. under-glow, only outside the shape (the fill is clipped away; only its shadow shows)
  if (o.shadow !== false) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x - 400, y - 400, w + 800, h + 800);
    ctx.moveTo(x + r, y);
    ctx.arcTo(x, y, x, y + r, r);
    ctx.lineTo(x, y + h - r);
    ctx.arcTo(x, y + h, x + r, y + h, r);
    ctx.lineTo(x + w - r, y + h);
    ctx.arcTo(x + w, y + h, x + w, y + h - r, r);
    ctx.lineTo(x + w, y + r);
    ctx.arcTo(x + w, y, x + w - r, y, r);
    ctx.closePath();
    ctx.clip('evenodd');
    ctx.shadowColor = o.glow || 'rgba(56,132,255,0.16)';
    ctx.shadowBlur = o.glow ? 50 : small ? 16 : 40;
    ctx.shadowOffsetY = o.glow ? 0 : small ? 4 : 14;
    ctx.fillStyle = '#000';
    rrPath(ctx, x, y, w, h, r);
    ctx.fill();
    ctx.restore();
  }

  ctx.save();
  rrPath(ctx, x, y, w, h, r);
  ctx.clip();
  ctx.drawImage(G, x - m, y - m, w + 2 * m, h + 2 * m);

  // 3. light tint + frost (keeps the pane clear, lifts it off the black)
  const ta = o.tintAlpha ?? tint.alpha;
  const tg1 = ctx.createLinearGradient(x, y, x, y + h);
  tg1.addColorStop(0, `rgba(${tr},${tg},${tb},${ta * 0.95})`);
  tg1.addColorStop(1, `rgba(${tr},${tg},${tb},${ta * 0.75})`);
  ctx.fillStyle = tg1;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = `rgba(255,255,255,${tint.frost ?? 0.03})`;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = `rgba(8,10,16,${o.darken ?? tint.darken ?? (small ? 0.12 : 0.16)})`;
  ctx.fillRect(x, y, w, h);
  if (tint.fresnel) {
    // thick glass looks deeper in colour toward its edges and clear in the middle
    ctx.save();
    ctx.filter = `blur(${small ? 6 : 14}px)`;
    ctx.strokeStyle = `rgba(${tr},${tg},${tb},${tint.fresnel})`;
    ctx.lineWidth = small ? 16 : 44;
    rrPath(ctx, x, y, w, h, r);
    ctx.stroke();
    ctx.restore();
  }
  if (tint.glare) {
    // a soft diagonal reflection streak that slides slowly with the light
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const drift = Math.sin(t * 0.5) * 0.06;
    const gl = ctx.createLinearGradient(x, y, x + w, y + h * 0.9);
    const a0 = 0.2 + drift;
    gl.addColorStop(0, 'rgba(255,255,255,0)');
    gl.addColorStop(Math.max(0, a0 - 0.06), 'rgba(255,255,255,0)');
    gl.addColorStop(a0, `rgba(220,235,255,${0.07 * tint.glare})`);
    gl.addColorStop(a0 + 0.05, 'rgba(255,255,255,0)');
    gl.addColorStop(a0 + 0.09, `rgba(220,235,255,${0.035 * tint.glare})`);
    gl.addColorStop(a0 + 0.12, 'rgba(255,255,255,0)');
    gl.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gl;
    ctx.fillRect(x, y, w, h);
    ctx.restore();
  }
  const sheen = ctx.createLinearGradient(x, y, x, y + Math.min(h, 220));
  sheen.addColorStop(0, 'rgba(255,255,255,0.05)');
  sheen.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sheen;
  ctx.fillRect(x, y, w, h);

  // 4. broad bevel catch-light, following the light direction
  const ang = -2.36 + Math.sin(t * 0.7) * 0.35; // light from the top-left, drifting slowly
  const cx = x + w / 2;
  const cy = y + h / 2;
  ctx.filter = `blur(${small ? 2 : 4}px)`;
  ctx.globalAlpha *= 0.4;
  ctx.strokeStyle = rimGradient(ctx, ang, cx, cy, tint.rim, 0.9);
  ctx.lineWidth = small ? 6 : 12;
  rrPath(ctx, x, y, w, h, r);
  ctx.stroke();
  ctx.filter = 'none';
  ctx.restore();

  // 5. crisp specular rim
  ctx.strokeStyle = rimGradient(ctx, ang, cx, cy, tint.rim, tint.peak ?? 0.95);
  ctx.lineWidth = small ? 2 : tint.peak ? 3.5 : 3;
  rrPath(ctx, x + 1, y + 1, w - 2, h - 2, Math.max(0, r - 1));
  ctx.stroke();
  if (tint.specular) {
    // second, inset highlight: the light catching the inner face of a thick rounded edge
    const ins = small ? 3 : 7;
    ctx.save();
    ctx.filter = `blur(${small ? 0.8 : 1.6}px)`;
    ctx.globalAlpha *= 0.75 * tint.specular;
    ctx.strokeStyle = rimGradient(ctx, ang, cx, cy, tint.rim, 1);
    ctx.lineWidth = small ? 1.5 : 2.5;
    rrPath(ctx, x + ins, y + ins, w - 2 * ins, h - 2 * ins, Math.max(0, r - ins));
    ctx.stroke();
    ctx.restore();
  }
  if (o.border) {
    ctx.strokeStyle = o.border;
    ctx.lineWidth = o.lw ?? 2;
    ctx.globalAlpha *= 0.85;
    rrPath(ctx, x, y, w, h, r);
    ctx.stroke();
  }
  ctx.restore();
}

module.exports = { glass, theme, toneColor, TINTS };
