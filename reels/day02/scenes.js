// DAY 02: "Make AI write exactly like YOU"
// Every animation time is pinned to a spoken word from build/timeline.json.

module.exports = function build({ tl, cues, D, core }) {
  const { BRAND, ease, inv, clamp, lerp } = core;
  const { F } = D;
  const CX = 540;
  const w = (id, word, nth = 0) => tl.find(id, word, nth);

  // centred line of words -> per-word layout
  const line = (words, size, fam, cx = CX, gap = null) => {
    const sp = gap ?? D.measure(' ', size, fam);
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

  // =====================================================================
  // 1. HOOK
  // =====================================================================
  const hook = (() => {
    const tAI = w('hook', 'ai');
    const tWrote = w('hook', 'wrote');
    const tYour = w('hook', 'your');
    const tPost = w('hook', 'post');
    const L1 = { s: 'EVERYONE CAN TELL', size: 80, y: 760 };
    const L2 = line(['AI', 'WROTE'], 150, F.k);
    const L3 = line(['YOUR', 'POST.'], 130, F.k);
    const y2 = 925;
    const y3 = 1072;
    const ul = D.makeScribble(L3[0].left - 6, L3[1].left + L3[1].width + 6, y3 + 34, 4, 8);

    // a generic AI post, already on screen at frame 0
    const card = D.makePanel(110, 330, 860, 270, 26);
    const postTxt = "I'm thrilled to announce that I'm embarking on an exciting journey. Let's delve into this game-changing chapter!";
    const T = D.makeType(postTxt, 31, F.monoM, 790);
    const marks = ['thrilled', 'embarking', 'delve'].map((s, i) => {
      const f = D.typeFind(T, s);
      const x = 150 + f.x;
      const y = 470 + f.line * 46 - 11;
      return { ...f, len: s.length, color: BRAND.bad, t0: tAI + 0.06 + i * 0.12, ring: D.makeCircle(x + f.w / 2, y, f.w / 2 + 16, 30, 20 + i) };
    });
    marks.forEach((m) => cues.add('scribble', m.t0, 0.5, { dur: 0.3 }));

    // AI "tells" that fly in
    const tells = [
      { s: '"delve into"', to: [250, 1172], from: [-200, 1500], c: [0, 1150], spin: -3.2, t0: 0.42 },
      { s: '"game-changer"', to: [800, 1188], from: [1300, 1500], c: [1100, 1150], spin: 3.4, t0: 0.6 },
      { s: '"thrilled to announce"', to: [540, 1282], from: [540, 1900], c: [200, 1500], spin: -2.6, t0: 0.78 },
    ].map((k) => ({ ...k, width: D.measure(k.s, 30, F.mono) + 44 }));
    tells.forEach((k) => cues.add('pop', k.t0 + 0.32, 0.6));

    cues.add('thud', 0, 0.8);
    impact(tAI, 22, 0.9);
    cues.add('thud', tWrote, 0.7);
    cues.add('thud', tYour, 0.6);
    cues.add('thud', tPost, 0.8);
    cues.add('swoosh', tAI + 0.02, 0.6);
    cues.add('scribble', tPost + 0.12, 0.6, { dur: 0.4 });

    return (ctx, t) => {
      // post card (fully present at t=0, gentle float)
      ctx.save();
      ctx.translate(CX, 465);
      ctx.rotate(-0.03 + Math.sin(t * 1.4) * 0.004);
      ctx.translate(-CX, -465 + Math.sin(t * 1.7) * 4);
      ctx.globalAlpha = 0.95;
      D.panel(ctx, card, t, -1, { tone: 'bad' });
      ctx.fillStyle = '#2A3346';
      ctx.beginPath();
      ctx.arc(162, 382, 22, 0, Math.PI * 2);
      ctx.fill();
      D.rr(ctx, 198, 366, 190, 14, 7);
      ctx.fill();
      D.rr(ctx, 198, 389, 120, 11, 6);
      ctx.fill();
      D.pill(ctx, 'AI-WRITTEN', 840, 382, t, -1, { size: 20, ls: 3, color: BRAND.bad, bg: 'rgba(255,92,108,0.12)', border: 'rgba(255,92,108,0.5)' });
      D.typing(ctx, T, 150, 470, 46, t, -10, 999, { color: '#C9D1E0', marks, hideCursorAfter: -1 });
      for (const m of marks) D.drawStroke(ctx, m.ring, t, m.t0, { color: BRAND.bad, width: 5, dur: 0.3 });
      ctx.restore();

      // headline
      D.slam(ctx, L1.s, CX, L1.y, L1.size, F.k, BRAND.text, t, -0.16, { from: 1.8 });
      D.highlight(ctx, L2[0].left - 22, y2 - 132, L2[1].left + L2[1].width - L2[0].left + 44, 158, t, tAI + 0.02);
      D.slam(ctx, 'AI', L2[0].cx, y2, 150, F.k, BRAND.text, t, tAI, { from: 2.6 });
      D.slam(ctx, 'WROTE', L2[1].cx, y2, 150, F.k, BRAND.text, t, tWrote - 0.04);
      D.slam(ctx, 'YOUR', L3[0].cx, y3, 130, F.k, BRAND.text, t, tYour - 0.04);
      D.slam(ctx, 'POST.', L3[1].cx, y3, 130, F.k, BRAND.blue, t, tPost - 0.04, { glow: 'rgba(56,132,255,0.6)' });
      D.drawStroke(ctx, ul, t, tPost + 0.12, { color: BRAND.blue2, width: 9, dur: 0.4, glow: BRAND.blue });
      D.burst(ctx, CX, y2 - 60, t, tAI, { n: 30, seed: 3, speed: 1100, r1: 260 });

      for (const k of tells) {
        D.fly(ctx, t, k.t0, 0.5, k.from, k.c, k.to, k.spin, (c) => {
          D.box(c, -k.width / 2, -34, k.width, 68, 34, t, { tone: 'bad', stroke: 'rgba(255,92,108,0.6)', lw: 2.5 });
          D.setFont(c, 30, F.mono);
          c.textAlign = 'center';
          c.fillStyle = '#FF8A96';
          c.fillText(k.s, 0, 11);
          c.strokeStyle = 'rgba(255,92,108,0.9)';
          c.lineWidth = 3;
          c.beginPath();
          c.moveTo(-k.width / 2 + 20, 0);
          c.lineTo(k.width / 2 - 20, 0);
          c.stroke();
        });
      }
    };
  })();

  // =====================================================================
  // 2. TITLE: logo + DAY 02 + "Make AI write exactly like YOU"
  // =====================================================================
  const title = (() => {
    const [s0] = span('title');
    const tLand = s0 + 0.5;
    const tDay = w('title', 'day');
    const tNum = w('title', '02');
    const tMake = w('title', 'make');
    const tExact = w('title', 'exactly');
    const tYou = w('title', 'you');
    const dayW = D.measure('DAY ', 150, F.k);
    const numW = D.measure('0', 150, F.k) * 1.02 * 2;
    const dayLeft = CX - (dayW + numW) / 2;
    const L2 = line(['EXACTLY', 'LIKE', 'YOU'], 92, F.k);
    const ul = D.makeScribble(L2[2].left - 10, L2[2].left + L2[2].width + 10, 1185, 8, 6);
    cues.add('pop', tLand, 0.9);
    D.odoTicks('01', '02', tNum, 0.6).forEach((tt) => cues.add('tick', tt, 0.45));
    cues.add('swoosh', tMake, 0.4);
    cues.add('swoosh', tExact, 0.4);
    cues.add('swoosh', tYou - 0.2, 0.6);
    cues.add('pop', tYou, 0.8);
    cues.add('scribble', tYou + 0.05, 0.5, { dur: 0.3 });

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
        const a = clamp((t - tDay + 0.08) / 0.15);
        ctx.globalAlpha = a;
        D.odometer(ctx, '01', '02', dayLeft + dayW, 870, 150, F.k, BRAND.blue, t, tNum, 0.6, { align: 'left', glow: 'rgba(56,132,255,0.7)' });
        ctx.restore();
      }
      D.maskUp(ctx, 'MAKE AI WRITE', CX, 1040, 92, F.k, BRAND.text, t, tMake - 0.05);
      D.highlight(ctx, L2[2].left - 16, 1040 + 118 - 92, L2[2].width + 32, 114, t, tYou - 0.22);
      D.maskUp(ctx, 'EXACTLY', L2[0].cx, 1150, 92, F.k, BRAND.text, t, tExact - 0.05);
      D.maskUp(ctx, 'LIKE', L2[1].cx, 1150, 92, F.k, BRAND.text, t, tExact + 0.12);
      D.slam(ctx, 'YOU', L2[2].cx, 1150, 92, F.k, BRAND.text, t, tYou - 0.12, { from: 1.9 });
      D.drawStroke(ctx, ul, t, tYou + 0.05, { color: BRAND.blue2, width: 8, dur: 0.3 });
      D.sparkles(ctx, L2[2].cx, 1110, t, tYou, { seed: 4, R: 140 });
    };
  })();

  // =====================================================================
  // 3. PROBLEM: lazy prompt -> generic output
  // =====================================================================
  const problem = (() => {
    const [s0, s1] = span('problem');
    const tWrite = w('problem', 'write');
    const tAnd = w('problem', 'and');
    const tThr = w('problem', 'thrilled');
    const tEmb = w('problem', 'embark');
    const tJour = w('problem', 'journey');
    const P1 = D.makePanel(110, 400, 860, 170, 26);
    const P2 = D.makePanel(110, 610, 860, 400, 26);
    const T1 = D.makeType('write a linkedin post', 40, F.mono, 780);
    const reply = "I'm thrilled to embark on this exciting journey into the dynamic world of tech. Let's delve in!";
    const T2 = D.makeType(reply, 38, F.monoM, 780);
    const cps1 = 26;
    const cps2 = 62;
    const tType2 = tAnd - 0.02;
    cues.add('type', tWrite - 0.05, 0.55, { dur: T1.n / cps1, cps: cps1 });
    cues.add('type', tType2, 0.4, { dur: T2.n / cps2, cps: 24 });
    const marks = [
      ['thrilled', tThr],
      ['embark', tEmb],
      ['journey', tJour],
    ].map(([s, t0], i) => {
      const f = D.typeFind(T2, s);
      const x = 150 + f.x;
      const y = 800 + f.line * 58 - 13;
      cues.add('scribble', t0, 0.55, { dur: 0.3 });
      return { ...f, len: s.length, color: BRAND.bad, t0, ring: D.makeCircle(x + f.w / 2, y, f.w / 2 + 18, 34, 40 + i) };
    });
    const tStamp = tJour + 0.14;
    impact(tStamp, 18, 0.7);
    cues.add('buzz', tStamp, 0.35);
    cues.add('riser', s1 - 0.95, 0.7, { dur: 0.95 });
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
      const a2 = D.panel(ctx, P2, t, tAnd - 0.35, { tone: 'bad' });
      if (a2 > 0) {
        ctx.save();
        ctx.globalAlpha = a2;
        D.logo(ctx, 166, 668, 40, t, { glow: false });
        D.setFont(ctx, 24, F.mono, 3);
        ctx.fillStyle = BRAND.muted;
        ctx.textAlign = 'left';
        ctx.fillText('AI', 200, 676);
        ctx.restore();
        D.typing(ctx, T2, 150, 800, 58, t, tType2, cps2, { color: '#C9D1E0', marks });
        for (const m of marks) D.drawStroke(ctx, m.ring, t, m.t0, { color: BRAND.bad, width: 5, dur: 0.28 });
      }
      // stamp
      if (t >= tStamp) {
        const p = inv(tStamp, tStamp + 0.32, t);
        const sc = lerp(2.4, 1, ease.outBack(p, 1.6));
        ctx.save();
        ctx.translate(CX, 1170);
        ctx.rotate(-0.09);
        ctx.scale(sc, sc);
        ctx.globalAlpha = clamp(p * 4);
        const sw = D.measure('100% GENERIC', 84, F.k) + 70;
        ctx.strokeStyle = BRAND.bad;
        ctx.lineWidth = 7;
        ctx.shadowColor = BRAND.bad;
        ctx.shadowBlur = 26;
        D.rr(ctx, -sw / 2, -70, sw, 140, 18);
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255,92,108,0.12)';
        ctx.fill();
        D.setFont(ctx, 84, F.k);
        ctx.textAlign = 'center';
        ctx.fillStyle = BRAND.bad;
        ctx.fillText('100% GENERIC', 0, 30);
        ctx.restore();
      }
    };
  })();

  // =====================================================================
  // 4. FIX: three steps on sliding cards
  // =====================================================================
  const fix = (() => {
    const [s0] = span('fix');
    const tFix = w('fix', 'fix');
    const t3 = w('fix', '3');
    const tSteps = w('fix', 'steps');
    const tFeed = w('fix', 'feed');
    const tExtract = w('fix', 'extract');
    const tApply = w('fix', 'apply');
    const card = { x: 110, y: 470, w: 860, h: 820 };
    const swap = [tFeed - 0.12, tExtract - 0.12, tApply - 0.12];
    const steps = [
      { n: '01', title: 'FEED', sub: ['Paste 3 things you', 'actually wrote.'], tIn: swap[0], tOut: swap[1], tTitle: tFeed },
      { n: '02', title: 'EXTRACT', sub: ['Turn your tone + favorite', 'words into a style guide.'], tIn: swap[1], tOut: swap[2], tTitle: tExtract },
      { n: '03', title: 'APPLY', sub: ['Use that guide for', 'every single draft.'], tIn: swap[2], tOut: 1e9, tTitle: tApply },
    ];
    steps.forEach((s, i) => {
      cues.add('whoosh', s.tIn, 0.55);
      cues.add('thud', s.tTitle, 0.55);
    });
    cues.add('thud', tFix, 0.7);
    D.odoTicks('0', '3', t3 - 0.05, 0.55).forEach((tt) => cues.add('tick', tt, 0.4));
    impact(tSteps, 14, 0.5);

    // step 1: sample tiles
    const tThree = w('fix', '3', 1);
    const tiles = [
      { label: 'TEXTS', to: [270, 1040], from: [-150, 700], c: [60, 1300], spin: -3.5, t0: tThree - 0.1 },
      { label: 'EMAILS', to: [540, 1040], from: [540, 1700], c: [900, 1500], spin: 3.2, t0: tThree + 0.12 },
      { label: 'POSTS', to: [810, 1040], from: [1250, 700], c: [1050, 1300], spin: -3, t0: tThree + 0.32 },
    ];
    tiles.forEach((k) => cues.add('pop', k.t0 + 0.38, 0.6));
    const tActually = w('fix', 'actually');
    const ulA = D.makeScribble(158, 162 + D.measure('actually', 44, F.b), 784, 12, 5);
    cues.add('scribble', tActually, 0.45, { dur: 0.3 });

    // step 2: extract prompt + style guide chips
    const T2 = D.makeType('Analyze my 3 samples. Write my style guide: tone, sentence length, favorite words.', 30, F.monoM, 760);
    const tT2 = w('fix', 'ask') - 0.05;
    const cps2 = 46;
    cues.add('type', tT2, 0.4, { dur: T2.n / cps2, cps: 22 });
    const tGuide = w('fix', 'guide');
    const chipsTxt = ['TONE: DIRECT', 'SHORT SENTENCES', "SAYS 'SHIP'", "NEVER 'THRILLED'"];
    const chipT = [w('fix', 'words'), w('fix', 'into'), w('fix', 'style'), tGuide];
    chipT.forEach((t0) => cues.add('pop', t0, 0.55));
    cues.add('ding', tGuide + 0.1, 0.8);
    const P2a = D.makePanel(150, 812, 780, 190, 22);
    const P2b = D.makePanel(150, 1030, 780, 236, 22);

    // step 3: apply prompt + every-draft checklist
    const T3 = D.makeType('Using my style guide, write a LinkedIn post about my 3rd React project.', 30, F.monoM, 760);
    const tT3 = w('fix', 'use') - 0.05;
    const cps3 = 50;
    cues.add('type', tT3, 0.4, { dur: T3.n / cps3, cps: 22 });
    const P3a = D.makePanel(150, 812, 780, 190, 22);
    const outs = ['POSTS', 'EMAILS', 'COVER LETTERS'];
    const outT = [w('fix', 'every') - 0.05, w('fix', 'every') + 0.1, w('fix', 'draft')];
    outT.forEach((t0) => cues.add('pop', t0, 0.5));
    cues.add('ding', w('fix', 'draft') + 0.15, 0.7);

    const slideX = (s, t) => {
      const pin = ease.outBack(inv(s.tIn, s.tIn + 0.5, t), 1.1);
      const pout = ease.inCubic(inv(s.tOut, s.tOut + 0.32, t));
      return (1 - pin) * 1150 - pout * 1250;
    };

    const drawStep = (ctx, s, i, t) => {
      if (t < s.tIn || t > s.tOut + 0.34) return;
      const dx = slideX(s, t);
      ctx.save();
      ctx.translate(dx, 0);
      if (D.theme.glass) {
        // glass mode: a solid number sits BEHIND the card, so the glass refracts it
        ctx.save();
        D.rr(ctx, card.x, card.y, card.w, card.h, 34);
        ctx.clip();
        D.setFont(ctx, 330, F.k);
        ctx.textAlign = 'right';
        const ng = ctx.createLinearGradient(0, card.y, 0, card.y + 290);
        ng.addColorStop(0, 'rgba(140,190,255,0.40)');
        ng.addColorStop(1, 'rgba(56,132,255,0.18)');
        ctx.fillStyle = ng;
        ctx.fillText(s.n, card.x + card.w - 16 + dx * 0.55, card.y + 290);
        ctx.restore();
      }
      // card body
      D.box(ctx, card.x, card.y, card.w, card.h, 34, t, { glow: 'rgba(56,132,255,0.35)', fill: 'rgba(16,21,32,0.96)', stroke: 'rgba(56,132,255,0.55)', lw: 3 });
      // parallax outline number, clipped to the card
      ctx.save();
      if (D.theme.glass) ctx.globalAlpha = 0;
      D.rr(ctx, card.x, card.y, card.w, card.h, 34);
      ctx.clip();
      D.setFont(ctx, 330, F.k);
      ctx.textAlign = 'right';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(56,132,255,0.28)';
      ctx.strokeText(s.n, card.x + card.w + 30 + dx * 0.55, card.y + 300);
      ctx.restore();
      // label + title + subtitle
      D.setFont(ctx, 26, F.mono, 4);
      ctx.textAlign = 'left';
      ctx.fillStyle = BRAND.blue2;
      ctx.fillText(`STEP ${s.n}`, card.x + 50, card.y + 72);
      D.maskUp(ctx, s.title, card.x + 46, card.y + 188, 112, F.k, BRAND.text, t, s.tTitle - 0.06, { align: 'left' });
      s.sub.forEach((ln, k) => D.fadeUp(ctx, ln, card.x + 50, card.y + 256 + k * 54, 44, F.b, BRAND.text, t, s.tTitle + 0.15 + k * 0.08, { align: 'left' }));
      if (i === 0) stepFeed(ctx, t);
      if (i === 1) stepExtract(ctx, t);
      if (i === 2) stepApply(ctx, t);
      ctx.restore();
    };

    const stepFeed = (ctx, t) => {
      D.drawStroke(ctx, ulA, t, tActually, { color: BRAND.blue, width: 7, dur: 0.3 });
      for (const k of tiles) {
        D.fly(ctx, t, k.t0, 0.5, k.from, k.c, k.to, k.spin, (c) => {
          c.save();
          D.box(c, -110, -140, 220, 280, 22, t, { glow: 'rgba(56,132,255,0.5)', fill: '#18213A', stroke: BRAND.blue, lw: 3 });
          c.fillStyle = BRAND.blue;
          D.rr(c, -80, -108, 52, 52, 12);
          c.fill();
          c.fillStyle = '#2E3B57';
          for (let r = 0; r < 4; r++) {
            D.rr(c, -80, -28 + r * 30, r === 3 ? 100 : 160, 12, 6);
            c.fill();
          }
          D.setFont(c, 26, F.x, 2);
          c.textAlign = 'center';
          c.fillStyle = BRAND.text;
          c.fillText(k.label, 0, 128);
          c.restore();
        });
        D.burst(ctx, k.to[0], k.to[1], t, k.t0 + 0.38, { n: 14, seed: k.to[0], speed: 600, r1: 150 });
      }
    };

    const stepExtract = (ctx, t) => {
      const a = D.panel(ctx, P2a, t, tExtract + 0.25, { glass: false, fill: 'rgba(8,10,16,0.55)', fillAlpha: 1, border: 'rgba(255,255,255,0.12)' });
      if (a > 0) D.typing(ctx, T2, 186, 866, 44, t, tT2, cps2, { color: BRAND.text, hideCursorAfter: chipT[0] });
      const b = D.panel(ctx, P2b, t, chipT[0] - 0.3, { glass: false, border: BRAND.blue, glow: 'rgba(56,132,255,0.35)', fill: 'rgba(56,132,255,0.12)', fillAlpha: 1 });
      if (b > 0) {
        ctx.save();
        ctx.globalAlpha = b;
        D.setFont(ctx, 24, F.mono, 3);
        ctx.fillStyle = BRAND.blue2;
        ctx.textAlign = 'left';
        ctx.fillText('MY STYLE GUIDE', 186, 1080);
        ctx.restore();
        const pos = [[186, 1112], [500, 1112], [186, 1184], [500, 1184]];
        chipsTxt.forEach((s, k) => {
          const t0 = chipT[k];
          if (t < t0) return;
          const p = ease.outBack(inv(t0, t0 + 0.35, t), 2);
          const cw = D.measure(s, 26, F.x, 1) + 40;
          ctx.save();
          ctx.translate(pos[k][0] + cw / 2, pos[k][1] + 25);
          ctx.scale(p, p);
          ctx.fillStyle = 'rgba(56,132,255,0.18)';
          ctx.strokeStyle = BRAND.blue;
          ctx.lineWidth = 2;
          D.rr(ctx, -cw / 2, -25, cw, 50, 25);
          ctx.fill();
          ctx.stroke();
          D.setFont(ctx, 26, F.x, 1);
          ctx.textAlign = 'center';
          ctx.fillStyle = BRAND.text;
          ctx.fillText(s, 0, 9);
          ctx.restore();
        });
        const pc = ease.outCubic(inv(tGuide + 0.05, tGuide + 0.4, t));
        if (pc > 0) {
          ctx.save();
          ctx.fillStyle = BRAND.good;
          ctx.shadowColor = BRAND.good;
          ctx.shadowBlur = 20;
          ctx.beginPath();
          ctx.arc(880, 1072, 22 * ease.outBack(clamp(pc * 1.5), 2), 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          D.check(ctx, 880, 1072, 24, BRAND.bg, pc);
          D.sparkles(ctx, 880, 1072, t, tGuide + 0.1, { seed: 21, R: 90 });
        }
      }
    };

    const stepApply = (ctx, t) => {
      const a = D.panel(ctx, P3a, t, tApply + 0.25, { glass: false, fill: 'rgba(8,10,16,0.55)', fillAlpha: 1, border: 'rgba(255,255,255,0.12)' });
      if (a > 0) D.typing(ctx, T3, 186, 866, 44, t, tT3, cps3, { color: BRAND.text });
      outs.forEach((s, k) => {
        const t0 = outT[k];
        if (t < t0) return;
        const p = ease.outBack(inv(t0, t0 + 0.4, t), 1.6);
        const y = 1076 + k * 72;
        ctx.save();
        ctx.globalAlpha = clamp(p * 2);
        ctx.translate((1 - p) * 120, 0);
        ctx.fillStyle = BRAND.good;
        ctx.beginPath();
        ctx.arc(196, y, 20, 0, Math.PI * 2);
        ctx.fill();
        D.check(ctx, 196, y, 22, BRAND.bg, clamp(p));
        D.setFont(ctx, 38, F.x, 1);
        ctx.textAlign = 'left';
        ctx.fillStyle = BRAND.text;
        ctx.fillText(s, 236, y + 13);
        ctx.restore();
      });
      D.sparkles(ctx, 600, 1150, t, outT[2] + 0.1, { seed: 31, R: 200 });
    };

    return (ctx, t) => {
      D.pill(ctx, 'THE FIX', CX, 330, t, s0 + 0.05);
      // progress pills
      const pa = ease.outCubic(inv(tFeed - 0.3, tFeed, t));
      if (pa > 0) {
        ctx.save();
        ctx.globalAlpha = pa;
        for (let k = 0; k < 3; k++) {
          const x = CX - 150 + k * 104 - 46;
          const fill = ease.outCubic(inv(swap[k], swap[k] + 0.4, t));
          ctx.fillStyle = '#1E2638';
          D.rr(ctx, x, 398, 92, 12, 6);
          ctx.fill();
          if (fill > 0) {
            ctx.fillStyle = BRAND.blue;
            ctx.shadowColor = BRAND.blue;
            ctx.shadowBlur = 14;
            D.rr(ctx, x, 398, 92 * fill, 12, 6);
            ctx.fill();
            ctx.shadowBlur = 0;
          }
        }
        ctx.restore();
      }
      // intro: big "3 STEPS", exits as the first card arrives
      const out = ease.inCubic(inv(swap[0] - 0.15, swap[0] + 0.2, t));
      if (out < 1) {
        ctx.save();
        ctx.globalAlpha = 1 - out;
        ctx.translate(CX, 800);
        ctx.scale(1 - out * 0.3, 1 - out * 0.3);
        ctx.translate(-CX, -800);
        D.slam(ctx, 'FIX IT IN', CX, 640, 96, F.k, BRAND.text, t, tFix - 0.05, { from: 1.8 });
        if (t >= t3 - 0.1) {
          ctx.save();
          ctx.globalAlpha *= clamp((t - t3 + 0.1) / 0.1);
          D.odometer(ctx, '0', '3', CX, 900, 280, F.k, BRAND.blue, t, t3 - 0.05, 0.55, { glow: 'rgba(56,132,255,0.8)' });
          ctx.restore();
        }
        D.slam(ctx, 'STEPS', CX, 1060, 130, F.k, BRAND.text, t, tSteps - 0.05);
        D.burst(ctx, CX, 800, t, tSteps, { n: 30, seed: 17, speed: 1100, r1: 320 });
        ctx.restore();
      }
      steps.forEach((s, i) => drawStep(ctx, s, i, t));
    };
  })();

  // =====================================================================
  // 5. PROOF: before vs after
  // =====================================================================
  const proof = (() => {
    const [s0] = span('proof');
    const tReq = w('proof', 'request');
    const tBefore = w('proof', 'before');
    const tRobot = w('proof', 'robot');
    const tAfter = w('proof', 'after');
    const tYou = w('proof', 'you');
    const PB = D.makePanel(110, 470, 860, 330, 28);
    const PA = D.makePanel(110, 840, 860, 410, 28);
    const before = D.wrap("I'm thrilled to announce that I've embarked on an exciting journey into the dynamic world of software engineering! Grateful for this opportunity.", 36, F.m, 780);
    const after = D.wrap("Sales taught me to listen. Code is teaching me to build. Project #3 broke twice before it shipped. Here's what fixed it ↓", 48, F.b, 780);
    const strikes = before.map((L, i) => D.makeStrike(150, 150 + L.width, 588 + i * 50 - 12, 60 + i, 7));
    cues.add('pop', tBefore, 0.5);
    cues.add('scribble', tRobot, 0.6, { dur: 0.35 });
    cues.add('buzz', tRobot + 0.05, 0.3);
    cues.add('pop', tAfter, 0.6);
    cues.add('ding', tYou + 0.02, 1);
    cues.add('thud', s0 + 0.12, 0.5);

    return (ctx, t) => {
      D.maskUp(ctx, 'SAME REQUEST', CX, 364, 76, F.k, BRAND.text, t, s0 + 0.08);
      D.fadeUp(ctx, '"write a linkedin post about my 3rd react project"', CX, 424, 25, F.monoM, BRAND.muted, t, tReq);
      // BEFORE
      const a = D.panel(ctx, PB, t, tBefore - 0.3, { tone: 'bad' });
      if (a > 0) {
        const dim = 1 - 0.5 * ease.outCubic(inv(tRobot, tRobot + 0.3, t));
        D.pill(ctx, 'BEFORE', 230, 470, t, tBefore - 0.1, { size: 22, dot: BRAND.bad, color: BRAND.text, bg: '#1A1414', border: 'rgba(255,92,108,0.6)' });
        D.paragraph(ctx, before, 150, 588, 50, 36, F.m, '#AEB6C6', t, tBefore - 0.05, 0.012, { alpha: dim });
        strikes.forEach((s, i) => D.drawStroke(ctx, s, t, tRobot + i * 0.05, { color: BRAND.bad, width: 5, dur: 0.25, alpha: 0.9 }));
        D.pill(ctx, 'ROBOT', 860, 470, t, tRobot, { size: 22, color: '#FFFFFF', bg: BRAND.bad, border: BRAND.bad });
      }
      // AFTER
      const b = D.panel(ctx, PA, t, tAfter - 0.3, { border: BRAND.blue, glow: 'rgba(56,132,255,0.45)', fill: '#0F1A30', tone: 'good' });
      if (b > 0) {
        D.pill(ctx, 'AFTER', 222, 840, t, tAfter - 0.1, { size: 22, dot: BRAND.blue, color: BRAND.text, bg: '#0F1A30', border: BRAND.blue });
        D.paragraph(ctx, after, 150, 968, 68, 48, F.b, BRAND.text, t, tAfter - 0.02, 0.022);
        if (t >= tYou) {
          const p = ease.outBack(inv(tYou, tYou + 0.4, t), 2);
          ctx.save();
          const bw = D.measure('SOUNDS LIKE YOU', 26, F.x, 2) + 96;
          ctx.translate(930 - bw / 2, 840);
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
          ctx.fillText('SOUNDS LIKE YOU', -bw / 2 + 64, 10);
          ctx.restore();
          D.sparkles(ctx, 780, 840, t, tYou, { seed: 5, R: 170, n: 9 });
        }
      }
    };
  })();

  // =====================================================================
  // 6. RECAP: save-worthy summary
  // =====================================================================
  const recap = (() => {
    const [s0] = span('recap');
    const tSave = w('recap', 'save');
    const rows = [
      { n: '1', title: 'FEED', desc: 'Paste 3 real samples', t0: w('recap', 'feed') },
      { n: '2', title: 'EXTRACT', desc: 'Get your style guide', t0: w('recap', 'extract') },
      { n: '3', title: 'APPLY', desc: 'Use it on every draft', t0: w('recap', 'apply') },
    ];
    rows.forEach((r) => cues.add('whoosh', r.t0 - 0.05, 0.35));
    cues.add('swoosh', tSave - 0.05, 0.5);
    impact(tSave, 12, 0.45);
    cues.add('ding', tSave + 0.15, 0.6);
    const head = line(['SAVE', 'THIS'], 130, F.k, CX + 50);
    const tip = D.wrap('Paste your style guide into Custom Instructions or a Project, so every chat writes like you.', 34, F.m, 700);
    const tTip = rows[2].t0 + 0.35;
    cues.add('pop', tTip, 0.4);

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
      // bookmark icon
      const bp = ease.outBack(inv(s0 + 0.15, s0 + 0.55, t), 1.8);
      const bump = 1 + 0.25 * Math.max(0, 1 - Math.abs(t - tSave - 0.1) / 0.2);
      if (bp > 0) {
        ctx.save();
        ctx.translate(head[0].left - 75, 392);
        ctx.scale(bp * bump, bp * bump);
        const fillOn = t >= tSave;
        bookmark(ctx, 0, 0, 90);
        ctx.lineWidth = 8;
        ctx.lineJoin = 'round';
        ctx.strokeStyle = BRAND.text;
        ctx.stroke();
        if (fillOn) {
          ctx.fillStyle = BRAND.text;
          ctx.fill();
        }
        ctx.restore();
      }
      D.burst(ctx, head[0].left - 75, 392, t, tSave, { n: 22, seed: 13, speed: 800, r1: 160 });

      rows.forEach((r, i) => {
        if (t < r.t0 - 0.1) return;
        const p = ease.outBack(inv(r.t0 - 0.1, r.t0 + 0.4, t), 1.2);
        const y = 540 + i * 150;
        const dx = (1 - p) * 900;
        ctx.save();
        ctx.translate(dx, 0);
        D.box(ctx, 110, y, 860, 128, 26, t, { stroke: BRAND.border });
        // parallax outline digit
        ctx.save();
        D.rr(ctx, 110, y, 860, 128, 26);
        ctx.clip();
        D.setFont(ctx, 200, F.k);
        ctx.textAlign = 'right';
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(56,132,255,0.22)';
        ctx.strokeText(r.n, 950 + dx * 0.4, y + 170);
        ctx.restore();
        ctx.fillStyle = BRAND.blue;
        ctx.shadowColor = BRAND.blue;
        ctx.shadowBlur = 18;
        ctx.beginPath();
        ctx.arc(182, y + 64, 34, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        D.setFont(ctx, 40, F.k);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(r.n, 182, y + 79);
        D.setFont(ctx, 50, F.k);
        ctx.textAlign = 'left';
        ctx.fillStyle = BRAND.text;
        ctx.fillText(r.title, 244, y + 60);
        D.setFont(ctx, 32, F.m);
        ctx.fillStyle = BRAND.muted;
        ctx.fillText(r.desc, 244, y + 104);
        ctx.restore();
      });

      const pt = D.panel(ctx, D.makePanel(110, 1000, 860, 250, 26), t, tTip - 0.35, { border: 'rgba(56,132,255,0.6)', fill: '#0F1A30', tone: 'good' });
      if (pt > 0) {
        ctx.save();
        ctx.globalAlpha = pt;
        D.setFont(ctx, 24, F.mono, 4);
        ctx.textAlign = 'left';
        ctx.fillStyle = BRAND.blue2;
        ctx.fillText('PRO TIP', 150, 1056);
        ctx.restore();
        D.paragraph(ctx, tip, 150, 1112, 46, 34, F.m, BRAND.text, t, tTip, 0.012);
      }
    };
  })();

  // =====================================================================
  // 7. TEASE: next up + follow
  // =====================================================================
  const tease = (() => {
    const [s0] = span('tease');
    const t03 = w('tease', '03');
    const tMake = w('tease', 'make');
    const tAsk = w('tease', 'ask');
    const tYou = w('tease', 'you');
    const tFirst = w('tease', 'first');
    const tFollow = w('tease', 'follow');
    const dayW = D.measure('DAY ', 170, F.k);
    const numW = D.measure('0', 170, F.k) * 1.02 * 2;
    const dayLeft = CX - (dayW + numW) / 2;
    const L1 = line(['MAKE', 'AI', 'ASK', 'YOU'], 90, F.k);
    const L2 = line(['QUESTIONS', 'FIRST'], 90, F.k);
    const ul = D.makeScribble(L2[1].left - 8, L2[1].left + L2[1].width + 8, 1000 + 30, 14, 7);
    D.odoTicks('02', '03', t03 - 0.05, 0.6).forEach((tt) => cues.add('tick', tt, 0.45));
    cues.add('pop', s0 + 0.08, 0.5);
    cues.add('swoosh', tMake, 0.4);
    cues.add('swoosh', tYou - 0.1, 0.5);
    cues.add('scribble', tFirst, 0.5, { dur: 0.35 });
    cues.add('riser', tFollow - 0.6, 0.5, { dur: 0.6 });
    cues.add('impact', tFollow, 0.6);
    cues.add('ding', tFollow + 0.1, 0.7);
    const qs = [
      { to: [150, 575], from: [-100, 1100], c: [-50, 700], spin: -3, t0: tAsk },
      { to: [930, 575], from: [1200, 1100], c: [1150, 700], spin: 3, t0: tAsk + 0.15 },
    ];
    qs.forEach((q) => cues.add('pop', q.t0 + 0.4, 0.45));

    return (ctx, t) => {
      D.pill(ctx, 'NEXT UP', CX, 380, t, s0 + 0.05);
      D.maskUp(ctx, 'DAY ', dayLeft, 640, 170, F.k, BRAND.text, t, s0 + 0.12, { align: 'left' });
      if (t >= s0 + 0.12) {
        ctx.save();
        ctx.globalAlpha = clamp((t - s0 - 0.12) / 0.15);
        D.odometer(ctx, '02', '03', dayLeft + dayW, 640, 170, F.k, BRAND.blue, t, t03 - 0.05, 0.6, { align: 'left', glow: 'rgba(56,132,255,0.7)' });
        ctx.restore();
      }
      D.highlight(ctx, L1[3].left - 14, 880 - 84, L1[3].width + 28, 108, t, tYou - 0.12);
      ['MAKE', 'AI', 'ASK', 'YOU'].forEach((s, i) => {
        const t0 = i < 2 ? tMake - 0.05 + i * 0.08 : i === 2 ? tAsk - 0.05 : tYou - 0.08;
        D.maskUp(ctx, s, L1[i].cx, 880, 90, F.k, BRAND.text, t, t0);
      });
      D.maskUp(ctx, 'QUESTIONS', L2[0].cx, 1000, 90, F.k, BRAND.text, t, w('tease', 'questions') - 0.05);
      D.maskUp(ctx, 'FIRST', L2[1].cx, 1000, 90, F.k, BRAND.blue, t, tFirst - 0.05, { glow: 'rgba(56,132,255,0.5)' });
      D.drawStroke(ctx, ul, t, tFirst + 0.05, { color: BRAND.blue2, width: 8, dur: 0.35 });
      for (const q of qs) {
        D.fly(ctx, t, q.t0, 0.5, q.from, q.c, q.to, q.spin, (c) => {
          D.box(c, -46, -46, 92, 92, 24, t, { glow: BRAND.blue, fill: '#18213A', stroke: BRAND.blue, lw: 3 });
          D.setFont(c, 60, F.k);
          c.textAlign = 'center';
          c.fillStyle = BRAND.blue2;
          c.fillText('?', 0, 21);
        });
      }
      D.ctaButton(ctx, 'Follow for Day 03', CX, 1225, 640, 116, t, tFollow - 0.05);
      D.sparkles(ctx, CX, 1225, t, tFollow + 0.05, { seed: 8, R: 300, n: 10 });
    };
  })();

  const draws = { hook, title, problem, fix, proof, recap, tease };
  return {
    end: END,
    day: '02',
    scenes: order.map((id) => {
      const [start, end] = span(id);
      return { id, start, end, draw: draws[id] };
    }),
    transitions,
    shakes,
    glitches,
  };
};
