// Browser side of the reel engine.
//
// A reel page calls boot(build). build() lays out the DOM once and returns
// { render(t), events }. render(t) must be a pure function of time so every
// frame can be rendered independently: no CSS transitions, no timers.
//
// Opened in a normal browser the page plays itself with the voiceover and a
// scrub bar (preview mode). The renderer (engine/render.mjs) instead drives
// window.REEL.render(t) frame by frame.

export const W = 1080;
export const H = 1920;
export const TAU = Math.PI * 2;

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, k) => a + (b - a) * k;
export const prog = (t, start, dur) => clamp((t - start) / dur);

export const ease = {
  linear: (k) => k,
  inCubic: (k) => k * k * k,
  outCubic: (k) => 1 - Math.pow(1 - k, 3),
  inOutCubic: (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2),
  outQuint: (k) => 1 - Math.pow(1 - k, 5),
  outExpo: (k) => (k === 1 ? 1 : 1 - Math.pow(2, -10 * k)),
  outBack: (k) => 1 + 2.4 * Math.pow(k - 1, 3) + 1.4 * Math.pow(k - 1, 2),
};

// 0 -> 1 over [start, start+inDur], holds, then 1 -> 0 ending at `end`.
export function windowed(t, start, end, inDur = 0.35, outDur = 0.3) {
  if (t < start || t > end) return 0;
  return Math.min(ease.outCubic(prog(t, start, inDur)), 1 - ease.inCubic(prog(t, end - outDur, outDur)));
}

export function el(tag, className, parent, html) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (html !== undefined) node.innerHTML = html;
  if (parent) parent.appendChild(node);
  return node;
}

// Absolute transform + opacity in one call. Values default to identity.
export function place(node, { x = 0, y = 0, s = 1, sx, sy, r = 0, o = 1, blur = 0 } = {}) {
  node.style.transform = `translate(${x}px, ${y}px) scale(${sx ?? s}, ${sy ?? s}) rotate(${r}deg)`;
  node.style.opacity = o;
  node.style.filter = blur > 0.05 ? `blur(${blur}px)` : "none";
}

// Show or hide a whole subtree. (visibility can't do this: a child set to
// visible still shows inside a hidden parent.)
export function shown(node, on) {
  node.style.display = on ? "" : "none";
  return on;
}

export function escapeHtml(s) {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}

const normWord = (w) => w.toLowerCase().replace(/[^a-z0-9]/g, "");

// Timing lookups over timing.json (produced by engine/align.py).
export class Timing {
  constructor(data) {
    Object.assign(this, data);
  }
  seg(i) {
    return this.segments[i];
  }
  // First word in segment `seg` whose text starts with `query` (case/punctuation-insensitive).
  word(seg, query, nth = 0) {
    const q = normWord(query);
    const hits = this.words.filter((w) => w.seg === seg && normWord(w.text).startsWith(q));
    if (!hits[nth]) throw new Error(`timing: no word "${query}" #${nth} in segment ${seg}`);
    return hits[nth];
  }
  // Start time of a word, safe to call with a fallback when the script changes.
  at(seg, query, nth = 0, fallback = null) {
    try {
      return this.word(seg, query, nth).start;
    } catch (e) {
      if (fallback !== null) return fallback;
      throw e;
    }
  }
}

// Dot grid drawn on a full-frame canvas. intensity(x, y, col, row) -> 0..1.
export class DotGrid {
  constructor(parent, { gap = 54, radius = 3.2 } = {}) {
    this.canvas = el("canvas", "abs", parent);
    this.canvas.width = W;
    this.canvas.height = H;
    this.canvas.style.left = "0";
    this.canvas.style.top = "0";
    this.ctx = this.canvas.getContext("2d");
    this.gap = gap;
    this.radius = radius;
    this.cols = Math.ceil(W / gap) + 1;
    this.rows = Math.ceil(H / gap) + 1;
    this.ox = (W - (this.cols - 1) * gap) / 2;
    this.oy = (H - (this.rows - 1) * gap) / 2;
  }
  draw(intensity) {
    const { ctx, gap, radius } = this;
    ctx.clearRect(0, 0, W, H);
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        const x = this.ox + col * gap;
        const y = this.oy + row * gap;
        const v = clamp(intensity(x, y, col, row));
        if (v < 0.02) continue;
        // Faint dots are grey-blue; lit dots turn electric blue and grow a halo.
        if (v > 0.45) {
          ctx.fillStyle = `rgba(56,132,255,${(v - 0.45) * 0.35})`;
          ctx.beginPath();
          ctx.arc(x, y, radius * (2.2 + 2.5 * v), 0, TAU);
          ctx.fill();
        }
        const mix = clamp((v - 0.2) / 0.6);
        const r = Math.round(lerp(70, 56, mix));
        const g = Math.round(lerp(84, 132, mix));
        const b = Math.round(lerp(110, 255, mix));
        ctx.fillStyle = `rgba(${r},${g},${b},${0.25 + 0.75 * v})`;
        ctx.beginPath();
        ctx.arc(x, y, radius * (0.75 + 0.6 * v), 0, TAU);
        ctx.fill();
      }
    }
  }
}

