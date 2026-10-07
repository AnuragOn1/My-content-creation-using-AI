// DAY 01: "You're using AI wrong" -> the 4-part prompt (ROLE + TASK + CONTEXT + FORMAT)
// Every animation time is pinned to a spoken word from build/timeline.json.

module.exports = function build({ tl, cues, D, core }) {
  const { BRAND, ease, inv, clamp, lerp } = core;
  const { F } = D;
  const CX = 540;
  const w = (id, word, nth = 0) => tl.find(id, word, nth);

  const line = (words, size, fam, cx = CX) => {
    const sp = D.measure(' ', size, fam);
    const ws = words.map((s) => ({ s, width: D.measure(s, size, fam) }));
    const total = ws.reduce((a, b) => a + b.width, 0) + sp * (ws.length - 1);
    let x = cx - total / 2;
    for (const it of ws) {
      it.left = x;
      it.cx = x + it.width / 2;
      x += it.width + sp;
    }
    return ws;
  };

  // ---- scene boundaries & transitions ----
  const order = ['hook', 'title', 'problem', 'fix', 'proof', 'recap', 'tease'];
  const END = tl.end('tease') + 1.15;
  const starts = order.map((id, i) => (i === 0 ? 0 : tl.start(id) - 0.1));
  const span = (id) => {
    const i = order.indexOf(id);
    return [starts[i], i + 1 < order.length ? starts[i + 1] : END];
  };
  const transitions = order.slice(1).map((id, i) => {
    const type = i % 2 === 0 ? 'circle' : 'whip';
    const dur = type === 'circle' ? 0.5 : 0.36;
    const at = starts[i + 1];
    cues.add(type === 'circle' ? 'wipe' : 'whoosh', at - dur / 2, 0.9);
    return { at, type, dur };
  });
  const shakes = [];
  const glitches = [];
  const impact = (t, amp = 20, g = 0.8) => {
    shakes.push({ t, amp, dur: 0.38 });
    glitches.push({ t, dur: 0.16, amp: g });
    cues.add('impact', t, 1);
  };

  // The four parts, shared by fix / recap / title
  const PARTS = [
    { key: 'ROLE', word: 'role', text: 'You are a senior tech recruiter.', desc: 'Who the AI should be' },
    { key: 'TASK', word: 'task', text: 'Write a cover letter for a Frontend Developer role at Flipkart.', desc: 'Exactly what to make' },
    { key: 'CONTEXT', word: 'context', text: 'I have 2 years in sales and built 3 React projects.', desc: 'What it needs to know' },
    { key: 'FORMAT', word: 'format', text: 'Under 150 words, 3 short paragraphs, confident tone.', desc: 'Length, structure, tone' },
  ];

  // =====================================================================
  // 1. HOOK: "You're using AI wrong."
  // =====================================================================
  const hook = (() => {
    const tYou = w('hook', 'you');
    const tUsing = w('hook', 'using');
    const tAI = w('hook', 'ai');
    const tWrong = w('hook', 'wrong');
    const L1 = line(["YOU'RE", 'USING'], 104, F.k);
    const yBar = 420;
    const bar = { x: 110, y: yBar - 70, w: 860, h: 140, r: 70 };
    const T = D.makeType('write me a cover letter', 40, F.mono, 640);
    const strike = D.makeStrike(176, 176 + T.n * T.cw, yBar + 2, 3, 8);
    cues.add('thud', 0, 0.8);
    cues.add('thud', tUsing, 0.6);
    cues.add('swoosh', tAI - 0.02, 0.6);
    cues.add('pop', tAI, 0.6);
    impact(tWrong, 24, 1);
    cues.add('buzz', tWrong + 0.05, 0.35);
    cues.add('scribble', tWrong + 0.1, 0.5, { dur: 0.3 });

    return (ctx, t) => {
      // the lazy prompt, already in the input bar at frame 0
      D.box(ctx, bar.x, bar.y, bar.w, bar.h, bar.r, t, { tone: 'bad', stroke: BRAND.border });
      D.setFont(ctx, 22, F.mono, 3);
      ctx.textAlign = 'left';
      ctx.fillStyle = BRAND.muted;
      ctx.fillText('YOUR PROMPT', 176, yBar - 22);
      D.typing(ctx, T, 176, yBar + 26, 50, t, -5, 999, { color: BRAND.text, hideCursorAfter: tWrong });
      // send button
      ctx.save();
      ctx.fillStyle = BRAND.blue;
      ctx.beginPath();
      ctx.arc(bar.x + bar.w - 70, yBar, 40, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      D.arrow(ctx, bar.x + bar.w - 70, yBar, 34, '#FFFFFF');
      D.drawStroke(ctx, strike, t, tWrong + 0.1, { color: BRAND.bad, width: 6, dur: 0.3 });

      // headline
      D.slam(ctx, "YOU'RE", L1[0].cx, 700, 104, F.k, BRAND.text, t, -0.34, { from: 1.8 });
      D.slam(ctx, 'USING', L1[1].cx, 700, 104, F.k, BRAND.text, t, -0.3);
      D.highlight(ctx, CX - 200, 735, 400, 250, t, tAI - 0.04);
      D.slam(ctx, 'AI', CX, 950, 300, F.k, BRAND.text, t, tAI - 0.04, { from: 2.2 });
      D.slam(ctx, 'WRONG.', CX, 1205, 190, F.k, BRAND.bad, t, tWrong - 0.04, { from: 2.6, glow: 'rgba(255,92,108,0.7)', rot: -0.2 });
      D.burst(ctx, CX, 1130, t, tWrong, { n: 34, seed: 2, speed: 1200, r1: 330 });
    };
  })();

  // =====================================================================
  // 2. TITLE: logo + DAY 01 + "The 4-part prompt that fixes it"
  // =====================================================================
  const title = (() => {
    const [s0] = span('title');
    const tLand = s0 + 0.5;
    const tDay = w('title', 'day');
    const tNum = w('title', '01');
    const tThe = w('title', 'the');
    const tFour = w('title', '4');
    const tThat = w('title', 'that');
    const dayW = D.measure('DAY ', 150, F.k);
    const dayLeft = CX - (dayW + D.measure('0', 150, F.k) * 1.02 * 2) / 2;
    const L1 = line(['THE', '4-PART', 'PROMPT'], 80, F.k);
    const tiles = PARTS.map((p, i) => ({ ...p, t0: tFour + 0.1 + i * 0.1 }));
    const tw = tiles.map((p) => D.measure(p.key, 26, F.x, 2) + 40);
    const gap = 16;
    const total = tw.reduce((a, b) => a + b, 0) + gap * 3;
    let tx = CX - total / 2;
    tiles.forEach((p, i) => {
      p.w = tw[i];
      p.cx = tx + tw[i] / 2;
      tx += tw[i] + gap;
      cues.add('pop', p.t0 + 0.35, 0.45);
    });
    cues.add('pop', tLand, 0.9);
    D.odoTicks('00', '01', tNum, 0.6).forEach((tt) => cues.add('tick', tt, 0.45));
    cues.add('swoosh', tThe, 0.4);
    cues.add('swoosh', tFour - 0.1, 0.5);
    cues.add('swoosh', tThat, 0.4);

    return (ctx, t) => {
      const ring = ease.outCubic(inv(tLand - 0.1, tLand + 0.4, t));
      ctx.save();
      ctx.globalAlpha = ring;
      D.dashedRing(ctx, CX, 540, 150 + (1 - ring) * 60, t, { speed: 0.8 });
      D.dashedRing(ctx, CX, 540, 192 + (1 - ring) * 90, t, { speed: -0.5, dash: [4, 12], alpha: 0.5, color: BRAND.blue2 });
      ctx.restore();
      D.fly(ctx, t, s0 - 0.05, 0.55, [960, 1250], [1000, 520], [CX, 540], 4.2, (c) => D.logo(c, 0, 0, 190, t));
      D.burst(ctx, CX, 540, t, tLand, { n: 34, seed: 9, speed: 1000, r0: 100, r1: 300 });

      D.maskUp(ctx, 'DAY ', dayLeft, 850, 150, F.k, BRAND.text, t, tDay - 0.08, { align: 'left' });
      if (t >= tDay - 0.08) {
        ctx.save();
        ctx.globalAlpha = clamp((t - tDay + 0.08) / 0.15);
        D.odometer(ctx, '00', '01', dayLeft + dayW, 850, 150, F.k, BRAND.blue, t, tNum, 0.6, { align: 'left', glow: 'rgba(56,132,255,0.7)' });
        ctx.restore();
      }
      D.highlight(ctx, L1[1].left - 14, 1000 - 70, L1[1].width + 28, 96, t, tFour - 0.1);
      D.maskUp(ctx, 'THE', L1[0].cx, 1000, 80, F.k, BRAND.text, t, tThe - 0.05);
      D.maskUp(ctx, '4-PART', L1[1].cx, 1000, 80, F.k, BRAND.text, t, tFour - 0.05);
      D.maskUp(ctx, 'PROMPT', L1[2].cx, 1000, 80, F.k, BRAND.text, t, tFour + 0.25);
      D.maskUp(ctx, 'THAT FIXES IT', CX, 1100, 80, F.k, BRAND.text, t, tThat - 0.05);
      for (const p of tiles) {
        D.fly(ctx, t, p.t0, 0.5, [p.cx + (p.cx - CX) * 2, 1700], [p.cx, 1500], [p.cx, 1225], (p.cx > CX ? 1 : -1) * 3, (c) => {
          D.box(c, -p.w / 2, -30, p.w, 60, 30, t, { stroke: BRAND.blue, fill: 'rgba(56,132,255,0.16)' });
          D.setFont(c, 26, F.x, 2);
          c.textAlign = 'center';
          c.fillStyle = BRAND.text;
          c.fillText(p.key, 0, 9);
        });
      }
    };
  })();

  // =====================================================================
  // 3. PROBLEM: lazy prompt -> generic cover letter
  // =====================================================================
  const problem = (() => {
    const [s0, s1] = span('problem');
    const tWrite = w('problem', 'write');
    const tLetter = w('problem', 'letter');
    const tSome = w('problem', 'something');
    const tGen = w('problem', 'generic');
    const P1 = D.makePanel(110, 400, 860, 170, 26);
    const P2 = D.makePanel(110, 610, 860, 400, 26);
    const T1 = D.makeType('write me a cover letter', 40, F.mono, 780);
    const reply = 'Dear Hiring Manager, I am writing to express my interest in your esteemed company. I am a hard-working team player with a passion for...';
    const T2 = D.makeType(reply, 34, F.monoM, 780);
    const cps1 = 28;
    const cps2 = 150;
    const tType2 = tLetter + 0.25;
    cues.add('type', tWrite - 0.05, 0.55, { dur: T1.n / cps1, cps: cps1 });
    cues.add('type', tType2, 0.4, { dur: T2.n / cps2, cps: 24 });
    const marks = [
      ['esteemed', tSome],
      ['hard-working', tSome + 0.18],
      ['passion', tGen],
    ].map(([s, t0], i) => {
      const f = D.typeFind(T2, s);
      const x = 150 + f.x;
      const y = 800 + f.line * 52 - 12;
      cues.add('scribble', t0, 0.5, { dur: 0.28 });
      return { ...f, len: s.length, color: BRAND.bad, t0, ring: D.makeCircle(x + f.w / 2, y, f.w / 2 + 14, 30, 40 + i) };
    });
    const tStamp = tGen + 0.2;
    impact(tStamp, 18, 0.7);
    cues.add('buzz', tStamp, 0.35);
    cues.add('riser', s1 - 0.9, 0.7, { dur: 0.9 });
    cues.add('pop', s0 + 0.05, 0.5);

    return (ctx, t) => {
      D.pill(ctx, 'WHAT MOST PEOPLE DO', CX, 330, t, s0 + 0.02, { dot: BRAND.bad, color: BRAND.text, bg: 'rgba(255,92,108,0.10)', border: 'rgba(255,92,108,0.45)' });
      const a1 = D.panel(ctx, P1, t, s0 + 0.1, { tone: 'bad' });
      if (a1 > 0) {
        ctx.save();
        ctx.globalAlpha = a1;
        D.setFont(ctx, 24, F.mono, 3);
        ctx.fillStyle = BRAND.muted;
        ctx.textAlign = 'left';
        ctx.fillText('YOU', 150, 450);
        ctx.restore();
        D.typing(ctx, T1, 150, 520, 50, t, tWrite - 0.05, cps1, { color: BRAND.text, hideCursorAfter: tType2 });
      }
      const a2 = D.panel(ctx, P2, t, tType2 - 0.4, { tone: 'bad' });
      if (a2 > 0) {
        ctx.save();
        ctx.globalAlpha = a2;
        D.logo(ctx, 166, 668, 40, t, { glow: false });
        D.setFont(ctx, 24, F.mono, 3);
        ctx.fillStyle = BRAND.muted;
        ctx.textAlign = 'left';
        ctx.fillText('AI', 200, 676);
        ctx.restore();
        D.typing(ctx, T2, 150, 800, 52, t, tType2, cps2, { color: '#C9D1E0', marks });
        for (const m of marks) D.drawStroke(ctx, m.ring, t, m.t0, { color: BRAND.bad, width: 5, dur: 0.28 });
      }
      if (t >= tStamp) {
        const p = inv(tStamp, tStamp + 0.32, t);
        const sc = lerp(2.4, 1, ease.outBack(p, 1.6));
        ctx.save();
        ctx.translate(CX, 1175);
        ctx.rotate(-0.08);
        ctx.scale(sc, sc);
        ctx.globalAlpha = clamp(p * 4);
        const sw = D.measure('SOUNDS LIKE EVERYONE', 64, F.k) + 70;
        ctx.strokeStyle = BRAND.bad;
        ctx.lineWidth = 7;
        ctx.shadowColor = BRAND.bad;
        ctx.shadowBlur = 26;
        D.rr(ctx, -sw / 2, -62, sw, 124, 18);
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255,92,108,0.12)';
        ctx.fill();
        D.setFont(ctx, 64, F.k);
        ctx.textAlign = 'center';
        ctx.fillStyle = BRAND.bad;
        ctx.fillText('SOUNDS LIKE EVERYONE', 0, 23);
        ctx.restore();
      }
    };
  })();

  // =====================================================================
  // 4. FIX: formula tiles light up while the prompt assembles itself
  // =====================================================================
  const fix = (() => {
    const [s0] = span('fix');
    const tFour = w('fix', '4');
    const tParts = w('fix', 'parts');
    const tConf = w('fix', 'confident');
    // formula row
    const tw = PARTS.map((p) => D.measure(p.key, 28, F.x, 2) + 40);
    const plus = 44;
    const total = tw.reduce((a, b) => a + b, 0) + plus * 3;
    let fx0 = CX - total / 2;
    const tiles = PARTS.map((p, i) => {
      const it = { ...p, w: tw[i], cx: fx0 + tw[i] / 2, t0: tFour + i * 0.09, tOn: w('fix', p.word) };
      fx0 += tw[i] + plus;
      return it;
    });
    tiles.forEach((p) => {
      cues.add('pop', p.t0 + 0.35, 0.45);
      cues.add('thud', p.tOn, 0.5);
    });
    impact(tParts, 12, 0.45);

    // prompt builder
    const P = D.makePanel(110, 440, 860, 840, 30);
    let y = 570;
    const secs = PARTS.map((p, i) => {
      const T = D.makeType(p.text, 33, F.monoM, 760);
      const tOn = w('fix', p.word);
      const s = { ...p, T, y, tOn, tType: tOn + 0.38, cps: 46 };
      y += 48 + T.lines.length * 46 + 34;
      cues.add('type', s.tType, 0.4, { dur: T.n / s.cps, cps: 22 });
      return s;
    });
    cues.add('ding', tConf + 0.35, 0.8);

    return (ctx, t) => {
      // tiles fly in, then light up as each part is spoken
      tiles.forEach((p, i) => {
        if (i > 0 && t >= p.t0 + 0.3) {
          ctx.save();
          ctx.globalAlpha = clamp((t - p.t0 - 0.3) / 0.2);
          D.setFont(ctx, 36, F.k);
          ctx.textAlign = 'center';
          ctx.fillStyle = BRAND.muted;
          ctx.fillText('+', p.cx - p.w / 2 - plus / 2, 360 + 13);
          ctx.restore();
        }
        D.fly(ctx, t, p.t0, 0.5, [p.cx + (p.cx - CX) * 1.6, 1300], [p.cx + (CX - p.cx), 900], [p.cx, 360], (i % 2 ? 1 : -1) * 3.2, (c) => {
          const on = ease.outCubic(inv(p.tOn - 0.05, p.tOn + 0.2, t));
          D.box(c, -p.w / 2, -32, p.w, 64, 32, t, { stroke: BRAND.border, glow: on > 0.5 ? 'rgba(56,132,255,0.6)' : undefined });
          if (on > 0) {
            c.save();
            c.globalAlpha = on;
            c.fillStyle = BRAND.blue;
            c.shadowColor = BRAND.blue;
            c.shadowBlur = 24;
            D.rr(c, -p.w / 2, -32, p.w, 64, 32);
            c.fill();
            c.restore();
          }
          D.setFont(c, 28, F.x, 2);
          c.textAlign = 'center';
          c.fillStyle = BRAND.text;
          c.fillText(p.key, 0, 10);
        });
      });

      // intro "4 PARTS" until the builder appears
      const out = ease.inCubic(inv(secs[0].tOn - 0.55, secs[0].tOn - 0.2, t));
      if (out < 1) {
        ctx.save();
        ctx.globalAlpha = 1 - out;
        if (t >= tFour - 0.1) {
          ctx.save();
          ctx.globalAlpha *= clamp((t - tFour + 0.1) / 0.1);
          D.odometer(ctx, '0', '4', CX, 860, 300, F.k, BRAND.blue, t, tFour - 0.08, 0.5, { glow: 'rgba(56,132,255,0.8)' });
          ctx.restore();
        }
        D.slam(ctx, 'PARTS', CX, 1030, 130, F.k, BRAND.text, t, tParts - 0.05);
        D.burst(ctx, CX, 800, t, tParts, { n: 30, seed: 17, speed: 1100, r1: 320 });
        ctx.restore();
      }

      const a = D.panel(ctx, P, t, secs[0].tOn - 0.45, { tone: 'good', glow: 'rgba(56,132,255,0.35)' });
      if (a <= 0) return;
      ctx.save();
      ctx.globalAlpha = a;
      D.setFont(ctx, 24, F.mono, 4);
      ctx.textAlign = 'left';
      ctx.fillStyle = BRAND.blue2;
      ctx.fillText('YOUR PROMPT', 160, 504);
      ctx.restore();
      secs.forEach((s, i) => {
        if (t < s.tOn - 0.05) return;
        const p = ease.outBack(inv(s.tOn - 0.05, s.tOn + 0.35, t), 1.4);
        ctx.save();
        ctx.globalAlpha = clamp(p * 2);
        ctx.translate((1 - p) * 60, 0);
        ctx.fillStyle = BRAND.blue;
        ctx.beginPath();
        ctx.arc(176, s.y, 20, 0, Math.PI * 2);
        ctx.fill();
        D.setFont(ctx, 24, F.k);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(String(i + 1), 176, s.y + 9);
        D.setFont(ctx, 26, F.x, 3);
        ctx.textAlign = 'left';
        ctx.fillStyle = BRAND.blue2;
        ctx.fillText(s.key, 210, s.y + 9);
        ctx.restore();
        D.typing(ctx, s.T, 160, s.y + 62, 46, t, s.tType, s.cps, {
          color: BRAND.text,
          hideCursorAfter: i < 3 ? secs[i + 1].tOn : 1e9,
        });
      });
      D.sparkles(ctx, 860, 504, t, tConf + 0.35, { seed: 3, R: 120 });
    };
  })();

  // =====================================================================
  // 5. PROOF: same AI, generic vs specific
  // =====================================================================
  const proof = (() => {
    const [s0] = span('proof');
    const tAI = w('proof', 'ai');
    const tBefore = w('proof', 'before');
    const tGen = w('proof', 'generic');
    const tAfter = w('proof', 'after');
    const chips = [
      { s: 'SPECIFIC', t0: w('proof', 'specific') },
      { s: 'CONFIDENT', t0: w('proof', 'confident') },
      { s: 'HUMAN', t0: w('proof', 'human') },
    ];
    const PB = D.makePanel(110, 470, 860, 300, 28);
    const PA = D.makePanel(110, 820, 860, 470, 28);
    const before = D.wrap('Dear Hiring Manager, I am writing to express my interest in the position at your esteemed company. I am a hard-working team player with a passion for...', 34, F.m, 780);
    const after = D.wrap("Two years in sales taught me what users actually want. Now I build it, with 3 React projects live. I'd bring that instinct to Flipkart's frontend team.", 42, F.b, 780);
    const strikes = before.map((L, i) => D.makeStrike(150, 150 + L.width, 572 + i * 46 - 11, 60 + i, 6));
    const cw = chips.map((c) => D.measure(c.s, 26, F.x, 2) + 76);
    const ctot = cw.reduce((a, b) => a + b, 0) + 16 * 2;
    let cx0 = CX - ctot / 2;
    chips.forEach((c, i) => {
      c.w = cw[i];
      c.cx = cx0 + cw[i] / 2;
      cx0 += cw[i] + 16;
      cues.add('pop', c.t0, 0.6);
    });
    cues.add('pop', tBefore, 0.5);
    cues.add('scribble', tGen, 0.6, { dur: 0.35 });
    cues.add('buzz', tGen + 0.05, 0.3);
    cues.add('pop', tAfter, 0.6);
    cues.add('ding', chips[2].t0 + 0.05, 1);
    cues.add('thud', s0 + 0.12, 0.5);

    return (ctx, t) => {
      D.maskUp(ctx, 'SAME AI', CX, 364, 90, F.k, BRAND.text, t, s0 + 0.08);
      D.fadeUp(ctx, 'same model · different prompt', CX, 424, 26, F.monoM, BRAND.muted, t, tAI);
      const a = D.panel(ctx, PB, t, Math.min(tBefore - 0.3, s0 + 0.3), { tone: 'bad' });
      if (a > 0) {
        const dim = 1 - 0.5 * ease.outCubic(inv(tGen, tGen + 0.3, t));
        D.pill(ctx, 'BEFORE', 230, 470, t, tBefore - 0.1, { size: 22, dot: BRAND.bad, color: BRAND.text, bg: '#1A1414', border: 'rgba(255,92,108,0.6)' });
        D.paragraph(ctx, before, 150, 572, 46, 34, F.m, '#AEB6C6', t, tBefore - 0.05, 0.01, { alpha: dim });
        strikes.forEach((s, i) => D.drawStroke(ctx, s, t, tGen + i * 0.05, { color: BRAND.bad, width: 5, dur: 0.25, alpha: 0.9 }));
        D.pill(ctx, 'GENERIC', 850, 470, t, tGen, { size: 22, color: '#FFFFFF', bg: BRAND.bad, border: BRAND.bad });
      }
      const b = D.panel(ctx, PA, t, tAfter - 0.3, { tone: 'good', glow: 'rgba(56,132,255,0.45)' });
      if (b > 0) {
        D.pill(ctx, 'AFTER', 222, 820, t, tAfter - 0.1, { size: 22, dot: BRAND.blue, color: BRAND.text, bg: '#0F1A30', border: BRAND.blue });
        D.paragraph(ctx, after, 150, 935, 60, 42, F.b, BRAND.text, t, tAfter - 0.02, 0.022);
        for (const c of chips) {
          if (t < c.t0) continue;
          const p = ease.outBack(inv(c.t0, c.t0 + 0.38, t), 2);
          ctx.save();
          ctx.translate(c.cx, 1232);
          ctx.scale(p, p);
          ctx.fillStyle = 'rgba(61,220,151,0.16)';
          ctx.strokeStyle = BRAND.good;
          ctx.lineWidth = 2;
          D.rr(ctx, -c.w / 2, -28, c.w, 56, 28);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = BRAND.good;
          ctx.beginPath();
          ctx.arc(-c.w / 2 + 30, 0, 15, 0, Math.PI * 2);
          ctx.fill();
          D.check(ctx, -c.w / 2 + 30, 0, 16, BRAND.bg, clamp(p));
          D.setFont(ctx, 26, F.x, 2);
          ctx.textAlign = 'left';
          ctx.fillStyle = BRAND.text;
          ctx.fillText(c.s, -c.w / 2 + 56, 9);
          ctx.restore();
        }
        D.sparkles(ctx, chips[2].cx, 1232, t, chips[2].t0, { seed: 5, R: 160, n: 9 });
      }
    };
  })();

  // =====================================================================
  // 6. RECAP: SAVE THIS + copyable template
  // =====================================================================
  const recap = (() => {
    const [s0] = span('recap');
    const tSave = w('recap', 'save');
    const rows = PARTS.map((p, i) => ({ ...p, n: String(i + 1), t0: w('recap', p.word) }));
    rows.forEach((r) => cues.add('whoosh', r.t0 - 0.05, 0.35));
    cues.add('swoosh', tSave - 0.05, 0.5);
    impact(tSave, 12, 0.45);
    cues.add('ding', tSave + 0.15, 0.6);
    const head = line(['SAVE', 'THIS'], 130, F.k, CX + 50);
    const tmpl = D.makeType('You are a [ROLE]. [TASK]. Context: [CONTEXT]. Format: [FORMAT].', 30, F.monoM, 760);
    const tTmpl = rows[2].t0 + 0.2;
    cues.add('pop', tTmpl, 0.45);
    const bookmark = (ctx, x, y, s) => {
      ctx.beginPath();
      ctx.moveTo(x - s * 0.4, y - s * 0.5);
      ctx.lineTo(x + s * 0.4, y - s * 0.5);
      ctx.lineTo(x + s * 0.4, y + s * 0.55);
      ctx.lineTo(x, y + s * 0.25);
      ctx.lineTo(x - s * 0.4, y + s * 0.55);
      ctx.closePath();
    };

    return (ctx, t) => {
      D.highlight(ctx, head[0].left - 22, 312, head[1].left + head[1].width - head[0].left + 44, 150, t, tSave - 0.05);
      D.maskUp(ctx, 'SAVE THIS', CX + 50, 440, 130, F.k, BRAND.text, t, s0 + 0.08);
      const bp = ease.outBack(inv(s0 + 0.15, s0 + 0.55, t), 1.8);
      const bump = 1 + 0.25 * Math.max(0, 1 - Math.abs(t - tSave - 0.1) / 0.2);
      if (bp > 0) {
        ctx.save();
        ctx.translate(head[0].left - 75, 392);
        ctx.scale(bp * bump, bp * bump);
        bookmark(ctx, 0, 0, 90);
        ctx.lineWidth = 8;
        ctx.lineJoin = 'round';
        ctx.strokeStyle = BRAND.text;
        ctx.stroke();
        if (t >= tSave) {
          ctx.fillStyle = BRAND.text;
          ctx.fill();
        }
        ctx.restore();
      }
      D.burst(ctx, head[0].left - 75, 392, t, tSave, { n: 22, seed: 13, speed: 800, r1: 160 });

      rows.forEach((r, i) => {
        if (t < r.t0 - 0.1) return;
        const p = ease.outBack(inv(r.t0 - 0.1, r.t0 + 0.4, t), 1.2);
        const y = 520 + i * 122;
        const dx = (1 - p) * 900;
        ctx.save();
        ctx.translate(dx, 0);
        D.box(ctx, 110, y, 860, 106, 26, t, { stroke: BRAND.border });
        ctx.fillStyle = BRAND.blue;
        ctx.shadowColor = BRAND.blue;
        ctx.shadowBlur = 18;
        ctx.beginPath();
        ctx.arc(176, y + 53, 30, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        D.setFont(ctx, 34, F.k);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(r.n, 176, y + 66);
        D.setFont(ctx, 46, F.k);
        ctx.textAlign = 'left';
        ctx.fillStyle = BRAND.text;
        ctx.fillText(r.key, 230, y + 68);
        D.setFont(ctx, 30, F.m);
        ctx.textAlign = 'right';
        ctx.fillStyle = BRAND.muted;
        ctx.fillText(r.desc, 930, y + 64);
        ctx.restore();
      });

      const pt = D.panel(ctx, D.makePanel(110, 1022, 860, 236, 26), t, tTmpl - 0.35, { tone: 'good', border: 'rgba(56,132,255,0.6)' });
      if (pt > 0) {
        ctx.save();
        ctx.globalAlpha = pt;
        D.setFont(ctx, 24, F.mono, 4);
        ctx.textAlign = 'left';
        ctx.fillStyle = BRAND.blue2;
        ctx.fillText('COPY THIS TEMPLATE', 150, 1076);
        ctx.restore();
        D.typing(ctx, tmpl, 150, 1132, 44, t, tTmpl, 100, { color: BRAND.text, hideCursorAfter: 1e9 });
      }
    };
  })();

  // =====================================================================
  // 7. TEASE: Day 02 + follow
  // =====================================================================
  const tease = (() => {
    const [s0] = span('tease');
    const t02 = w('tease', '02');
    const tMake = w('tease', 'make');
    const tExact = w('tease', 'exactly');
    const tYou = w('tease', 'you');
    const tFollow = w('tease', 'follow');
    const dayW = D.measure('DAY ', 170, F.k);
    const dayLeft = CX - (dayW + D.measure('0', 170, F.k) * 1.02 * 2) / 2;
    const L2 = line(['EXACTLY', 'LIKE', 'YOU'], 92, F.k);
    const ul = D.makeScribble(L2[2].left - 10, L2[2].left + L2[2].width + 10, 1010 + 32, 8, 6);
    D.odoTicks('01', '02', t02 - 0.05, 0.6).forEach((tt) => cues.add('tick', tt, 0.45));
    cues.add('pop', s0 + 0.08, 0.5);
    cues.add('swoosh', tMake, 0.4);
    cues.add('swoosh', tYou - 0.15, 0.5);
    cues.add('scribble', tYou + 0.05, 0.5, { dur: 0.3 });
    cues.add('riser', tFollow - 0.6, 0.5, { dur: 0.6 });
    cues.add('impact', tFollow, 0.6);
    cues.add('ding', tFollow + 0.1, 0.7);

    return (ctx, t) => {
      D.pill(ctx, 'NEXT UP', CX, 380, t, s0 + 0.05);
      D.maskUp(ctx, 'DAY ', dayLeft, 640, 170, F.k, BRAND.text, t, s0 + 0.12, { align: 'left' });
      if (t >= s0 + 0.12) {
        ctx.save();
        ctx.globalAlpha = clamp((t - s0 - 0.12) / 0.15);
        D.odometer(ctx, '01', '02', dayLeft + dayW, 640, 170, F.k, BRAND.blue, t, t02 - 0.05, 0.6, { align: 'left', glow: 'rgba(56,132,255,0.7)' });
        ctx.restore();
      }
      D.maskUp(ctx, 'MAKE AI WRITE', CX, 890, 92, F.k, BRAND.text, t, tMake - 0.05);
      D.highlight(ctx, L2[2].left - 16, 1010 - 92 + 4, L2[2].width + 32, 114, t, tYou - 0.2);
      D.maskUp(ctx, 'EXACTLY', L2[0].cx, 1010, 92, F.k, BRAND.text, t, tExact - 0.05);
      D.maskUp(ctx, 'LIKE', L2[1].cx, 1010, 92, F.k, BRAND.text, t, tExact + 0.15);
      D.slam(ctx, 'YOU', L2[2].cx, 1010, 92, F.k, BRAND.text, t, tYou - 0.1, { from: 1.9 });
      D.drawStroke(ctx, ul, t, tYou + 0.05, { color: BRAND.blue2, width: 8, dur: 0.3 });
      D.ctaButton(ctx, 'Follow for Day 02', CX, 1225, 640, 116, t, tFollow - 0.05);
      D.sparkles(ctx, CX, 1225, t, tFollow + 0.05, { seed: 8, R: 300, n: 10 });
    };
  })();

  const draws = { hook, title, problem, fix, proof, recap, tease };
  return {
    end: END,
    day: '01',
    scenes: order.map((id) => {
      const [start, end] = span(id);
      return { id, start, end, draw: draws[id] };
    }),
    transitions,
    shakes,
    glitches,
  };
};
