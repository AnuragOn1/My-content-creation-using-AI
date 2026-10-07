// "5 things I use Claude for every day while preparing for a 30 LPA job".
// Plain text-on-screen slides: hook, five numbered items, objection line and
// the comment prompt. Every reveal is keyed to the word being spoken.

import { boot, chrome, clamp, DotGrid, ease, el, escapeHtml, lerp, place, prog, shown } from "../../engine/runtime.js";

boot(({ stage, timing: T, params }) => {
  const grid = new DotGrid(stage);
  const ui = chrome(stage, { label: params.label });
  const events = [];
  const sfx = (t, type, gain = 1) => events.push({ t, type, gain });

  const N = T.segments.length;
  const sceneStart = (i) => (i === 0 ? -1 : T.seg(i).start - 0.25);
  const sceneEnd = (i) => (i === N - 1 ? T.duration + 1 : T.seg(i + 1).start - 0.12);
  const at = (seg, word, nth = 0) => T.at(seg, word, nth);

  // Child entrance: fade + rise + de-blur. Returns progress 0..1.
  const enter = (node, t, start, { dy = 46, dx = 0, dur = 0.45, s0 = 1, blur0 = 10, e = ease.outCubic } = {}) => {
    const k = e(prog(t, start, dur));
    place(node, { x: (1 - k) * dx, y: (1 - k) * dy, s: lerp(s0, 1, k), o: clamp(k * 1.5), blur: (1 - k) * blur0 });
    return k;
  };
  // Scene container: visible inside its window, lifts out at the end.
  const sceneEnv = (node, t, i) => {
    if (!shown(node, t >= sceneStart(i) && t <= sceneEnd(i))) return false;
    const out = ease.inCubic(prog(t, sceneEnd(i) - 0.28, 0.28));
    place(node, { y: -out * 70, o: 1 - out, blur: out * 10 });
    return true;
  };
  const scene = () => el("div", "scene", stage);

  // ---------- Scene 0: hook ----------
  const hook = scene();
  const hookA = el("div", "hook-a", hook);
  const hookWords = [];
  for (const [i, line] of [["Stop", "using"], ["Claude", "like"], ["Google."]].entries()) {
    const ln = el("div", "line", hookA);
    if (i === 2) ln.style.color = "var(--grey)";
    for (const w of line) {
      const span = el("span", "word", ln, escapeHtml(w) + "&nbsp;");
      hookWords.push({ span, start: at(0, w.replace(".", "")) });
    }
  }
  hookWords[0].start = -0.3; // first word is already on screen in frame 1
  const googleLine = hookA.children[2];
  googleLine.style.position = "relative";
  const strike = el("div", "strike", googleLine);
  strike.style.top = "70px";
  strike.style.width = "560px";
  const strikeAt = T.word(0, "Google").end - 0.12;
  const hookAOut = at(0, "Here") - 0.15;

  const hookB = el("div", "hook-b", hook);
  const five = el("span", "five", hookB, "5");
  const things = el("span", "things", hookB, "things");
  const l2 = el("div", "l2", hookB);
  const l2Words = [["I", "I"], ["use", "use"], ["Claude", "it"], ["for", "for"], ["every", "every"], ["day", "day"]].map(([shown, spoken], k) => {
    const span = el("span", "", l2, escapeHtml(shown) + (k === 3 ? "<br>" : "&nbsp;"));
    span.style.display = "inline-block";
    return { span, start: at(0, spoken) - 0.05 };
  });
  const rule = el("div", "rule", hookB);
  const l3 = el("div", "l3", hookB, "while preparing for a");
  const l4 = el("div", "l4", hookB, `<span class="salary">${escapeHtml(params.salary)}</span> job`);
  const tFive = at(0, "five") - 0.05;
  const tWhile = at(0, "while") - 0.05;
  const tThirty = at(0, "thirty") - 0.08;
  sfx(0, "hit", 1);
  sfx(strikeAt, "whoosh", 0.7);
  sfx(tFive, "hit", 0.8);
  sfx(tThirty, "hit", 0.7);

  const renderHook = (t) => {
    if (!sceneEnv(hook, t, 0)) return;
    const outA = ease.inCubic(prog(t, hookAOut, 0.3));
    place(hookA, { y: -outA * 120, o: 1 - outA, blur: outA * 12 });
    for (const w of hookWords) enter(w.span, t, w.start, { dy: 0, s0: 1.35, blur0: 14, dur: 0.32, e: ease.outQuint });
    strike.style.transform = `scaleX(${ease.outExpo(prog(t, strikeAt, 0.3))})`;
    shown(hookA, t < hookAOut + 0.3);
    shown(hookB, t >= hookAOut);
    enter(five, t, tFive, { dy: 0, s0: 1.6, blur0: 20, dur: 0.4, e: ease.outQuint });
    enter(things, t, at(0, "things") - 0.05, { dx: 60, dy: 0 });
    for (const w of l2Words) enter(w.span, t, w.start, { dy: 36, dur: 0.35 });
    rule.style.transform = `scaleX(${ease.outCubic(prog(t, tWhile, 0.5))})`;
    enter(l3, t, tWhile);
    enter(l4, t, tThirty, { dy: 0, s0: 1.25, blur0: 16, dur: 0.4, e: ease.outQuint });
  };

  // ---------- Scenes 1-5: the five items ----------
  const step = el("div", "step", stage);
  const items = [
    {
      title: "It plans my day.", titleAt: ["plans"], subAt: ["My"],
      sub: "My <b>16-week plan</b> becomes today's to-do list, right inside Notion.",
      card: (c) => {
        el("div", "label", c, "<span>TODAY · TO-DO</span><span>WEEK 2 / 16</span>");
        const rows = ["DSA: arrays, problems 46–64", "Course: arrays &amp; objects", "Chat UI: message list", "Update progress.md"]
          .map((txt) => el("div", "todo", c, `<div class="box"></div><span>${txt}</span>`));
        const chip = el("div", "chip", c, "✓ synced to Notion");
        const t0 = at(1, "becomes");
        rows.forEach((r, k) => sfx(t0 + k * 0.22, "pop", 0.55));
        const tChip = at(1, "Notion");
        sfx(tChip, "tick", 0.8);
        return Object.assign((t) => {
          rows.forEach((r, k) => enter(r, t, t0 + k * 0.22, { dx: 40, dy: 0, dur: 0.35 }));
          enter(chip, t, tChip, { dy: 20, s0: 0.9 });
        }, { firstAt: t0 });
      },
    },
    {
      title: "Hints, not answers.", titleAt: ["Hints"], subAt: ["Stuck"],
      sub: "Stuck on a DSA problem? <b>One hint.</b> Then I try again.",
      card: (c) => {
        const me = el("div", "bubble me", c, "Stuck on “second largest element”. Give me ONE hint. No code.");
        const ai = el("div", "bubble ai", c, "<span class=\"who\">CLAUDE</span>One pass is enough. Track the largest and the second largest as you go.");
        const chip = el("div", "chip", c, "↻ trying again myself");
        const tMe = at(2, "Stuck"), tAi = at(2, "one"), tChip = at(2, "try");
        sfx(tMe, "pop", 0.6); sfx(tAi, "pop", 0.6); sfx(tChip, "tick", 0.8);
        return Object.assign((t) => {
          enter(me, t, tMe, { dx: 50, dy: 0, s0: 0.92 });
          enter(ai, t, tAi, { dx: -50, dy: 0, s0: 0.92 });
          enter(chip, t, tChip, { dy: 20, s0: 0.9 });
        }, { firstAt: tMe });
      },
    },
    {
      title: "It teaches with my own project.", titleAt: ["explains"], subAt: ["using"],
      sub: "Every new concept, explained through <b>the chat app I'm building</b>.",
      card: (c) => {
        const me = el("div", "bubble me", c, "Explain async/await using my chat app.");
        const ai = el("div", "bubble ai", c, "<span class=\"who\">CLAUDE</span>When you hit send, your app <b>awaits</b> the server. Only after it replies do you show ✓✓. That pause is await.");
        const tMe = at(3, "own"), tAi = at(3, "chat");
        sfx(tMe, "pop", 0.6); sfx(tAi, "pop", 0.6);
        return Object.assign((t) => {
          enter(me, t, tMe, { dx: 50, dy: 0, s0: 0.92 });
          enter(ai, t, tAi, { dx: -50, dy: 0, s0: 0.92 });
        }, { firstAt: tMe });
      },
    },
    {
      title: "It reviews my code first.", titleAt: ["reviews"], subAt: ["before"],
      sub: "Like a senior developer, <b>before any interviewer sees it</b>.",
      card: (c) => {
        el("div", "label", c, "<span>ChatRoom.jsx</span><span>REVIEW</span>");
        const codeWrap = el("div", "", c);
        codeWrap.style.position = "relative";
        const hl = el("div", "hl", codeWrap);
        hl.style.top = "46px";
        hl.style.left = "-14px";
        hl.style.right = "-14px";
        el("pre", "code", codeWrap,
          `<span class="k">useEffect</span>(() =&gt; {\n  socket.<span class="k">on</span>("message", addMessage);\n}, []);`);
        const review = el("div", "review", c,
          "<b>SENIOR REVIEW</b>No cleanup. Every re-mount adds another listener, so messages show twice. Return <code>() =&gt; socket.off(...)</code>");
        const tHl = at(4, "code"), tReview = at(4, "senior");
        sfx(tHl, "tick", 0.8); sfx(tReview, "pop", 0.7);
        return (t) => {
          const k = ease.outCubic(prog(t, tHl, 0.35));
          place(hl, { sx: k, s: 1, o: k });
          hl.style.transformOrigin = "left center";
          enter(review, t, tReview, { dy: 30 });
        };
      },
    },
    {
      title: "It checks on me at 2\u00a0AM.", titleAt: ["checks"], subAt: ["tells"],
      sub: "And tells me <b>exactly</b> what I haven't finished.",
      card: (c) => {
        const clock = el("div", "clock", c, `<span class="time">2:00</span><span class="ampm">AM</span>`);
        const notif = el("div", "notif", c,
          `<div class="top"><span class="app">CLAUDE · NOTION CHECK-IN</span><span>now</span></div>
           <div class="msg">3 tasks left before 4 AM</div>
           <div class="left">☐ DSA problems 58–64<br>☐ 5 lines in notes.md<br>☐ Update progress.md</div>`);
        const tClock = at(5, "2"), tNotif = at(5, "exactly");
        sfx(tNotif, "ping", 0.7);
        return Object.assign((t) => {
          enter(clock, t, tClock - 0.1, { dy: 0, s0: 1.3, blur0: 14, e: ease.outQuint });
          enter(notif, t, tNotif - 0.1, { dy: -40, s0: 0.95 });
        }, { firstAt: tClock - 0.1 });
      },
    },
  ];

  const itemScenes = items.map((item, k) => {
    const seg = k + 1;
    const root = scene();
    root.classList.add("item");
    const block = el("div", "block", root);
    const num = el("div", "numeral", block, `<span class="outline">0${seg}</span><span class="fill">0${seg}</span>`);
    const fill = num.querySelector(".fill");
    const title = el("h2", "", block, escapeHtml(item.title));
    const sub = el("div", "sub", block, item.sub);
    const card = el("div", "card", block);
    const renderCard = item.card(card);
    const tNum = T.seg(seg).start - 0.05;
    const tTitle = at(seg, item.titleAt[0]) - 0.08;
    const tSub = at(seg, item.subAt[0]) - 0.08;
    sfx(sceneStart(seg), "whoosh", 0.6);
    sfx(tNum, "hit", 0.55);
    return (t) => {
      if (!sceneEnv(root, t, seg)) return false;
      enter(num, t, tNum, { dy: 0, dx: -40, dur: 0.4, e: ease.outQuint });
      const f = ease.inOutCubic(prog(t, tNum + 0.1, 0.6));
      fill.style.clipPath = `inset(${(1 - f) * 100}% 0 0 0)`;
      enter(title, t, tTitle);
      enter(sub, t, tSub);
      // Cards with animated contents arrive just before them, so no empty box sits on screen.
      enter(card, t, Math.max(Math.min(tSub, tTitle + 0.6) + 0.05, (renderCard.firstAt ?? 0) - 0.45), { dy: 60, dur: 0.5 });
      renderCard(t);
      return true;
    };
  });

  // ---------- Scene 6: objection handling ----------
  const obj = scene();
  const obj1 = el("div", "center obj1", obj, "It doesn't do<br>the work for me.");
  const obj2 = el("div", "center obj2", obj, "It makes sure<br>I do it.");
  const tObj1 = T.seg(6).start - 0.05, tObj2 = at(6, "makes") - 0.2;
  sfx(sceneStart(6), "whoosh", 0.6);
  sfx(tObj2, "hit", 0.8);

  // ---------- Scene 7: comment prompt ----------
  const cta = scene();
  const ctaTitle = el("div", "center cta-title", cta, "Comment");
  const box = el("div", "center comment-box", cta, `<div class="avatar"></div><div class="typed"></div><div class="send">POST</div>`);
  const typed = box.querySelector(".typed");
  const send = box.querySelector(".send");
  const ctaSub = el("div", "center cta-sub", cta, `and I'll send you<br><span class="blue">all 5 prompts.</span>`);
  const keyword = params.keyword;
  const tType = at(7, "prompts") - 0.35;
  const typeDur = 0.5;
  const tSub7 = at(7, "I'll") - 0.1;
  sfx(sceneStart(7), "whoosh", 0.6);
  for (let k = 0; k < keyword.length; k++) sfx(tType + (k / keyword.length) * typeDur, "type", 1);
  sfx(at(7, "five"), "ping", 0.8);

  return {
    events,
    render(t) {
      ui.render(t, T.duration);

      // Background: faint drifting grid plus a ring pulse at every new slide.
      const boost = 0.12 * clamp(prog(t, tObj2, 0.4)) * (t < sceneEnd(6) ? 1 : 0);
      grid.draw((x, y) => {
        let v = 0.11 + 0.05 * Math.sin(x * 0.011 + t * 0.7) * Math.sin(y * 0.009 - t * 0.5) + boost;
        for (const s of T.segments) {
          const dt = t - s.start + 0.1;
          if (dt < 0 || dt > 1.6) continue;
          const d = Math.hypot(x - 540, y - 960);
          v += 0.5 * Math.exp(-(((d - dt * 1500) / 80) ** 2)) * (1 - dt / 1.6);
        }
        return v;
      });

      renderHook(t);
      let current = 0;
      itemScenes.forEach((render, k) => { if (render(t)) current = k + 1; });
      step.innerHTML = current ? `<b>0${current}</b> / 05` : "";
      step.style.opacity = current ? 1 : 0;

      if (sceneEnv(obj, t, 6)) {
        enter(obj1, t, tObj1, { dy: 50 });
        enter(obj2, t, tObj2, { dy: 0, s0: 1.25, blur0: 16, dur: 0.4, e: ease.outQuint });
      }
      if (sceneEnv(cta, t, 7)) {
        enter(ctaTitle, t, T.seg(7).start - 0.05, { dy: 0, s0: 1.3, blur0: 16, e: ease.outQuint });
        enter(box, t, T.seg(7).start + 0.15, { dy: 60, s0: 0.95 });
        const n = Math.round(clamp(prog(t, tType, typeDur)) * keyword.length);
        const blink = Math.floor(t * 2.5) % 2 === 0 || n < keyword.length;
        typed.innerHTML = `${escapeHtml(keyword.slice(0, n))}<span class="cursor" style="opacity:${blink ? 1 : 0}"></span>`;
        const sendK = ease.outBack(prog(t, tType + typeDur, 0.35));
        place(send, { s: lerp(1, 1.0, sendK), o: 0.35 + 0.65 * clamp(sendK) });
        enter(ctaSub, t, tSub7);
      }
    },
  };
});