// Burned-in captions: groups words into short phrases, highlights the one being spoken.
export class Captions {
  constructor(parent, timing, { maxWords = 3, segments = null } = {}) {
    this.node = el("div", "captions", parent);
    this.chunks = [];
    let current = null;
    for (const w of timing.words) {
      if (segments && !segments.includes(w.seg)) continue;
      const breakHere = !current || current.seg !== w.seg || current.words.length >= maxWords || /[.,?!:]$/.test(current.words.at(-1).text);
      if (breakHere) {
        current = { seg: w.seg, words: [] };
        this.chunks.push(current);
      }
      current.words.push(w);
    }
    for (const c of this.chunks) {
      c.start = c.words[0].start;
      c.end = c.words.at(-1).end;
    }
    this.last = "";
  }
  render(t, opacity = 1) {
    const chunk = this.chunks.find((c, i) => t >= c.start - 0.05 && t < (this.chunks[i + 1]?.start ?? c.end + 0.6) - 0.05 && t < c.end + 0.6);
    let html = "";
    if (chunk && opacity > 0) {
      html = chunk.words
        .map((w) => `<span class="${t >= w.start - 0.03 ? "on" : ""}">${escapeHtml(w.text.replace(/[,.:]$/, ""))}</span>`)
        .join(" ");
    }
    if (html !== this.last) {
      this.node.innerHTML = html;
      this.last = html;
    }
    this.node.style.opacity = opacity;
  }
}

// Shared chrome: optional label tag, progress bar, vignette.
export function chrome(stage, { label = "", handle = "" } = {}) {
  const tag = label
    ? el("div", "day-tag", stage, `<span class="dot"></span><span>${escapeHtml(label)}</span>${handle ? `<span class="handle">${escapeHtml(handle)}</span>` : ""}`)
    : null;
  const bar = el("div", "progress", stage, "<i></i>");
  const vignette = el("div", "vignette", stage);
  return {
    tag,
    vignette,
    render(t, duration) {
      bar.firstChild.style.width = `${(clamp(t / duration) * 100).toFixed(2)}%`;
    },
  };
}

function readParams() {
  const out = {};
  for (const [k, v] of new URLSearchParams(location.search)) out[k] = v;
  return Object.assign(out, window.__RENDER_PARAMS__ || {});
}

export async function boot(build) {
  const reel = await fetch("reel.json").then((r) => r.json());
  // Voiceover reels are timed by the spoken words; music reels by their own duration and beat grid.
  const timingData = reel.vo
    ? await fetch("timing.json").then((r) => r.json())
    : { source: "beats", duration: reel.duration, segments: [], words: [] };
  const timing = new Timing(timingData);
  const params = Object.assign({}, reel.params || {}, readParams());
  const stage = document.getElementById("stage");
  const reelImpl = await build({ stage, timing, params, reel });
  await document.fonts.ready;
  await Promise.all([...document.images].map((img) => (img.complete ? null : new Promise((ok) => { img.onload = img.onerror = ok; }))));

  const duration = timing.duration;
  const fps = reel.fps || 30;
  window.REEL = {
    duration,
    fps,
    events: (reelImpl.events || []).filter((e) => e.t >= 0 && e.t <= duration).sort((a, b) => a.t - b.t),
    cover: reel.cover ?? 0,
    render: (t, frame = 0) => reelImpl.render(t, { frame, fps, total: Math.ceil(duration * fps) }),
  };

  if (!window.__RENDER_PARAMS__) startPreview(reel, duration);
  else window.REEL.render(0);
}

function startPreview(reel, duration) {
  const ui = document.getElementById("preview-ui") || el("div", "", document.body);
  ui.id = "preview-ui";
  ui.style.display = "flex";
  ui.innerHTML = `<button>play</button><input type="range" min="0" max="${duration}" step="0.01" value="0"><span>0.00s</span>`;
  const [button, range, label] = ui.children;
  const audio = new Audio(reel.vo?.audio || reel.previewAudio || "audio/vo.mp3");
  let playing = false;
  let clockStart = 0;
  let clockAt = 0;
  const now = () => (playing ? (audio.readyState > 2 && !audio.error ? audio.currentTime : clockAt + (performance.now() - clockStart) / 1000) : Number(range.value));
  button.onclick = () => {
    playing = !playing;
    button.textContent = playing ? "pause" : "play";
    if (playing) {
      clockAt = Number(range.value);
      clockStart = performance.now();
      audio.currentTime = clockAt;
      audio.play().catch(() => {});
    } else audio.pause();
  };
  range.oninput = () => {
    audio.currentTime = Number(range.value);
    clockAt = Number(range.value);
    clockStart = performance.now();
  };
  // Scale the 1080x1920 stage to fit the browser window.
  const fit = () => {
    const k = Math.min(innerWidth / 1080, (innerHeight - 60) / 1920);
    document.getElementById("stage").style.transform = `scale(${k})`;
    document.getElementById("stage").style.transformOrigin = "top left";
    document.body.style.width = "auto";
    document.body.style.height = "auto";
  };
  addEventListener("resize", fit);
  fit();
  const tick = () => {
    let t = now();
    if (t >= duration) {
      t = duration;
      if (playing) button.click();
    }
    if (playing) range.value = t;
    label.textContent = `${t.toFixed(2)}s`;
    window.REEL.render(t);
    requestAnimationFrame(tick);
  };
  tick();
}
