// DAY 03: "Stop asking AI. Make it ask YOU."
// Scene cuts land on the beat (reel.json "snap"); everything else is pinned to spoken words.

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

  // ---- scene boundaries (on the beat) & transitions ----
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

  const QA = [
    { q: 'Hours per day?', a: '2 hrs' },
    { q: 'Interview date?', a: '6 weeks' },
    { q: 'Weakest topics?', a: 'Graphs, DP' },
    { q: 'Language?', a: 'Python' },
    { q: 'Target companies?', a: 'Product cos' },
  ];
  const MAGIC = 'Before you start, ask me 5 questions you need answered.';

  // =====================================================================
  // 1. HOOK: "Stop asking AI. Make it ask you."
  // =====================================================================
  const hook = (() => {
    const tMake = w('hook', 'make');
    const tAsk = w('hook', 'ask', 1); // 0 is "asking"
    const tYou = w('hook', 'you');
    const L3 = line(['MAKE', 'IT'], 100, F.k);
    const L4 = line(['ASK', 'YOU'], 170, F.k);
    const bubble = { x: 110, y: 330, w: 860, h: 190, r: 40 };
    const qs = [
      { to: [170, 1300], from: [-120, 1700], c: [-40, 1450], spin: -3, t0: tAsk - 0.05 },
      { to: [910, 1300], from: [1200, 1700], c: [1150, 1450], spin: 3, t0: tAsk + 0.1 },
    ];
    cues.add('thud', 0, 0.8);
    cues.add('thud', tMake, 0.6);
    cues.add('swoosh', tYou - 0.12, 0.6);
    impact(tYou, 22, 0.9);
    qs.forEach((q) => cues.add('pop', q.t0 + 0.4, 0.5));

    return (ctx, t) => {
      // the AI asking you, already on screen at frame 0
      D.box(ctx, bubble.x, bubble.y, bubble.w, bubble.h, bubble.r, t, { tone: 'good' });
      D.logo(ctx, 175, 425, 64, t, { glow: false });
      D.setFont(ctx, 24, F.mono, 3);
      ctx.textAlign = 'left';
      ctx.fillStyle = BRAND.blue2;
      ctx.fillText('AI', 228, 392);
      D.setFont(ctx, 40, F.b);
      ctx.fillStyle = BRAND.text;
      ctx.fillText('Before I start, 5 quick questions', 228, 445);
      // typing dots
      for (let i = 0; i < 3; i++) {
        const b = 0.5 + 0.5 * Math.sin(t * 8 - i * 0.9);
        ctx.globalAlpha = 0.35 + 0.65 * b;
        ctx.fillStyle = BRAND.blue2;
        ctx.beginPath();
        ctx.arc(240 + i * 26, 482 - b * 5, 7, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      D.slam(ctx, 'STOP', CX, 760, 190, F.k, BRAND.bad, t, -0.32, { from: 1.8, glow: 'rgba(255,92,108,0.6)' });
      D.slam(ctx, 'ASKING AI.', CX, 880, 110, F.k, BRAND.text, t, -0.26);
      D.slam(ctx, 'MAKE', L3[0].cx, 1030, 100, F.k, BRAND.text, t, tMake - 0.05);
      D.slam(ctx, 'IT', L3[1].cx, 1030, 100, F.k, BRAND.text, t, tMake + 0.1);
      D.highlight(ctx, L4[1].left - 18, 1190 - 142, L4[1].width + 36, 172, t, tYou - 0.12);
      D.slam(ctx, 'ASK', L4[0].cx, 1190, 170, F.k, BRAND.text, t, tAsk - 0.05);
      D.slam(ctx, 'YOU', L4[1].cx, 1190, 170, F.k, BRAND.text, t, tYou - 0.05, { from: 2.6 });
      D.burst(ctx, L4[1].cx, 1120, t, tYou, { n: 34, seed: 2, speed: 1200, r1: 320 });
      for (const q of qs) {
        D.fly(ctx, t, q.t0, 0.5, q.from, q.c, q.to, q.spin, (c) => {
          D.box(c, -46, -46, 92, 92, 26, t, { glow: BRAND.blue, fill: '#18213A', stroke: BRAND.blue, lw: 3 });
          D.setFont(c, 60, F.k);
          c.textAlign = 'center';
          c.fillStyle = BRAND.blue2;
          c.fillText('?', 0, 21);
        });
      }
    };
  })();

  // =====================================================================
  // 2. TITLE: logo + DAY 03 + "Make AI interview you first"
  // =====================================================================
  const title = (() => {
    const [s0] = span('title');
    const tLand = s0 + 0.5;
    const tDay = w('title', 'day');
    const tNum = w('title', '03');
    const tMake = w('title', 'make');
    const tInt = w('title', 'interview');
    const tYou = w('title', 'you');
    const dayW = D.measure('DAY ', 150, F.k);
    const dayLeft = CX - (dayW + D.measure('0', 150, F.k) * 1.02 * 2) / 2;
    const L2 = line(['YOU', 'FIRST'], 92, F.k);
    // extra air between the highlighted word and the next one
    L2[0].left -= 20;
    L2[0].cx -= 20;
    L2[1].left += 20;
    L2[1].cx += 20;
    const ul = D.makeScribble(L2[1].left - 8, L2[1].left + L2[1].width + 8, 1150 + 30, 8, 6);
    cues.add('pop', tLand, 0.9);
    D.odoTicks('02', '03', tNum, 0.6).forEach((tt) => cues.add('tick', tt, 0.45));
    cues.add('swoosh', tMake, 0.4);
    cues.add('swoosh', tYou - 0.15, 0.5);
    cues.add('scribble', tYou + 0.3, 0.5, { dur: 0.3 });

    return (ctx, t) => {
      const ring = ease.outCubic(inv(tLand - 0.1, tLand + 0.4, t));
      ctx.save();
      ctx.globalAlpha = ring;
      D.dashedRing(ctx, CX, 560, 150 + (1 - ring) * 60, t, { speed: 0.8 });
      D.dashedRing(ctx, CX, 560, 192 + (1 - ring) * 90, t, { speed: -0.5, dash: [4, 12], alpha: 0.5, color: BRAND.blue2 });
      ctx.restore();
      D.fly(ctx, t, s0 - 0.05, 0.55, [120, 1250], [80, 520], [CX, 560], -4.2, (c) => D.logo(c, 0, 0, 190, t));
      D.burst(ctx, CX, 560, t, tLand, { n: 34, seed: 9, speed: 1000, r0: 100, r1: 300 });
      D.maskUp(ctx, 'DAY ', dayLeft, 870, 150, F.k, BRAND.text, t, tDay - 0.08, { align: 'left' });
      if (t >= tDay - 0.08) {
        ctx.save();
        ctx.globalAlpha = clamp((t - tDay + 0.08) / 0.15);
        D.odometer(ctx, '02', '03', dayLeft + dayW, 870, 150, F.k, BRAND.blue, t, tNum, 0.6, { align: 'left', glow: 'rgba(56,132,255,0.7)' });
        ctx.restore();
      }
      D.maskUp(ctx, 'MAKE AI INTERVIEW', CX, 1040, 84, F.k, BRAND.text, t, tMake - 0.05);
      D.highlight(ctx, L2[0].left - 16, 1150 - 88, L2[0].width + 32, 112, t, tYou - 0.15);
      D.maskUp(ctx, 'YOU', L2[0].cx, 1150, 92, F.k, BRAND.text, t, tYou - 0.1);
      D.maskUp(ctx, 'FIRST', L2[1].cx, 1150, 92, F.k, BRAND.blue, t, tYou + 0.1, { glow: 'rgba(56,132,255,0.5)' });
      D.drawStroke(ctx, ul, t, tYou + 0.3, { color: BRAND.blue2, width: 8, dur: 0.3 });
      D.sparkles(ctx, L2[0].cx, 1110, t, tYou, { seed: 4, R: 140 });
      void tInt;
    };
  })();

  // =====================================================================
  // 3. PROBLEM: one vague line -> AI guesses
  // =====================================================================
  const problem = (() => {
    const [s0, s1] = span('problem');
    const tType = w('problem', 'type');
    const tAnd = w('problem', 'and');
    const tFills = w('problem', 'fills');
    const tGaps = w('problem', 'gaps');
    const tGuess = w('problem', 'guesses');
    const P1 = D.makePanel(110, 400, 860, 170, 26);
    const P2 = D.makePanel(110, 610, 860, 360, 26);
    const T1 = D.makeType('make me a DSA study plan', 40, F.mono, 780);
    const T2 = D.makeType('Week 1: Arrays. Week 2: Linked lists. Week 3: Trees. Practice daily and stay consistent!', 36, F.monoM, 780);
    const cps1 = 28;
    const cps2 = 120;
    const tType2 = tAnd - 0.05;
    cues.add('type', tType - 0.05, 0.55, { dur: T1.n / cps1, cps: cps1 });
    cues.add('type', tType2, 0.4, { dur: T2.n / cps2, cps: 24 });
    const guesses = [
      { s: 'HOURS?', t0: tFills, x: 260 },
      { s: 'DEADLINE?', t0: tGaps, x: 540 },
      { s: 'LEVEL?', t0: tGuess, x: 820 },
    ];
    guesses.forEach((g) => cues.add('pop', g.t0, 0.55));
    const tStamp = tGuess + 0.3;
    impact(tStamp, 18, 0.7);
    cues.add('buzz', tStamp, 0.35);
    cues.add('riser', s1 - 0.9, 0.7, { dur: 0.9 });

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
        D.typing(ctx, T1, 150, 520, 50, t, tType - 0.05, cps1, { color: BRAND.text, hideCursorAfter: tType2 });
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
        D.typing(ctx, T2, 150, 790, 54, t, tType2, cps2, { color: '#C9D1E0' });
      }
      // what the AI had to guess
      for (const g of guesses) {
        if (t < g.t0) continue;
        const p = ease.outBack(inv(g.t0, g.t0 + 0.35, t), 2);
        const gw = D.measure(g.s, 30, F.x, 2) + 48;
        ctx.save();
        ctx.translate(g.x, 1035);
        ctx.scale(p, p);
        ctx.fillStyle = 'rgba(255,92,108,0.16)';
        ctx.strokeStyle = BRAND.bad;
        ctx.lineWidth = 2.5;
        D.rr(ctx, -gw / 2, -30, gw, 60, 30);
        ctx.fill();
        ctx.stroke();
        D.setFont(ctx, 30, F.x, 2);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#FF8A96';
        ctx.fillText(g.s, 0, 11);
        ctx.restore();
      }
      if (t >= tStamp) {
        const p = inv(tStamp, tStamp + 0.32, t);
        const sc = lerp(2.4, 1, ease.outBack(p, 1.6));
        ctx.save();
        ctx.translate(CX, 1210);
        ctx.rotate(-0.08);
        ctx.scale(sc, sc);
        ctx.globalAlpha = clamp(p * 4);
        const sw = D.measure('PURE GUESSWORK', 78, F.k) + 70;
        ctx.strokeStyle = BRAND.bad;
        ctx.lineWidth = 7;
        ctx.shadowColor = BRAND.bad;
        ctx.shadowBlur = 26;
        D.rr(ctx, -sw / 2, -66, sw, 132, 18);
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255,92,108,0.12)';
        ctx.fill();
        D.setFont(ctx, 78, F.k);
        ctx.textAlign = 'center';
        ctx.fillStyle = BRAND.bad;
        ctx.fillText('PURE GUESSWORK', 0, 28);
        ctx.restore();
      }
    };
  })();

  // =====================================================================
  // 4. FIX: one magic line -> AI asks 5 questions -> you answer -> it writes
  // =====================================================================
  const fix = (() => {
    const [s0] = span('fix');
    const tAdd = w('fix', 'add');
    const tBefore = w('fix', 'before');
    const tAsk = w('fix', 'ask');
    const tAnswer = w('fix', 'answer');
    const tWrite = w('fix', 'write');
    const P = D.makePanel(110, 380, 860, 260, 28);
    const T0 = D.makeType('make me a DSA study plan.', 32, F.monoM, 780);
    const TM = D.makeType(MAGIC, 32, F.mono, 780);
    const cpsM = 48;
    cues.add('type', tBefore - 0.05, 0.45, { dur: TM.n / cpsM, cps: 22 });
    const rows = QA.map((qa, i) => ({ ...qa, y: 690 + i * 92, tQ: tAsk + 0.1 + i * 0.16, tA: tAnswer + i * 0.12 }));
    rows.forEach((r) => {
      cues.add('pop', r.tQ, 0.5);
      cues.add('tick', r.tA, 0.6);
    });
    cues.add('ding', tWrite + 0.05, 0.9);
    impact(tWrite, 10, 0.3);

    return (ctx, t) => {
      D.pill(ctx, 'THE FIX', CX, 312, t, s0 + 0.05);
      const a = D.panel(ctx, P, t, tAdd - 0.25, { tone: 'good', glow: 'rgba(56,132,255,0.35)' });
      if (a > 0) {
        ctx.save();
        ctx.globalAlpha = a;
        D.setFont(ctx, 24, F.mono, 4);
        ctx.textAlign = 'left';
        ctx.fillStyle = BRAND.blue2;
        ctx.fillText('YOUR PROMPT', 150, 432);
        D.setFont(ctx, 32, F.monoM);
        ctx.fillStyle = BRAND.muted;
        ctx.fillText(T0.str, 150, 488);
        ctx.restore();
        // the one line that changes everything, highlighted as it types
        if (t >= tBefore - 0.05) {
          // highlight grows with the typed text, line by line
          const typed = Math.floor((t - tBefore + 0.05) * cpsM);
          ctx.save();
          ctx.fillStyle = 'rgba(56,132,255,0.22)';
          TM.lines.forEach((L, i) => {
            const vis = clamp(typed - L.start, 0, L.text.length);
            if (vis <= 0) return;
            D.rr(ctx, 140, 510 + i * 46, vis * TM.cw + 20, 42, 8);
            ctx.fill();
          });
          ctx.restore();
          D.typing(ctx, TM, 150, 542, 46, t, tBefore - 0.05, cpsM, { color: '#FFFFFF', hideCursorAfter: tAsk + 0.1 });
        }
      }
      // AI asks, you answer
      for (const r of rows) {
        if (t >= r.tQ) {
          const p = ease.outBack(inv(r.tQ, r.tQ + 0.35, t), 1.6);
          const qw = D.measure(r.q, 32, F.b) + 110;
          ctx.save();
          ctx.translate((1 - p) * -140, 0);
          ctx.globalAlpha = clamp(p * 2);
          D.box(ctx, 110, r.y - 36, qw, 72, 36, t, { tone: 'neutral', fill: 'rgba(16,21,32,0.95)', stroke: BRAND.border });
          D.logo(ctx, 150, r.y, 34, t, { glow: false, blink: false });
          D.setFont(ctx, 32, F.b);
          ctx.textAlign = 'left';
          ctx.fillStyle = BRAND.text;
          ctx.fillText(r.q, 182, r.y + 11);
          ctx.restore();
        }
        if (t >= r.tA) {
          const p = ease.outBack(inv(r.tA, r.tA + 0.35, t), 2);
          const aw = D.measure(r.a, 30, F.x, 1) + 52;
          ctx.save();
          ctx.translate(970 - aw / 2, r.y);
          ctx.scale(p, p);
          ctx.fillStyle = BRAND.blue;
          ctx.shadowColor = BRAND.blue;
          ctx.shadowBlur = 20;
          D.rr(ctx, -aw / 2, -30, aw, 60, 30);
          ctx.fill();
          ctx.shadowBlur = 0;
          D.setFont(ctx, 30, F.x, 1);
          ctx.textAlign = 'center';
          ctx.fillStyle = '#FFFFFF';
          ctx.fillText(r.a, 0, 11);
          ctx.restore();
        }
      }
      // "then let it write"
      if (t >= tWrite - 0.1) {
        const p = ease.outBack(inv(tWrite - 0.1, tWrite + 0.3, t), 1.8);
        ctx.save();
        ctx.translate(CX, 1205);
        ctx.scale(p, p);
        const label = 'NOW IT WRITES';
        const bw = D.measure(label, 34, F.x, 3) + 110;
        ctx.fillStyle = BRAND.good;
        ctx.shadowColor = BRAND.good;
        ctx.shadowBlur = 26;
        D.rr(ctx, -bw / 2, -40, bw, 80, 40);
        ctx.fill();
        ctx.shadowBlur = 0;
        D.check(ctx, -bw / 2 + 46, 0, 30, BRAND.bg, clamp(p));
        D.setFont(ctx, 34, F.x, 3);
        ctx.textAlign = 'left';
        ctx.fillStyle = BRAND.bg;
        ctx.fillText(label, -bw / 2 + 80, 12);
        ctx.restore();
        D.sparkles(ctx, CX, 1205, t, tWrite, { seed: 6, R: 220, n: 10 });
      }
    };
  })();

  // =====================================================================
  // 5. PROOF: generic plan vs a plan built for you
  // =====================================================================
  const proof = (() => {
    const [s0] = span('proof');
    const tReq = w('proof', 'request');
    const tBefore = w('proof', 'before');
    const tGen = w('proof', 'generic');
    const tAfter = w('proof', 'after');
    const tBuilt = w('proof', 'built');
    const PB = D.makePanel(110, 470, 860, 250, 28);
    const PA = D.makePanel(110, 770, 860, 520, 28);
    const before = D.wrap('Week 1: Arrays. Week 2: Linked lists. Week 3: Trees. Practice daily and stay consistent!', 34, F.m, 780);
    const strikes = before.map((L, i) => D.makeStrike(150, 150 + L.width, 572 + i * 46 - 11, 60 + i, 6));
    const plan = [
      ['6 WEEKS · 2 HRS/DAY · PYTHON', BRAND.blue2, F.x, 30],
      ['Wk 1–2   Arrays + hashing warm-up', BRAND.text, F.b, 38],
      ['Wk 3      Graphs from zero (your gap)', BRAND.text, F.b, 38],
      ['Wk 4–5   DP patterns, 2 a day', BRAND.text, F.b, 38],
      ['Wk 6      Mock interviews: product cos', BRAND.text, F.b, 38],
    ];
    cues.add('pop', tBefore, 0.5);
    cues.add('scribble', tGen, 0.6, { dur: 0.35 });
    cues.add('buzz', tGen + 0.05, 0.3);
    cues.add('pop', tAfter, 0.6);
    cues.add('ding', tBuilt + 0.1, 1);
    cues.add('thud', s0 + 0.12, 0.5);

    return (ctx, t) => {
      D.maskUp(ctx, 'SAME REQUEST', CX, 364, 76, F.k, BRAND.text, t, s0 + 0.08);
      D.fadeUp(ctx, '"make me a DSA study plan"', CX, 424, 26, F.monoM, BRAND.muted, t, tReq);
      const a = D.panel(ctx, PB, t, Math.min(tBefore - 0.3, s0 + 0.3), { tone: 'bad' });
      if (a > 0) {
        const dim = 1 - 0.5 * ease.outCubic(inv(tGen, tGen + 0.3, t));
        D.pill(ctx, 'BEFORE', 230, 470, t, tBefore - 0.1, { size: 22, dot: BRAND.bad, color: BRAND.text });
        D.paragraph(ctx, before, 150, 572, 46, 34, F.m, '#AEB6C6', t, tBefore - 0.05, 0.01, { alpha: dim });
        strikes.forEach((s, i) => D.drawStroke(ctx, s, t, tGen + i * 0.05, { color: BRAND.bad, width: 5, dur: 0.25, alpha: 0.9 }));
        D.pill(ctx, 'GENERIC', 850, 470, t, tGen, { size: 22, color: '#FFFFFF', bg: BRAND.bad, border: BRAND.bad });
      }
      const b = D.panel(ctx, PA, t, tAfter - 0.3, { tone: 'good', glow: 'rgba(56,132,255,0.45)' });
      if (b > 0) {
        D.pill(ctx, 'AFTER', 222, 770, t, tAfter - 0.1, { size: 22, dot: BRAND.blue, color: BRAND.text });
        plan.forEach(([s, col, fam, size], i) => {
          D.fadeUp(ctx, s, 150, 870 + i * 74, size, fam, col, t, tAfter + i * 0.12, { align: 'left', ls: i === 0 ? 3 : 0 });
        });
        if (t >= tBuilt) {
          const p = ease.outBack(inv(tBuilt, tBuilt + 0.4, t), 2);
          const bw = D.measure('BUILT FOR YOU', 26, F.x, 2) + 96;
          ctx.save();
          ctx.translate(930 - bw / 2, 770);
          ctx.scale(p, p);
          ctx.fillStyle = BRAND.good;
          ctx.shadowColor = BRAND.good;
          ctx.shadowBlur = 24;
          D.rr(ctx, -bw / 2, -30, bw, 60, 30);
          ctx.fill();
          ctx.shadowBlur = 0;
          D.check(ctx, -bw / 2 + 38, 0, 26, BRAND.bg, clamp(p));
          D.setFont(ctx, 26, F.x, 2);
          ctx.textAlign = 'left';
          ctx.fillStyle = BRAND.bg;
          ctx.fillText('BUILT FOR YOU', -bw / 2 + 64, 10);
          ctx.restore();
          D.sparkles(ctx, 780, 770, t, tBuilt, { seed: 5, R: 170, n: 9 });
        }
      }
    };
  })();

  // =====================================================================
  // 6. RECAP: SAVE THIS + the one line to copy
  // =====================================================================
  const recap = (() => {
    const [s0] = span('recap');
    const tSave = w('recap', 'save');
    const rows = [
      { n: '1', key: 'ASK FIRST', desc: 'Add the magic line', t0: w('recap', 'ask') },
      { n: '2', key: 'ANSWER', desc: 'Give real details', t0: w('recap', 'answer') },
      { n: '3', key: 'THEN WRITE', desc: 'Let it build for you', t0: w('recap', 'then') },
    ];
    rows.forEach((r) => cues.add('whoosh', r.t0 - 0.05, 0.35));
    cues.add('swoosh', tSave - 0.05, 0.5);
    impact(tSave, 12, 0.45);
    cues.add('ding', tSave + 0.15, 0.6);
    const head = line(['SAVE', 'THIS'], 130, F.k, CX + 50);
    const TL = D.makeType(MAGIC, 31, F.monoM, 760);
    const tTmpl = rows[1].t0 + 0.15;
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
        const y = 530 + i * 132;
        const dx = (1 - p) * 900;
        ctx.save();
        ctx.translate(dx, 0);
        D.box(ctx, 110, y, 860, 112, 28, t, { stroke: BRAND.border });
        ctx.fillStyle = BRAND.blue;
        ctx.shadowColor = BRAND.blue;
        ctx.shadowBlur = 18;
        ctx.beginPath();
        ctx.arc(176, y + 56, 30, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        D.setFont(ctx, 34, F.k);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(r.n, 176, y + 69);
        D.setFont(ctx, 46, F.k);
        ctx.textAlign = 'left';
        ctx.fillStyle = BRAND.text;
        ctx.fillText(r.key, 230, y + 71);
        D.setFont(ctx, 30, F.m);
        ctx.textAlign = 'right';
        ctx.fillStyle = BRAND.muted;
        ctx.fillText(r.desc, 930, y + 67);
        ctx.restore();
      });
      const pt = D.panel(ctx, D.makePanel(110, 960, 860, 250, 26), t, tTmpl - 0.35, { tone: 'good', border: 'rgba(56,132,255,0.6)' });
      if (pt > 0) {
        ctx.save();
        ctx.globalAlpha = pt;
        D.setFont(ctx, 24, F.mono, 4);
        ctx.textAlign = 'left';
        ctx.fillStyle = BRAND.blue2;
        ctx.fillText('COPY THIS LINE', 150, 1014);
        ctx.restore();
        D.typing(ctx, TL, 150, 1072, 46, t, tTmpl, 110, { color: BRAND.text, hideCursorAfter: 1e9 });
      }
    };
  })();

  // =====================================================================
  // 7. TEASE: Day 04 + follow
  // =====================================================================
  const tease = (() => {
    const [s0] = span('tease');
    const t04 = w('tease', '04');
    const tBreak = w('tease', 'break');
    const tInto = w('tease', 'into');
    const tSteps = w('tease', 'steps');
    const tFollow = w('tease', 'follow');
    const dayW = D.measure('DAY ', 170, F.k);
    const dayLeft = CX - (dayW + D.measure('0', 170, F.k) * 1.02 * 2) / 2;
    const L2 = line(['INTO', 'STEPS'], 92, F.k);
    const ul = D.makeScribble(L2[1].left - 10, L2[1].left + L2[1].width + 10, 1010 + 32, 8, 6);
    const stones = [0, 1, 2].map((i) => ({ x: 330 + i * 210, t0: tSteps + 0.05 + i * 0.12, n: String(i + 1) }));
    D.odoTicks('03', '04', t04 - 0.05, 0.6).forEach((tt) => cues.add('tick', tt, 0.45));
    cues.add('pop', s0 + 0.08, 0.5);
    cues.add('swoosh', tBreak, 0.4);
    cues.add('swoosh', tSteps - 0.15, 0.5);
    cues.add('scribble', tSteps + 0.05, 0.5, { dur: 0.3 });
    stones.forEach((s) => cues.add('pop', s.t0 + 0.3, 0.4));
    cues.add('riser', tFollow - 0.6, 0.5, { dur: 0.6 });
    cues.add('impact', tFollow, 0.6);
    cues.add('ding', tFollow + 0.1, 0.7);

    return (ctx, t) => {
      D.pill(ctx, 'NEXT UP', CX, 380, t, s0 + 0.05);
      D.maskUp(ctx, 'DAY ', dayLeft, 640, 170, F.k, BRAND.text, t, s0 + 0.12, { align: 'left' });
      if (t >= s0 + 0.12) {
        ctx.save();
        ctx.globalAlpha = clamp((t - s0 - 0.12) / 0.15);
        D.odometer(ctx, '03', '04', dayLeft + dayW, 640, 170, F.k, BRAND.blue, t, t04 - 0.05, 0.6, { align: 'left', glow: 'rgba(56,132,255,0.7)' });
        ctx.restore();
      }
      D.maskUp(ctx, 'BREAK BIG TASKS', CX, 890, 92, F.k, BRAND.text, t, tBreak - 0.05);
      D.highlight(ctx, L2[1].left - 16, 1010 - 92 + 4, L2[1].width + 32, 114, t, tSteps - 0.2);
      D.maskUp(ctx, 'INTO', L2[0].cx, 1010, 92, F.k, BRAND.text, t, tInto - 0.05);
      D.slam(ctx, 'STEPS', L2[1].cx, 1010, 92, F.k, BRAND.text, t, tSteps - 0.1, { from: 1.9 });
      D.drawStroke(ctx, ul, t, tSteps + 0.05, { color: BRAND.blue2, width: 8, dur: 0.3 });
      for (const s of stones) {
        D.fly(ctx, t, s.t0, 0.45, [s.x, 1500], [s.x - 60, 1300], [s.x, 1110 + (s.n - 1) * 0], 2.5, (c) => {
          D.box(c, -42, -30, 84, 60, 20, t, { stroke: BRAND.blue });
          D.setFont(c, 30, F.k);
          c.textAlign = 'center';
          c.fillStyle = BRAND.text;
          c.fillText(s.n, 0, 11);
        });
      }
      D.ctaButton(ctx, 'Follow for Day 04', CX, 1240, 640, 116, t, tFollow - 0.05);
      D.sparkles(ctx, CX, 1240, t, tFollow + 0.05, { seed: 8, R: 300, n: 10 });
    };
  })();

  const draws = { hook, title, problem, fix, proof, recap, tease };
  return {
    end: END,
    day: '03',
    scenes: order.map((id) => {
      const [start, end] = span(id);
      return { id, start, end, draw: draws[id] };
    }),
    transitions,
    shakes,
    glitches,
  };
};
