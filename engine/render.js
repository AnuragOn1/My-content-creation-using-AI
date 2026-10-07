#!/usr/bin/env node
// Reel renderer.
//   node render.js <reelDir> cues                 -> build/cues.json (SFX cue sheet)
//   node render.js <reelDir> stills 0,1.5,3 [flags] [dir] -> PNG stills
//        flags (comma-separated): nocap, clean (no shake/glitch), scene=<id> (force one scene)
//   node render.js <reelDir> range f0 f1 out.mp4   -> one encoded chunk
//   node render.js <reelDir> video [workers]       -> build/video.mp4 (silent)

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { createCanvas } = require('@napi-rs/canvas');
const core = require('./lib/core');
const D = require('./lib/draw');
const fx = require('./lib/fx');

const { W, H, FPS, Timeline, Cues } = core;

function makeRenderer(reelDir) {
  const build = path.join(reelDir, 'build');
  const tl = new Timeline(JSON.parse(fs.readFileSync(path.join(build, 'timeline.json'), 'utf8')));
  const cues = new Cues();
  const S = require(path.resolve(reelDir, 'scenes.js'))({ tl, cues, D, core, fx });
  const bg = new fx.Background();
  const post = new fx.Post();
  const shake = new fx.Shake(S.shakes);
  const caps = fx.buildCaptions(tl.words());
  const out = createCanvas(W, H);
  const L = createCanvas(W, H);
  const BG = createCanvas(W, H);
  const spec = JSON.parse(fs.readFileSync(path.join(reelDir, 'reel.json'), 'utf8'));
  D.theme.glass = process.env.GLASS || spec.glass || null;

  const drawScene = (ctx, sc, t) => {
    ctx.save();
    fx.camera(ctx, t, sc.start, sc.end);
    sc.draw(ctx, t);
    ctx.restore();
  };

  function render(t, opts = {}) {
    const ctx = out.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    const tr = opts.scene ? null : S.transitions.find((x) => t >= x.at - x.dur / 2 && t < x.at + x.dur / 2);
    const p = tr ? (t - (tr.at - tr.dur / 2)) / tr.dur : 0;
    const streak = tr && tr.type === 'whip' ? 1 - Math.abs(p - 0.5) * 2 : 0;
    if (tr) {
      // scenes render on a transparent layer mid-transition; glass needs the background under it
      bg.draw(BG.getContext('2d'), t, streak);
      ctx.drawImage(BG, 0, 0);
      D.theme.under = BG;
    } else {
      bg.draw(ctx, t, streak);
      D.theme.under = null;
    }

    const sh = opts.clean ? null : shake.at(t);
    ctx.save();
    if (sh) ctx.translate(sh[0], sh[1]);
    if (tr) {
      const i = S.scenes.findIndex((s) => Math.abs(s.start - tr.at) < 1e-6);
      const sc = p < 0.5 ? S.scenes[i - 1] : S.scenes[i];
      const lctx = L.getContext('2d');
      lctx.setTransform(1, 0, 0, 1, 0, 0);
      lctx.clearRect(0, 0, W, H);
      drawScene(lctx, sc, t);
      if (tr.type === 'circle') fx.circleWipe(ctx, L, L, p);
      else fx.whipPan(ctx, L, L, p);
    } else {
      const sc = (opts.scene && S.scenes.find((s) => s.id === opts.scene)) ||
        S.scenes.find((s) => t >= s.start && t < s.end) || S.scenes[S.scenes.length - 1];
      drawScene(ctx, sc, t);
    }
    ctx.restore();

    post.bloom(out, 0.34);
    if (!opts.noChip) D.dayChip(ctx, S.day, t);
    if (!opts.noCaptions) fx.drawCaptions(ctx, caps, t);
    const g = opts.clean ? null : S.glitches.find((e) => t >= e.t && t < e.t + e.dur);
    if (g) post.glitch(out, g.amp * (1 - (t - g.t) / g.dur), Math.floor(t * FPS) + 7);
    post.vignette(ctx);
    return out;
  }

  return { render, S, tl, cues, frames: Math.ceil(S.end * FPS), build };
}

function encoder(outFile) {
  return spawn('ffmpeg', [
    '-y', '-loglevel', 'error',
    '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', String(FPS), '-i', '-',
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '9', '-pix_fmt', 'yuv420p', outFile,
  ], { stdio: ['pipe', 'inherit', 'inherit'] });
}

async function renderRange(reelDir, f0, f1, outFile) {
  const R = makeRenderer(reelDir);
  const ff = encoder(outFile);
  const done = new Promise((res, rej) => ff.on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg ' + c)))));
  for (let f = f0; f < f1; f++) {
    const c = R.render(f / FPS);
    const buf = Buffer.from(c.data());
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
  }
  ff.stdin.end();
  await done;
}

async function main() {
  const [reelDir, mode, ...rest] = process.argv.slice(2);
  if (!reelDir || !mode) {
    console.error('usage: render.js <reelDir> cues|stills|range|video ...');
    process.exit(1);
  }
  if (mode === 'cues') {
    const R = makeRenderer(reelDir);
    const data = { duration: R.S.end, cues: R.cues.sorted() };
    fs.writeFileSync(path.join(R.build, 'cues.json'), JSON.stringify(data, null, 1));
    console.log(`cues: ${data.cues.length}, duration ${R.S.end.toFixed(2)}s, ${R.frames} frames`);
  } else if (mode === 'stills') {
    const R = makeRenderer(reelDir);
    const dir = rest[2] || path.join(R.build, 'stills');
    fs.mkdirSync(dir, { recursive: true });
    const flags = (rest[1] || '').split(',');
    const opts = {
      noCaptions: flags.includes('nocap'),
      clean: flags.includes('clean'),
      scene: (flags.find((f) => f.startsWith('scene=')) || '').slice(6) || null,
    };
    for (const ts of rest[0].split(',')) {
      const t = parseFloat(ts);
      const c = R.render(t, opts);
      const name = path.join(dir, `t${t.toFixed(2).padStart(6, '0')}.png`);
      fs.writeFileSync(name, c.toBuffer('image/png'));
      console.log(name);
    }
  } else if (mode === 'range') {
    await renderRange(reelDir, +rest[0], +rest[1], rest[2]);
  } else if (mode === 'video') {
    const R = makeRenderer(reelDir);
    const n = +(rest[0] || 4);
    const tmp = path.join(R.build, 'chunks');
    fs.mkdirSync(tmp, { recursive: true });
    const per = Math.ceil(R.frames / n);
    const t0 = Date.now();
    const jobs = [];
    const list = [];
    for (let k = 0; k < n; k++) {
      const f0 = k * per;
      const f1 = Math.min(R.frames, f0 + per);
      if (f0 >= f1) break;
      const file = path.join(tmp, `c${k}.mp4`);
      list.push(`file '${path.resolve(file)}'`);
      jobs.push(new Promise((res, rej) => {
        const p = spawn(process.execPath, [__filename, reelDir, 'range', f0, f1, file], { stdio: 'inherit' });
        p.on('close', (c) => (c === 0 ? res() : rej(new Error(`chunk ${k} failed`))));
      }));
    }
    await Promise.all(jobs);
    fs.writeFileSync(path.join(tmp, 'list.txt'), list.join('\n'));
    await new Promise((res, rej) => {
      const p = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(tmp, 'list.txt'), '-c', 'copy', path.join(R.build, 'video.mp4')], { stdio: 'inherit' });
      p.on('close', (c) => (c === 0 ? res() : rej(new Error('concat failed'))));
    });
    console.log(`video: ${R.frames} frames in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
