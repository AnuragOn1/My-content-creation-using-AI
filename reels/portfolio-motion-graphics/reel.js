// "I turned my portfolio into a motion graphic", a standalone reel with no voiceover.
// Everything cuts on a 120 BPM grid (beat = 0.5 s, bar = 2 s) that matches the
// track engine/music.py synthesizes from the "music" block in reel.json.
//
//   0-4   hook: the finished result first (kinetic version of the portfolio hero)
//   4-8   the prompt, then the loading sequence (build-up)
//   8-22  the drop: roles, stats, projects, experience, skills, process, quote
//   22-26 the real site scrolling in a phone
//   26-30 "rate my first attempt 1-10"

import { boot, clamp, DotGrid, ease, el, escapeHtml, lerp, place, prog, shown } from "../../engine/runtime.js";

const BEAT = 0.5;

// Piecewise-linear value over time: [[t, v], ...].
const curve = (t, points) => {
  if (t <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    const [t1, v1] = points[i];
    const [t0, v0] = points[i - 1];
    if (t <= t1) return lerp(v0, v1, (t - t0) / (t1 - t0 || 1));
  }
  return points.at(-1)[1];
};

boot(async ({ stage, params }) => {
  await Promise.all(["400 100px Anton", '400 100px "Mrs Saint Delafield"', "900 100px Inter", "800 100px Inter",
    "700 100px Inter", "600 100px Inter", "500 100px Inter", '500 40px "JetBrains Mono"', '600 40px "JetBrains Mono"',
    '700 40px "JetBrains Mono"'].map((f) => document.fonts.load(f)));

  const events = [];
  const sfx = (t, type, gain = 1) => events.push({ t, type, gain });

  const grid = new DotGrid(stage, { gap: 54, radius: 3.4 });
  const atmo = el("div", "atmo", stage);
  const world = el("div", "world", stage);
  const overlay = el("div", "layer", stage);
  const flash = el("div", "flash", stage);

  const enter = (node, t, start, { dy = 46, dx = 0, dur = 0.4, s0 = 1, r0 = 0, blur0 = 10, e = ease.outCubic } = {}) => {
    const k = e(prog(t, start, dur));
    place(node, { x: (1 - k) * dx, y: (1 - k) * dy, s: lerp(s0, 1, k), r: (1 - k) * r0, o: clamp(k * 1.6), blur: (1 - k) * blur0 });
    return k;
  };
  // Font size that makes `text` fill `width` px in the given font, capped at `max`.
  const fit = (text, font, width, max) => {
    const probe = el("span", "", document.body);
    probe.style.cssText = `position:absolute;visibility:hidden;white-space:nowrap;font:${font}`;
    const widest = Math.max(...text.split("|").map((line) => { probe.textContent = line; return probe.offsetWidth; }));
    probe.remove();
    return Math.min(max, (100 * width) / widest);
  };

  // Scenes: visible on [a, b); "whip" slides in/out vertically with motion blur.
  const scenes = [];
  const addScene = (a, b, { into = "cut", out = "cut" }, build) => {
    const node = el("div", "scene", world);
    scenes.push({ a, b, node, into, out, render: build(node, a, b) });
  };
  const WHIP = 0.18;
  const envelope = (s, t) => {
    if (!shown(s.node, t >= s.a && t < s.b)) return false;
    let y = 0, blur = 0, scale = 1, o = 1;
    if (s.into === "whip" && t < s.a + WHIP) {
      const k = ease.outCubic(prog(t, s.a, WHIP));
      y = (1 - k) * 520; blur = (1 - k) * 34;
    }
    if (s.out === "whip" && t > s.b - WHIP) {
      const k = ease.inCubic(prog(t, s.b - WHIP, WHIP));
      y = -k * 520; blur = k * 34;
    }
    if (s.out === "zoom" && t > s.b - 0.25) {
      const k = ease.inCubic(prog(t, s.b - 0.25, 0.25));
      scale = 1 + k * 1.6; o = 1 - k; blur = k * 20;
    }
    place(s.node, { y, s: scale, o, blur });
    return true;
  };

  // ---------- brand captions (outside the punch-zoom world) ----------
  const cap1 = el("div", "cap", overlay, `I turned my portfolio<br>into a <span class="blue">motion graphic.</span>`);
  const cap2 = el("div", "cap", overlay, "One prompt.");
  const cap3 = el("div", "cap", overlay, `<span class="blue">Zero</span> After Effects.`);
  const tag = el("div", "tag", overlay, `<i></i><span>MOTION GRAPHIC · MADE WITH ${escapeHtml(params.credit)}</span>`);
  const cap4 = el("div", "cap", overlay, `Built from my <span class="blue">real</span> portfolio ↓`);
  const captions = [
    { node: cap1, a: -0.3, b: 3.86 },
    { node: cap2, a: 4.05, b: 5.96 },
    { node: cap3, a: 6.0, b: 7.8 },
    { node: tag, a: 8.05, b: 21.86 },
    { node: cap4, a: 22.1, b: 25.86 },
  ];

  // ---------- 1. Hook: the portfolio hero, rebuilt as kinetic type ----------
  addScene(0, 4, { out: "whip" }, (root) => {
    const letters = [];
    [["PORT", 452], ["FOLIO", 812]].forEach(([word, top]) => {
      const line = el("div", "bigword", root);
      line.style.top = `${top}px`;
      for (const ch of word) letters.push(el("span", "", line, ch));
    });
    const letterAt = letters.map((_, k) => (k === 0 ? -0.12 : k * 0.125 - 0.03));
    letterAt.forEach((t) => sfx(t, "tick", 0.5));
    const portrait = el("img", "portrait", root);
    portrait.src = "assets/anurag.webp";
    const shade = el("div", "shade", root);
    const hello = el("div", "hello", root, "Hello, I'm");
    const first = el("div", "name", root, escapeHtml(params.first));
    const last = el("div", "name", root, escapeHtml(params.last));
    first.style.top = "1118px";
    last.style.top = "1253px";
    const role = el("div", "role", root);
    const roleText = params.roles[0].replace("|", " ");
    sfx(0.95, "whoosh", 0.8);
    sfx(2.0, "whoosh", 0.5);
    sfx(2.5, "hit", 0.6);
    sfx(2.75, "hit", 0.6);
    for (let k = 0; k < roleText.length; k += 2) sfx(3.0 + (k / roleText.length) * 0.45, "type", 1);
    return (t) => {
      letters.forEach((node, k) => enter(node, t, letterAt[k], { dy: 0, s0: 1.9, blur0: 22, dur: 0.24, e: ease.outQuint }));
      const p = enter(portrait, t, 1.0, { dy: 280, s0: 1.1, blur0: 18, dur: 0.6, e: ease.outQuint });
      portrait.style.transform += ` scale(${1 + 0.035 * clamp(t / 4)})`;
      shade.style.opacity = p;
      const h = ease.outCubic(prog(t, 2.0, 0.45));
      hello.style.clipPath = `inset(-20% ${(1 - h) * 100}% -20% 0)`;
      enter(first, t, 2.5, { dy: 0, s0: 1.45, blur0: 16, dur: 0.24, e: ease.outQuint });
      enter(last, t, 2.75, { dy: 0, s0: 1.45, blur0: 16, dur: 0.24, e: ease.outQuint });
      const n = Math.round(clamp(prog(t, 3.0, 0.45)) * roleText.length);
      const caretOn = t < 3.0 + 0.45 || Math.floor(t * 3) % 2 === 0;
      role.innerHTML = t < 2.95 ? "" : `${escapeHtml(roleText.slice(0, n))}<span class="caret" style="opacity:${caretOn ? 1 : 0}"></span>`;
    };
  });

  // ---------- 2. The prompt, then the loading sequence ----------
  let loadPct = 0;
  addScene(4, 8, { into: "whip", out: "zoom" }, (root) => {
    const card = el("div", "card", root);
    card.style.top = "420px";
    el("div", "head", card, `<span>● PROMPT</span><span>TO ${escapeHtml(params.credit)}</span>`);
    const text = el("div", "prompt-text", card);
    const enterKey = el("div", "enter", card, "ENTER ↵");
    const pct = el("div", "pct", root);
    pct.style.top = "950px";
    const bar = el("div", "bar", root, "<i></i>");
    bar.style.top = "1172px";
    const status = el("div", "status", root);
    status.style.top = "1214px";
    const prompt = params.prompt;
    const t0 = 4.2, t1 = 5.85;
    for (let k = 0; k < prompt.length; k += 3) sfx(t0 + (k / prompt.length) * (t1 - t0), "type", 1);
    sfx(5.9, "pop", 0.9);
    [6.1, 6.6, 7.1].forEach((t) => sfx(t, "tick", 0.7));
    sfx(7.75, "ping", 0.8);
    const counts = `${params.projects.length} projects, ${params.skills.length} skills`;
    return (t, { frame, total }) => {
      enter(card, t, 4.05, { dy: 80, dur: 0.35 });
      const n = Math.round(clamp(prog(t, t0, t1 - t0)) * prompt.length);
      const blink = n < prompt.length || Math.floor(t * 3) % 2 === 0;
      text.innerHTML = `${escapeHtml(prompt.slice(0, n))}<span class="cursor" style="opacity:${blink && t < 5.95 ? 1 : 0}"></span>`;
      const kk = ease.outBack(prog(t, 5.9, 0.3));
      place(enterKey, { s: t < 5.9 ? 1 : lerp(1.35, 1, clamp(kk)), o: t < 5.6 ? 0.35 : 1 });
      // Loader steps on 16th notes so the counter ticks with the hats.
      const raw = clamp(prog(t, 6.0, 1.75));
      loadPct = Math.floor(ease.inOutCubic(Math.floor(raw * 28) / 28) * 100);
      const shown_ = t >= 5.98;
      pct.style.opacity = shown_ ? 1 : 0;
      bar.style.opacity = shown_ ? 1 : 0;
      pct.textContent = `${loadPct}%`;
      bar.firstChild.style.width = `${loadPct}%`;
      const done = (at) => (t >= at ? '<span class="ok">✓</span>' : '<span class="ok">●</span>');
      const lines = [];
      if (t >= 6.1) lines.push(`${done(6.5)} read index.html: ${counts}`);
      if (t >= 6.6) lines.push(`${done(7.0)} wrote the animation as code`);
      if (t >= 7.1) lines.push(`${done(7.75)} rendering frame ${String(frame + 1).padStart(4, "0")}/${String(total).padStart(4, "0")}`);
      status.innerHTML = lines.join("<br>");
    };
  });

  // ---------- 3. The drop: the portfolio, section by section ----------
  addScene(8, 10, {}, (root) => {
    const kicker = el("div", "kicker", root, "— I'M A —");
    kicker.style.top = "600px";
    const roles = params.roles.map((r) => {
      const node = el("div", "slam", root, r.split("|").map(escapeHtml).join("<br>"));
      node.style.fontSize = `${fit(r, "400 100px Anton", 940, 210)}px`;
      node.style.top = "680px";
      return node;
    });
    roles.forEach((_, i) => sfx(8 + i * BEAT, "hit", 0.35));
    return (t) => {
      enter(kicker, t, 8.0, { dy: 20 });
      roles.forEach((node, i) => {
        const a = 8 + i * BEAT;
        const b = i < roles.length - 1 ? a + BEAT : 10;
        if (!shown(node, t >= a && t < b)) return;
        enter(node, t, a, { dy: 0, s0: 1.5, blur0: 18, dur: 0.2, e: ease.outQuint });
      });
    };
  });

  addScene(10, 12, {}, (root) => {
    const rows = params.stats.map((s, i) => {
      const row = el("div", "stat", root, `<div class="num"><span>0</span><sup>${escapeHtml(s.suffix)}</sup></div><div class="lbl">${s.label.split("|").map(escapeHtml).join("<br>")}</div>`);
      row.style.top = `${470 + i * 300}px`;
      sfx(10 + i * BEAT, "pop", 0.8);
      return { row, num: row.querySelector(".num span"), value: s.value, at: 10 + i * BEAT };
    });
    return (t) => {
      for (const r of rows) {
        enter(r.row, t, r.at, { dx: -90, dy: 0, dur: 0.3, blur0: 14 });
        r.num.textContent = Math.round(r.value * ease.outCubic(prog(t, r.at, 0.45)));
      }
    };
  });

  addScene(12, 14, {}, (root) => {
    const kicker = el("div", "kicker", root, "SELECTED PROJECTS");
    kicker.style.cssText += "left:80px;width:auto;text-align:left;top:372px";
    const cards = params.projects.map((p, i) => {
      const card = el("div", "proj", root);
      card.style.top = `${440 + i * 336}px`;
      const thumb = el("div", "thumb", card);
      if (p.image) el("img", "", thumb).src = p.image;
      else el("div", "soon", thumb, "<b>NEXT PROJECT</b><span>IN THE WORKS — STAY TUNED</span>");
      el("div", "meta", card, `<span class="n">0${i + 1}</span><div><b>${escapeHtml(p.name)}</b><span>${escapeHtml(p.stack)}</span></div>`);
      sfx(12 + i * BEAT, "whoosh", 0.6);
      return { card, at: 12 + i * BEAT, side: i % 2 ? 1 : -1 };
    });
    return (t) => {
      enter(kicker, t, 12.0, { dy: 16 });
      for (const c of cards) enter(c.card, t, c.at, { dx: c.side * 760, dy: 0, r0: c.side * 7, blur0: 24, dur: 0.32, e: ease.outQuint });
    };
  });

  addScene(14, 16, {}, (root) => {
    const head = el("div", "h-sec", root, "EXPERIENCE");
    head.style.top = "420px";
    const line = el("div", "tl-line", root);
    line.style.top = "612px";
    line.style.height = "760px";
    const jobs = params.jobs.map((j, i) => {
      const node = el("div", "job", root, `<span class="dot"></span><div class="when">${escapeHtml(j.when)}</div><div class="what">${escapeHtml(j.role)}</div><div class="where">${escapeHtml(params.company)}</div>`);
      node.style.top = `${600 + i * 262}px`;
      sfx(14.25 + i * BEAT, "pop", 0.8);
      return { node, at: 14.25 + i * BEAT };
    });
    sfx(14.0, "hit", 0.4);
    return (t) => {
      enter(head, t, 14.0, { dy: 0, s0: 1.4, blur0: 16, dur: 0.22, e: ease.outQuint });
      line.style.transform = `scaleY(${ease.inOutCubic(prog(t, 14.1, 1.3))})`;
      for (const j of jobs) enter(j.node, t, j.at, { dx: 70, dy: 0, dur: 0.32 });
    };
  });

  addScene(16, 18, {}, (root) => {
    const head = el("div", "h-sec", root, "SKILLS");
    head.style.top = "410px";
    const wrap = el("div", "chips", root);
    const hot = new Set(["Python", "JavaScript", "React", "Django", "AI-Assisted Coding"]);
    const chips = params.skills.map((s, i) => {
      const chip = el("div", `chip${hot.has(s) ? " hot" : ""}`, wrap, escapeHtml(s));
      const at = 16.125 + i * 0.1;
      sfx(at, "pop", 0.35);
      return { chip, at };
    });
    sfx(16.0, "hit", 0.4);
    return (t) => {
      enter(head, t, 16.0, { dy: 0, s0: 1.4, blur0: 16, dur: 0.22, e: ease.outQuint });
      for (const c of chips) enter(c.chip, t, c.at, { dy: 30, s0: 0.5, blur0: 8, dur: 0.28, e: ease.outBack });
    };
  });

  addScene(18, 20, {}, (root) => {
    const times = [18.0, 18.5, 19.0, 19.25, 19.5];
    const num = el("div", "step-num", root);
    const word = el("div", "step-word", root);
    const line = el("div", "step-line", root);
    const dots = el("div", "step-dots", root, params.process.map(() => "<i></i>").join(""));
    const sizes = params.process.map((p) => fit(p.word, "400 100px Anton", 960, 240));
    times.forEach((t) => sfx(t, "hit", 0.45));
    return (t) => {
      const i = Math.max(0, times.filter((x) => t >= x).length - 1);
      const step = params.process[i];
      num.textContent = `0${i + 1}`;
      word.textContent = step.word;
      word.style.fontSize = `${sizes[i]}px`;
      line.textContent = step.line;
      [...dots.children].forEach((d, k) => d.classList.toggle("on", k <= i));
      enter(num, t, times[i], { dy: -40, dur: 0.18 });
      enter(word, t, times[i], { dy: 0, s0: 1.5, blur0: 18, dur: 0.2, e: ease.outQuint });
      enter(line, t, times[i] + 0.06, { dy: 20, dur: 0.2 });
    };
  });

  addScene(20, 22, { out: "whip" }, (root) => {
    const panel = el("div", "quote", root);
    el("span", "mark", panel, "“");
    const text = el("div", "text", panel);
    const words = params.quote.split(" ").map((w) => el("span", "", text, escapeHtml(w)));
    const sig = el("div", "sig", panel, escapeHtml(params.signature));
    const cta = el("div", "cta", panel, "LET'S CREATE<br>SOMETHING GREAT TOGETHER.");
    sfx(20.0, "whoosh", 0.8);
    sfx(21.35, "whoosh", 0.5);
    return (t) => {
      enter(panel, t, 20.0, { dy: 900, dur: 0.36, blur0: 0, e: ease.outQuint });
      words.forEach((w, k) => enter(w, t, 20.3 + k * 0.09, { dy: 24, dur: 0.22, blur0: 6 }));
      const s = ease.inOutCubic(prog(t, 21.35, 0.4));
      sig.style.clipPath = `inset(-30% ${(1 - s) * 100}% -30% 0)`;
      enter(cta, t, 21.5, { dy: 16, dur: 0.25 });
    };
  });

  // ---------- 4. The real site ----------
  addScene(22, 26, { into: "whip", out: "whip" }, (root) => {
    const browserWrap = el("div", "layer", root);
    browserWrap.style.transform = "perspective(1800px) rotateY(-14deg) rotateX(6deg)";
    const browser = el("div", "browser", browserWrap, `<div class="chrome-bar"><i></i><i></i><i></i></div><img src="assets/site-desktop-hero.webp">`);
    const url = el("div", "url", root, `<span>${escapeHtml(params.site)}</span>`);
    const phone = el("div", "phone", root, `<div class="notch"></div><div class="screen"><img src="assets/site-mobile-full.webp"></div>`);
    const shot = phone.querySelector(".screen img");
    const STEPS = 7;
    for (let k = 0; k < STEPS; k++) sfx(22.5 + k * BEAT, "tick", 0.6);
    sfx(22.0, "whoosh", 0.7);
    return (t) => {
      const k = enter(browser, t, 22.05, { dy: 160, dx: -120, dur: 0.6, blur0: 20 });
      browser.style.opacity = 0.42 * k;
      browser.style.transform += ` translateX(${-(t - 22) * 14}px)`;
      enter(url, t, 22.25, { dy: -20, dur: 0.3 });
      enter(phone, t, 22.1, { dy: 700, dur: 0.45, blur0: 10, e: ease.outQuint });
      // Snap-scroll the full page one step per beat.
      const screenH = 1032;
      const maxScroll = Math.max(0, (shot.naturalHeight * (shot.clientWidth / (shot.naturalWidth || 1))) - screenH);
      const beats = (t - 22.5) / BEAT;
      const done = clamp(Math.floor(beats), 0, STEPS);
      const frac = beats >= STEPS || beats < 0 ? 0 : ease.outQuint(clamp((beats - Math.floor(beats)) / 0.6));
      shot.style.transform = `translateY(${-((done + frac) / STEPS) * maxScroll}px)`;
    };
  });

  // ---------- 5. Comment prompt ----------
  addScene(26, 30.5, { into: "whip" }, (root) => {
    const a = el("div", "cta-a", root, `My first<br><span class="blue">motion graphic.</span>`);
    const b = el("div", "cta-b", root, "Rate it 1–10 ↓");
    const scale = el("div", "scale", root, Array.from({ length: 10 }, (_, i) => `<span>${i + 1}</span>`).join(""));
    const c = el("div", "cta-c", root, `MADE WITH ${escapeHtml(params.credit)}<br>ZERO AFTER EFFECTS`);
    const cells = [...scale.children];
    cells.forEach((_, i) => sfx(27.0 + i * 0.125, i === 9 ? "ping" : "tick", i === 9 ? 0.9 : 0.5));
    return (t) => {
      enter(a, t, 26.05, { dy: 0, s0: 1.25, blur0: 16, dur: 0.3, e: ease.outQuint });
      enter(b, t, 26.5, { dy: 30 });
      enter(scale, t, 26.75, { dy: 30 });
      cells.forEach((cell, i) => {
        const on = t >= 27.0 + i * 0.125;
        cell.classList.toggle("on", on);
        cell.classList.toggle("max", on && i === 9);
        place(cell, { s: i === 9 && on ? lerp(1.35, 1.12, ease.outCubic(prog(t, 28.125, 0.3))) : 1 });
      });
      enter(c, t, 28.4, { dy: 16 });
    };
  });

  // ---------- global look ----------
  const flashes = [[8.0, 0.75], [10, 0.22], [12, 0.22], [14, 0.22], [16, 0.22], [18, 0.22], [20, 0.25], [26, 0.18]];
  const inDrop = (t) => (t >= 0 && t < 4) || (t >= 8 && t < 26);

  return {
    events,
    render(t, info) {
      // Red portfolio glow vs. brand-blue dot grid, cross-faded per section.
      const kickPulse = inDrop(t) ? Math.exp(-(t % BEAT) / 0.16) : 0;
      atmo.style.opacity = curve(t, [[0, 0.55], [3.85, 0.55], [4.05, 0], [7.95, 0], [8.0, 0.5], [21.85, 0.5], [22.05, 0.22], [25.85, 0.22], [26.05, 0]]) * (0.82 + 0.18 * kickPulse);
      const gridAmt = curve(t, [[0, 0], [3.9, 0], [4.15, 1], [7.8, 1], [8.0, 0], [25.9, 0], [26.15, 1], [31, 1]]);
      grid.canvas.style.opacity = gridAmt;
      if (gridAmt > 0.01) {
        const sweep = t < 8 ? loadPct / 100 : 0;
        grid.draw((x, y, col) => {
          let v = 0.1 + 0.06 * Math.sin(x * 0.012 + t * 0.9) * Math.sin(y * 0.01 - t * 0.6);
          if (t > 5.98 && t < 8) {
            const front = sweep * 1080;
            v += x < front ? 0.32 : 0;
            v += 0.6 * Math.exp(-(((x - front) / 30) ** 2));
          }
          if (t > 27) {
            const lit = clamp((t - 27) / 1.25);
            v += 0.35 * Math.exp(-(((y - 978) / 60) ** 2)) * (x < 80 + lit * 920 ? 1 : 0);
          }
          return v;
        });
      }
      // Punch-zoom on every beat during the drops, like a hard-hitting edit.
      const punch = inDrop(t) ? 0.022 * Math.exp(-(t % BEAT) / 0.09) : 0;
      place(world, { s: 1 + punch });
      flash.style.opacity = Math.max(0, ...flashes.map(([at, g]) => (t >= at ? g * Math.exp(-(t - at) / 0.07) : 0)));

      for (const c of captions) {
        if (!shown(c.node, t >= c.a && t < c.b)) continue;
        const kin = ease.outCubic(prog(t, c.a, 0.3));
        const kout = ease.inCubic(prog(t, c.b - 0.16, 0.16));
        place(c.node, { y: (1 - kin) * 30 - kout * 60, o: kin * (1 - kout), blur: (1 - kin) * 8 + kout * 10 });
      }
      for (const s of scenes) if (envelope(s, t)) s.render(t, info);
    },
  };
});
