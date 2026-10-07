// Drawing primitives for the reel engine. Every animated primitive takes the
// global time `t` and its own start time `t0`, and draws nothing before t0.

const path = require('path');
const { createCanvas, GlobalFonts } = require('@napi-rs/canvas');
const { BRAND, clamp, lerp, inv, ease, rng } = require('./core');
const { glass, theme } = require('./glass');

const FD = path.join(__dirname, '..', 'fonts');
const F = { x: 'IDX', k: 'IDK', b: 'IDB', s: 'IDS', m: 'IDM', mono: 'JBM', monoM: 'JBMM', monoX: 'JBMX' };
GlobalFonts.registerFromPath(path.join(FD, 'InterDisplay-ExtraBold.otf'), F.x);
GlobalFonts.registerFromPath(path.join(FD, 'InterDisplay-Black.otf'), F.k);
GlobalFonts.registerFromPath(path.join(FD, 'InterDisplay-Bold.otf'), F.b);
GlobalFonts.registerFromPath(path.join(FD, 'InterDisplay-SemiBold.otf'), F.s);
GlobalFonts.registerFromPath(path.join(FD, 'InterDisplay-Medium.otf'), F.m);
GlobalFonts.registerFromPath(path.join(FD, 'JetBrainsMono-Bold.ttf'), F.mono);
GlobalFonts.registerFromPath(path.join(FD, 'JetBrainsMono-Medium.ttf'), F.monoM);
GlobalFonts.registerFromPath(path.join(FD, 'JetBrainsMono-ExtraBold.ttf'), F.monoX);

function setFont(ctx, size, fam = F.x, ls = 0) {
  ctx.font = `${size}px ${fam}`;
  ctx.letterSpacing = `${ls}px`;
}

const _m = createCanvas(8, 8).getContext('2d');
function measure(s, size, fam = F.x, ls = 0) {
  setFont(_m, size, fam, ls);
  return _m.measureText(s).width;
}

function rr(ctx, x, y, w, h, r) {
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

// ---------- polylines that draw themselves ----------

function polyline(pts) {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  }
  return { pts, cum, L: cum[cum.length - 1] };
}

function strokePartial(ctx, pl, p, from = 0) {
  if (p <= from) return null;
  const a = pl.L * from;
  const b = pl.L * clamp(p);
  const { pts, cum } = pl;
  ctx.beginPath();
  let started = false;
  let head = null;
  for (let i = 1; i < pts.length; i++) {
    if (cum[i] < a) continue;
    const s0 = cum[i - 1];
    const s1 = cum[i];
    const seg = s1 - s0 || 1;
    if (!started) {
      const u = clamp((a - s0) / seg);
      ctx.moveTo(lerp(pts[i - 1][0], pts[i][0], u), lerp(pts[i - 1][1], pts[i][1], u));
      started = true;
    }
    if (s1 <= b) {
      ctx.lineTo(pts[i][0], pts[i][1]);
      head = pts[i];
    } else {
      const u = clamp((b - s0) / seg);
      head = [lerp(pts[i - 1][0], pts[i][0], u), lerp(pts[i - 1][1], pts[i][1], u)];
      ctx.lineTo(head[0], head[1]);
      break;
    }
  }
  ctx.stroke();
  return head;
}

// Hand-drawn underline: a quick swoosh out and a shorter return stroke.
function makeScribble(x1, x2, y, seed = 1, amp = 7) {
  const r = rng(seed);
  const pts = [];
  const n = 36;
  const wob = r() * 6;
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    pts.push([lerp(x1, x2, u), y - Math.sin(u * Math.PI) * amp + Math.sin(u * 9 + wob) * 1.6 + (u - 0.5) * 6]);
  }
  const back = x1 + (x2 - x1) * (0.12 + r() * 0.1);
  for (let i = 1; i <= n; i++) {
    const u = i / n;
    pts.push([lerp(x2 - 8, back, u), y + 14 - Math.sin(u * Math.PI) * amp * 0.6 + Math.sin(u * 7 + wob) * 1.4 + u * 3]);
  }
  return polyline(pts);
}

// Hand-drawn loop around a word.
function makeCircle(cx, cy, rx, ry, seed = 1) {
  const r = rng(seed);
  const pts = [];
  const a0 = -Math.PI * (0.62 + r() * 0.1);
  const turns = 1.12;
  const n = 90;
  const ph = r() * 6;
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const a = a0 + u * Math.PI * 2 * turns;
    const k = 1 + 0.05 * Math.sin(a * 3 + ph) + u * 0.06;
    pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  return polyline(pts);
}

// Zig-zag strike-through.
function makeStrike(x1, x2, y, seed = 1, amp = 10) {
  const r = rng(seed);
  const pts = [];
  const zig = 5;
  for (let i = 0; i <= zig; i++) {
    const u = i / zig;
    pts.push([lerp(x1, x2, u) + (r() - 0.5) * 10, y + (i % 2 ? amp : -amp) + (r() - 0.5) * 4]);
  }
  return polyline(pts);
}

function drawStroke(ctx, pl, t, t0, o = {}) {
  if (t < t0) return 0;
  const p = (o.ease || ease.outCubic)(inv(t0, t0 + (o.dur ?? 0.35), t));
  ctx.save();
  ctx.strokeStyle = o.color || BRAND.blue;
  ctx.lineWidth = o.width ?? 9;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (o.glow) {
    ctx.shadowColor = o.glow;
    ctx.shadowBlur = 24;
  }
  ctx.globalAlpha *= o.alpha ?? 1;
  strokePartial(ctx, pl, p);
  ctx.restore();
  return p;
}

// ---------- kinetic text ----------

// Slam: drops in from big scale with an overshoot and a short zoom-blur trail.
function slam(ctx, s, cx, by, size, fam, color, t, t0, o = {}) {
  if (t < t0) return 0;
  const d = o.dur ?? 0.36;
  const raw = inv(t0, t0 + d, t);
  const sc = lerp(o.from ?? 2.3, 1, ease.outBack(raw, 1.7));
  const a = clamp((t - t0) / 0.06);
  const vy = by - size * 0.36;
  setFont(ctx, size, fam, o.ls || 0);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const draw = (scale, alpha) => {
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.translate(cx, vy);
    ctx.scale(scale, scale);
    if (o.rot) ctx.rotate(o.rot * (1 - ease.outCubic(raw)));
    ctx.fillStyle = color;
    ctx.fillText(s, 0, size * 0.36);
    ctx.restore();
  };
  if (raw < 0.4) for (let g = 3; g >= 1; g--) draw(sc * (1 + g * 0.09), 0.13 * (1 - raw / 0.4));
  ctx.save();
  if (o.glow) {
    ctx.shadowColor = o.glow;
    ctx.shadowBlur = o.glowBlur ?? 34;
  }
  draw(sc, a);
  ctx.restore();
  return raw;
}

// Mask-slide: rises out of an invisible slot with overshoot.
function maskUp(ctx, s, x, by, size, fam, color, t, t0, o = {}) {
  if (t < t0) return 0;
  const d = o.dur ?? 0.5;
  const raw = inv(t0, t0 + d, t);
  const p = ease.outBack(raw, 1.5);
  setFont(ctx, size, fam, o.ls || 0);
  const w = ctx.measureText(s).width;
  const align = o.align || 'center';
  const left = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  ctx.save();
  ctx.beginPath();
  ctx.rect(left - 30, by - size * 1.02, w + 60, size * 1.34);
  ctx.clip();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = color;
  if (o.glow) {
    ctx.shadowColor = o.glow;
    ctx.shadowBlur = 30;
  }
  ctx.fillText(s, left, by + (1 - p) * size * 1.2);
  ctx.restore();
  return raw;
}

// Plain text with a quick fade-up entrance.
function fadeUp(ctx, s, x, by, size, fam, color, t, t0, o = {}) {
  if (t < t0) return 0;
  const p = ease.outCubic(inv(t0, t0 + (o.dur ?? 0.35), t));
  ctx.save();
  ctx.globalAlpha *= p * (o.alpha ?? 1);
  setFont(ctx, size, fam, o.ls || 0);
  ctx.textAlign = o.align || 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = color;
  ctx.fillText(s, x, by + (1 - p) * (o.dy ?? 26));
  ctx.restore();
  return p;
}

// Box that sweeps in behind a word (left to right).
function highlight(ctx, x, y, w, h, t, t0, o = {}) {
  if (t < t0) return 0;
  const p = ease.outExpo(inv(t0, t0 + (o.dur ?? 0.38), t));
  ctx.save();
  ctx.translate(x, y + h / 2);
  ctx.rotate(o.rot ?? -0.025);
  ctx.fillStyle = o.color || BRAND.blue;
  if (o.glow !== false) {
    ctx.shadowColor = o.color || BRAND.blue;
    ctx.shadowBlur = 46 * p;
  }
  rr(ctx, 0, -h / 2, w * p, h, o.r ?? 12);
  ctx.fill();
  ctx.restore();
  return p;
}

// ---------- panels & typing ----------

// Rounded-rect perimeter starting at top-centre, clockwise.
function makePanel(x, y, w, h, r = 26) {
  const pts = [];
  const arc = (cx, cy, a0) => {
    for (let i = 0; i <= 10; i++) {
      const a = a0 + (i / 10) * (Math.PI / 2);
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
  };
  pts.push([x + w / 2, y]);
  pts.push([x + w - r, y]);
  arc(x + w - r, y + r, -Math.PI / 2);
  pts.push([x + w, y + h - r]);
  arc(x + w - r, y + h - r, 0);
  pts.push([x + r, y + h]);
  arc(x + r, y + h - r, Math.PI / 2);
  pts.push([x, y + r]);
  arc(x + r, y + r, Math.PI);
  pts.push([x + w / 2, y]);
  const half = Math.floor(pts.length / 2);
  // two strokes from top-centre meeting at the bottom
  const cw = polyline(pts.slice(0, half + 1));
  const ccw = polyline(pts.slice(half).reverse());
  return { x, y, w, h, r, cw, ccw };
}

// Border traces itself in, then the fill fades up. Returns content alpha (0..1).
function panel(ctx, P, t, t0, o = {}) {
  if (t < t0) return 0;
  const td = o.trace ?? 0.42;
  const pt = ease.inOutCubic(inv(t0, t0 + td, t));
  const pf = ease.outCubic(inv(t0 + td * 0.5, t0 + td * 0.5 + 0.3, t));
  const border = o.border || BRAND.border;
  const useGlass = theme.glass && o.glass !== false;
  ctx.save();
  if (pf > 0 && useGlass) {
    glass(ctx, P.x, P.y, P.w, P.h, P.r, {
      alpha: pf, tone: o.tone, color: o.color, t, glow: o.glow, border: o.border, lw: o.lw,
      darken: o.darken, saturate: o.saturate, refract: o.refract,
    });
  } else if (pf > 0) {
    ctx.save();
    ctx.globalAlpha *= pf * (o.fillAlpha ?? 0.94);
    if (o.glow) {
      ctx.shadowColor = o.glow;
      ctx.shadowBlur = 50;
    }
    ctx.fillStyle = o.fill || BRAND.panel;
    rr(ctx, P.x, P.y, P.w, P.h, P.r);
    ctx.fill();
    ctx.restore();
  }
  ctx.lineWidth = o.lw ?? 3;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (pt < 1) {
    ctx.strokeStyle = BRAND.blue2;
    ctx.shadowColor = BRAND.blue;
    ctx.shadowBlur = 18;
    const h1 = strokePartial(ctx, P.cw, pt);
    const h2 = strokePartial(ctx, P.ccw, pt);
    ctx.fillStyle = '#FFFFFF';
    for (const hd of [h1, h2]) {
      if (!hd) continue;
      ctx.beginPath();
      ctx.arc(hd[0], hd[1], 5, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (useGlass) {
    // glass draws its own specular edge; just fade out the trace colour
    const settle = ease.outCubic(inv(t0 + td, t0 + td + 0.35, t));
    if (settle < 1) {
      ctx.globalAlpha *= 1 - settle;
      ctx.strokeStyle = BRAND.blue2;
      rr(ctx, P.x, P.y, P.w, P.h, P.r);
      ctx.stroke();
    }
  } else {
    const settle = ease.outCubic(inv(t0 + td, t0 + td + 0.35, t));
    ctx.strokeStyle = border;
    if (o.glow) {
      ctx.shadowColor = o.glow;
      ctx.shadowBlur = 22;
    }
    rr(ctx, P.x, P.y, P.w, P.h, P.r);
    ctx.stroke();
    if (settle < 1) {
      ctx.globalAlpha *= 1 - settle;
      ctx.strokeStyle = BRAND.blue2;
      ctx.stroke();
    }
  }
  ctx.restore();
  return pf;
}

// A box that is liquid glass when the reel's theme asks for it, solid otherwise.
function box(ctx, x, y, w, h, r, t, o = {}) {
  if (theme.glass && o.glass !== false && !theme.cheap) {
    const accent = o.stroke && o.stroke !== BRAND.border ? o.stroke : undefined;
    glass(ctx, x, y, w, h, r, { tone: o.tone, color: o.color, t, alpha: o.alpha ?? 1, glow: o.glow, shadow: o.shadow, border: accent, lw: o.lw });
    return;
  }
  if (theme.glass && theme.cheap) {
    // motion-trail ghost: a plain translucent pane is enough at 12% opacity
    ctx.save();
    ctx.globalAlpha *= o.alpha ?? 1;
    ctx.fillStyle = 'rgba(140,170,220,0.25)';
    rr(ctx, x, y, w, h, r);
    ctx.fill();
    ctx.restore();
    return;
  }
  ctx.save();
  ctx.globalAlpha *= o.alpha ?? 1;
  if (o.glow) {
    ctx.shadowColor = o.glow;
    ctx.shadowBlur = 40;
  }
  ctx.fillStyle = o.fill || 'rgba(16,21,32,0.95)';
  rr(ctx, x, y, w, h, r);
  ctx.fill();
  ctx.shadowBlur = 0;
  if (o.stroke) {
    ctx.strokeStyle = o.stroke;
    ctx.lineWidth = o.lw ?? 2;
    ctx.stroke();
  }
  ctx.restore();
}

// Monospace word-wrap; returns layout that typing and word lookups share.
function makeType(str, size, fam, maxW) {
  const cw = measure('M', size, fam);
  const maxC = Math.max(4, Math.floor(maxW / cw));
  const lines = [];
  let cur = '';
  let start = 0;
  let idx = 0;
  for (const word of str.split(' ')) {
    const cand = cur ? cur + ' ' + word : word;
    if (cand.length > maxC && cur) {
      lines.push({ text: cur, start });
      start = idx;
      cur = word;
    } else cur = cand;
    idx += word.length + 1;
  }
  lines.push({ text: cur, start });
  // fix starts: each line begins after the previous line + one space
  let s = 0;
  for (const l of lines) {
    l.start = s;
    s += l.text.length + 1;
  }
  return { str, size, fam, cw, lines, n: str.length };
}

// Where a substring sits in a typed layout: {x, line, w}
function typeFind(T, sub, nth = 0) {
  let from = 0;
  let i = -1;
  for (let k = 0; k <= nth; k++) {
    i = T.str.indexOf(sub, from);
    from = i + 1;
  }
  if (i < 0) throw new Error(`"${sub}" not in typed text`);
  for (let li = T.lines.length - 1; li >= 0; li--) {
    if (i >= T.lines[li].start) return { col: i - T.lines[li].start, line: li, x: (i - T.lines[li].start) * T.cw, w: sub.length * T.cw };
  }
  return null;
}

// Typed monospace text with a blinking cursor. Returns time typing finishes.
function typing(ctx, T, x, y, lh, t, t0, cps, o = {}) {
  if (t < t0) return;
  const shown = Math.min(T.n, Math.floor((t - t0) * cps));
  const done = shown >= T.n;
  setFont(ctx, T.size, T.fam);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.save();
  ctx.globalAlpha *= o.alpha ?? 1;
  let cx = x;
  let cy = y;
  for (let li = 0; li < T.lines.length; li++) {
    const L = T.lines[li];
    const vis = clamp(shown - L.start, 0, L.text.length);
    if (vis <= 0 && li > 0 && shown < L.start) break;
    const ly = y + li * lh;
    ctx.fillStyle = o.color || BRAND.text;
    ctx.fillText(L.text.slice(0, vis), x, ly);
    if (o.marks) {
      // colour selected words once they are typed
      for (const m of o.marks) {
        if (m.line !== li || m.col >= vis) continue;
        if (m.t0 !== undefined && t < m.t0) continue;
        ctx.fillStyle = m.color;
        ctx.fillText(L.text.slice(m.col, Math.min(vis, m.col + m.len)), x + m.col * T.cw, ly);
      }
    }
    cx = x + vis * T.cw;
    cy = ly;
  }
  ctx.restore();
  const blinkOn = !done || Math.floor((t - t0) * 2.4) % 2 === 0;
  if (blinkOn && !(o.hideCursorAfter && t > o.hideCursorAfter)) {
    ctx.save();
    ctx.fillStyle = o.cursor || BRAND.blue;
    ctx.shadowColor = BRAND.blue;
    ctx.shadowBlur = 12;
    ctx.fillRect(cx + 3, cy - T.size * 0.82, Math.max(4, T.size * 0.12), T.size * 1.02);
    ctx.restore();
  }
}

// Proportional-font word wrap.
function wrap(str, size, fam, maxW, ls = 0) {
  const space = measure(' ', size, fam, ls);
  const lines = [];
  let cur = [];
  let w = 0;
  for (const word of str.split(' ')) {
    const ww = measure(word, size, fam, ls);
    if (cur.length && w + space + ww > maxW) {
      lines.push(cur);
      cur = [];
      w = 0;
    }
    cur.push({ w: word, width: ww, x: cur.length ? w + space : 0 });
    w = cur.length > 1 ? w + space + ww : ww;
  }
  if (cur.length) lines.push(cur);
  return lines.map((ws) => ({ words: ws, width: ws.length ? ws[ws.length - 1].x + ws[ws.length - 1].width : 0 }));
}

// Paragraph whose words fade up one after another.
function paragraph(ctx, lines, x, y, lh, size, fam, color, t, t0, perWord = 0.035, o = {}) {
  if (t < t0) return;
  setFont(ctx, size, fam, o.ls || 0);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  let k = 0;
  for (let li = 0; li < lines.length; li++) {
    const L = lines[li];
    const ox = o.align === 'center' ? x - L.width / 2 : x;
    for (const wd of L.words) {
      const p = ease.outCubic(inv(t0 + k * perWord, t0 + k * perWord + 0.3, t));
      k++;
      if (p <= 0) continue;
      ctx.save();
      ctx.globalAlpha *= p * (o.alpha ?? 1);
      ctx.fillStyle = (o.colorOf && o.colorOf(wd.w)) || color;
      ctx.fillText(wd.w, ox + wd.x, y + li * lh + (1 - p) * 18);
      ctx.restore();
    }
  }
}

// ---------- numbers, logo, chips ----------

// Odometer roll between two equal-length digit strings. Returns tick times via ticksOf().
function odoSteps(from, to, spins = 1) {
  return [...to].map((d, i) => {
    const fd = +from[i];
    let steps = (+d - fd + 10) % 10;
    if (steps > 0) steps += 10 * spins;
    return { fd, steps };
  });
}

function odometer(ctx, from, to, x, by, size, fam, color, t, t0, dur, o = {}) {
  const cols = odoSteps(from, to, o.spins ?? 1);
  setFont(ctx, size, fam);
  const cw = measure('0', size, fam) * 1.02;
  const lh = size * 1.0;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const totalW = cw * cols.length;
  let left = o.align === 'left' ? x : x - totalW / 2;
  cols.forEach((c, i) => {
    const raw = inv(t0 + i * 0.05, t0 + i * 0.05 + dur, t);
    const pos = c.fd + c.steps * ease.outBack(raw, 0.9);
    const cx = left + cw * (i + 0.5);
    ctx.save();
    ctx.beginPath();
    ctx.rect(cx - cw / 2 - 4, by - size * 0.86, cw + 8, size * 0.98);
    ctx.clip();
    ctx.fillStyle = color;
    if (o.glow) {
      ctx.shadowColor = o.glow;
      ctx.shadowBlur = 30;
    }
    const speed = raw > 0 && raw < 1 ? c.steps / dur : 0;
    if (speed > 8) ctx.filter = `blur(${Math.min(6, speed / 10)}px)`;
    const base = Math.floor(pos);
    for (let k = base - 1; k <= base + 1; k++) {
      ctx.fillText(String(((k % 10) + 10) % 10), cx, by + (k - pos) * lh);
    }
    ctx.restore();
  });
  return totalW;
}

// Times at which the odometer passes a digit (for tick SFX).
function odoTicks(from, to, t0, dur, spins = 1) {
  const cols = odoSteps(from, to, spins);
  const out = [];
  cols.forEach((c, i) => {
    let last = c.fd;
    for (let f = 0; f <= 1.0001; f += 0.002) {
      const pos = Math.floor(c.fd + c.steps * ease.outBack(f, 0.9));
      if (pos !== last) {
        out.push(t0 + i * 0.05 + f * dur);
        last = pos;
      }
    }
  });
  return out.sort((a, b) => a - b);
}

// Original mark: blue rounded tile, dark ">" chevron, white blinking "_" cursor.
function logo(ctx, cx, cy, s, t, o = {}) {
  ctx.save();
  ctx.translate(cx, cy);
  if (o.rot) ctx.rotate(o.rot);
  const g = ctx.createLinearGradient(0, -s / 2, 0, s / 2);
  g.addColorStop(0, '#5C9BFF');
  g.addColorStop(1, '#2C6FF0');
  if (o.glow !== false) {
    ctx.shadowColor = BRAND.blue;
    ctx.shadowBlur = s * 0.45;
  }
  ctx.fillStyle = g;
  rr(ctx, -s / 2, -s / 2, s, s, s * 0.26);
  ctx.fill();
  ctx.shadowBlur = 0;
  // top sheen
  ctx.save();
  rr(ctx, -s / 2, -s / 2, s, s, s * 0.26);
  ctx.clip();
  const sh = ctx.createLinearGradient(0, -s / 2, 0, 0);
  sh.addColorStop(0, 'rgba(255,255,255,0.28)');
  sh.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sh;
  ctx.fillRect(-s / 2, -s / 2, s, s / 2);
  ctx.restore();
  ctx.strokeStyle = BRAND.bg;
  ctx.lineWidth = s * 0.12;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(-s * 0.25, -s * 0.18);
  ctx.lineTo(-s * 0.05, 0);
  ctx.lineTo(-s * 0.25, s * 0.18);
  ctx.stroke();
  const on = o.blink === false || Math.floor(t / 0.5) % 2 === 0;
  if (on) {
    ctx.fillStyle = BRAND.text;
    rr(ctx, s * 0.04, s * 0.12, s * 0.24, s * 0.08, s * 0.02);
    ctx.fill();
  }
  ctx.restore();
}

// Small logo + "DAY XX" chip, centred at the top of every frame.
function dayChip(ctx, day, t, cx = 540, cy = 222) {
  const size = 31;
  const label = 'DAY ';
  const lw = measure(label, size, F.x, 2);
  const dw = measure(day, size, F.x, 2);
  const tile = 40;
  const h = 64;
  const w = 12 + tile + 16 + lw + dw + 26;
  const x = cx - w / 2;
  ctx.save();
  if (theme.glass) {
    glass(ctx, x, cy - h / 2, w, h, h / 2, { t, color: 'blue', shadow: false });
  } else {
    ctx.fillStyle = 'rgba(16,21,32,0.86)';
    ctx.strokeStyle = BRAND.border;
    ctx.lineWidth = 2;
    rr(ctx, x, cy - h / 2, w, h, h / 2);
    ctx.fill();
    ctx.stroke();
  }
  logo(ctx, x + 12 + tile / 2, cy, tile, t, { glow: false });
  setFont(ctx, size, F.x, 2);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = BRAND.text;
  const ty = cy + size * 0.36;
  ctx.fillText(label, x + 12 + tile + 16, ty);
  ctx.fillStyle = BRAND.blue;
  ctx.fillText(day, x + 12 + tile + 16 + lw, ty);
  ctx.restore();
}

// Small uppercase label pill.
function pill(ctx, label, cx, cy, t, t0, o = {}) {
  if (t < t0) return 0;
  const p = ease.outBack(inv(t0, t0 + 0.4, t), 1.4);
  const a = clamp((t - t0) / 0.15);
  const size = o.size ?? 26;
  const ls = o.ls ?? 4;
  const tw = measure(label, size, F.x, ls);
  const dot = o.dot ? 22 : 0;
  const h = size * 2.1;
  const w = tw + 48 + dot;
  ctx.save();
  ctx.globalAlpha *= a;
  ctx.translate(cx, cy + (1 - p) * 30);
  ctx.fillStyle = o.bg || 'rgba(56,132,255,0.14)';
  ctx.strokeStyle = o.border || 'rgba(56,132,255,0.55)';
  ctx.lineWidth = 2;
  rr(ctx, -w / 2, -h / 2, w, h, h / 2);
  ctx.fill();
  ctx.stroke();
  if (o.dot) {
    ctx.fillStyle = o.dot;
    ctx.shadowColor = o.dot;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(-w / 2 + 24 + 5, 0, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
  setFont(ctx, size, F.x, ls);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = o.color || BRAND.blue2;
  ctx.fillText(label, -w / 2 + 24 + dot, size * 0.36);
  ctx.restore();
  return p;
}

// ---------- particles & ornaments ----------

function burst(ctx, x, y, t, t0, o = {}) {
  const life = o.life ?? 0.7;
  if (t < t0 || t > t0 + life) return;
  const tau = t - t0;
  const r = rng(o.seed ?? 7);
  const n = o.n ?? 26;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2;
    const v = (o.speed ?? 900) * (0.35 + r() * 0.65);
    const k = 5;
    const d = (v * (1 - Math.exp(-k * tau))) / k;
    const sz = (2 + r() * 5) * (1 - tau / life);
    const col = [BRAND.blue, BRAND.blue2, '#FFFFFF'][Math.floor(r() * 3)];
    ctx.globalAlpha = Math.pow(1 - tau / life, 1.3);
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, Math.max(0.5, sz), 0, Math.PI * 2);
    ctx.fill();
  }
  // shock ring
  const rp = ease.outCubic(clamp(tau / 0.45));
  ctx.globalAlpha = (1 - rp) * 0.8;
  ctx.strokeStyle = BRAND.blue2;
  ctx.lineWidth = 4 * (1 - rp) + 1;
  ctx.beginPath();
  ctx.arc(x, y, lerp(o.r0 ?? 20, o.r1 ?? 170, rp), 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function star(ctx, x, y, r) {
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.quadraticCurveTo(x, y, x, y + r);
  ctx.quadraticCurveTo(x, y, x - r, y);
  ctx.quadraticCurveTo(x, y, x, y - r);
  ctx.fill();
}

// Twinkling 4-point stars for success moments.
function sparkles(ctx, x, y, t, t0, o = {}) {
  const r = rng(o.seed ?? 11);
  const n = o.n ?? 7;
  const R = o.R ?? 120;
  ctx.save();
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2;
    const d = R * (0.5 + r() * 0.6);
    const delay = r() * 0.35;
    const life = 0.55 + r() * 0.3;
    const tau = t - t0 - delay;
    if (tau < 0 || tau > life) continue;
    const p = tau / life;
    const s = Math.sin(p * Math.PI) * (10 + r() * 14);
    ctx.globalAlpha = Math.sin(p * Math.PI);
    ctx.fillStyle = i % 2 ? '#FFFFFF' : BRAND.blue2;
    ctx.shadowColor = BRAND.blue;
    ctx.shadowBlur = 16;
    star(ctx, x + Math.cos(a) * d, y + Math.sin(a) * d * 0.7, s);
  }
  ctx.restore();
}

function dashedRing(ctx, cx, cy, r, t, o = {}) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(t * (o.speed ?? 0.6) + (o.phase ?? 0));
  ctx.setLineDash(o.dash || [16, 14]);
  ctx.lineWidth = o.width ?? 3;
  ctx.strokeStyle = o.color || BRAND.blue;
  ctx.globalAlpha *= o.alpha ?? 0.6;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

const qbez = (a, c, b, u) => [
  (1 - u) * (1 - u) * a[0] + 2 * (1 - u) * u * c[0] + u * u * b[0],
  (1 - u) * (1 - u) * a[1] + 2 * (1 - u) * u * c[1] + u * u * b[1],
];

// Something flying along a curve, spinning as it lands.
function fly(ctx, t, t0, dur, from, ctrl, to, spin, drawFn) {
  if (t < t0) return 0;
  const raw = inv(t0, t0 + dur, t);
  const p = ease.outCubic(raw);
  const rot = spin * (1 - ease.outBack(raw, 1.3));
  const sc = lerp(0.45, 1, ease.outBack(raw, 1.6));
  if (raw < 1) {
    for (let g = 1; g <= 3; g++) {
      const pg = ease.outCubic(clamp(raw - g * 0.05));
      const [gx, gy] = qbez(from, ctrl, to, pg);
      ctx.save();
      ctx.globalAlpha *= 0.12 * (1 - raw);
      ctx.translate(gx, gy);
      ctx.rotate(spin * (1 - ease.outBack(clamp(raw - g * 0.05), 1.3)));
      ctx.scale(sc, sc);
      theme.cheap = true;
      drawFn(ctx);
      theme.cheap = false;
      ctx.restore();
    }
  }
  const [x, y] = qbez(from, ctrl, to, p);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(sc, sc);
  drawFn(ctx);
  ctx.restore();
  return raw;
}

function arrow(ctx, x, y, s, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = s * 0.16;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x - s * 0.5, y);
  ctx.lineTo(x + s * 0.45, y);
  ctx.moveTo(x + s * 0.1, y - s * 0.36);
  ctx.lineTo(x + s * 0.47, y);
  ctx.lineTo(x + s * 0.1, y + s * 0.36);
  ctx.stroke();
  ctx.restore();
}

function check(ctx, x, y, s, color, p = 1) {
  const pl = polyline([
    [x - s * 0.42, y + s * 0.02],
    [x - s * 0.12, y + s * 0.32],
    [x + s * 0.45, y - s * 0.3],
  ]);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = s * 0.18;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  strokePartial(ctx, pl, p);
  ctx.restore();
}

// Pulsing call-to-action button with expanding rings.
function ctaButton(ctx, label, cx, cy, w, h, t, t0, o = {}) {
  if (t < t0) return;
  const pin = ease.outBack(inv(t0, t0 + 0.5, t), 1.8);
  const live = t - t0;
  const pulse = 1 + 0.04 * Math.sin(live * Math.PI * 2 * 1.5) * clamp((live - 0.5) * 3);
  ctx.save();
  ctx.translate(cx, cy);
  // rings
  for (let k = 0; k < 2; k++) {
    const ph = (live - 0.4 - k * 0.5) % 1.0;
    if (live - 0.4 - k * 0.5 < 0) continue;
    const rp = ease.outCubic(ph);
    ctx.save();
    ctx.globalAlpha = (1 - rp) * 0.7;
    ctx.strokeStyle = BRAND.blue;
    ctx.lineWidth = 3;
    const ew = w + rp * 90;
    const eh = h + rp * 60;
    rr(ctx, -ew / 2, -eh / 2, ew, eh, eh / 2);
    ctx.stroke();
    ctx.restore();
  }
  ctx.scale(pin * pulse, pin * pulse);
  const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
  g.addColorStop(0, '#5C9BFF');
  g.addColorStop(1, '#2C6FF0');
  ctx.shadowColor = BRAND.blue;
  ctx.shadowBlur = 50;
  ctx.fillStyle = g;
  rr(ctx, -w / 2, -h / 2, w, h, h / 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  const size = o.size ?? 42;
  const aw = size * 0.9;
  const tw = measure(label, size, F.x);
  const total = tw + 22 + aw;
  setFont(ctx, size, F.x);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(label, -total / 2, size * 0.36);
  const nudge = Math.max(0, Math.sin(live * Math.PI * 2 * 1.5)) * 8;
  arrow(ctx, -total / 2 + tw + 22 + aw / 2 + nudge, 0, aw, '#FFFFFF');
  ctx.restore();
}

module.exports = {
  F, setFont, measure, rr, polyline, strokePartial,
  makeScribble, makeCircle, makeStrike, drawStroke,
  slam, maskUp, fadeUp, highlight,
  makePanel, panel, box, theme, makeType, typeFind, typing, wrap, paragraph,
  odometer, odoTicks, logo, dayChip, pill,
  burst, sparkles, dashedRing, fly, qbez, arrow, check, ctaButton, star,
};
