#!/usr/bin/env node
// Render a reel to an upload-ready MP4 (1080x1920, 30 fps, H.264 + AAC, -14 LUFS).
//
//   node engine/render.mjs reels/day04-five-things-claude
//   node engine/render.mjs reels/day03-motion-graphics --set credit="Claude"
//
// Options:
//   --set key=value   override a reel param (repeatable), e.g. --set credit="..."
//   --still <sec>     only write a PNG of that moment (for checking a frame)
//   --to <sec>        stop early (quick partial render)
//   --no-bed          leave out the ambient pad under the voiceover
//
// Pipeline: align.py (timing.json, voiceover reels only) -> headless Chromium
// renders each frame -> ffmpeg encodes -> sfx.py builds the effects track and
// music.py the beat (music reels only) -> mix with the voiceover.

import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const EXPORTS = path.join(ROOT, "exports");

function parseArgs(argv) {
  const opts = { set: {}, bed: true };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--set") {
      const [k, ...v] = argv[++i].split("=");
      opts.set[k] = v.join("=");
    } else if (a === "--still") opts.still = Number(argv[++i]);
    else if (a === "--to") opts.to = Number(argv[++i]);
    else if (a === "--no-bed") opts.bed = false;
    else rest.push(a);
  }
  if (rest.length !== 1) {
    console.error("usage: node engine/render.mjs <reel-dir> [--set k=v] [--still sec] [--to sec] [--no-bed]");
    process.exit(1);
  }
  opts.reelDir = path.resolve(rest[0]);
  return opts;
}

function run(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: "inherit" });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(" ")} exited with ${r.status}`);
}

const TYPES = {
  ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".woff2": "font/woff2", ".png": "image/png", ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml", ".mp3": "audio/mpeg",
};

function serve(root) {
  const server = http.createServer((req, res) => {
    const file = path.join(root, decodeURIComponent(new URL(req.url, "http://x").pathname));
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { "content-type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((ok) => server.listen(0, "127.0.0.1", () => ok(server)));
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const reel = JSON.parse(fs.readFileSync(path.join(opts.reelDir, "reel.json"), "utf8"));
  const id = reel.id || path.basename(opts.reelDir);
  fs.mkdirSync(EXPORTS, { recursive: true });

  if (reel.vo) run("python3", [path.join(ROOT, "engine/align.py"), opts.reelDir]);
  const timing = reel.vo ? JSON.parse(fs.readFileSync(path.join(opts.reelDir, "timing.json"), "utf8")) : null;
  const timingSource = timing ? timing.source : "beat grid";

  const server = await serve(ROOT);
  const url = `http://127.0.0.1:${server.address().port}/${path.relative(ROOT, opts.reelDir)}/index.html`;
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  page.on("pageerror", (e) => console.error("page error:", e.message));
  await page.addInitScript((p) => { window.__RENDER_PARAMS__ = p; }, opts.set);
  await page.goto(url);
  await page.waitForFunction(() => window.REEL, null, { timeout: 30000 });
  const meta = await page.evaluate(() => ({ duration: REEL.duration, fps: REEL.fps, events: REEL.events, cover: REEL.cover }));
  const cdp = await page.context().newCDPSession(page);
  const grab = async (format = "jpeg") => {
    const { data } = await cdp.send("Page.captureScreenshot", {
      format, quality: format === "jpeg" ? 95 : undefined, optimizeForSpeed: true,
      clip: { x: 0, y: 0, width: 1080, height: 1920, scale: 1 },
    });
    return Buffer.from(data, "base64");
  };
  const frameAt = async (t, i) => {
    await page.evaluate(([t, i]) => REEL.render(t, i), [t, i]);
  };

  if (opts.still !== undefined) {
    await frameAt(opts.still, Math.round(opts.still * meta.fps));
    const out = path.join(EXPORTS, `${id}-at-${opts.still.toFixed(2)}s.png`);
    fs.writeFileSync(out, await grab("png"));
    console.log(`still -> ${path.relative(ROOT, out)}`);
    await browser.close();
    server.close();
    return;
  }

  const duration = Math.min(meta.duration, opts.to ?? Infinity);
  const total = Math.ceil(duration * meta.fps);
  const silentVideo = path.join(EXPORTS, `.${id}.video.mp4`);
  const ff = spawn("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error",
    "-f", "image2pipe", "-c:v", "mjpeg", "-framerate", String(meta.fps), "-i", "-",
    "-c:v", "libx264", "-preset", "medium", "-crf", "16", "-pix_fmt", "yuv420p",
    "-profile:v", "high", "-r", String(meta.fps), silentVideo], { stdio: ["pipe", "inherit", "inherit"] });
  const ffDone = new Promise((ok, fail) => ff.on("close", (c) => (c === 0 ? ok() : fail(new Error(`ffmpeg exited ${c}`)))));

  const started = Date.now();
  for (let i = 0; i < total; i++) {
    await frameAt(i / meta.fps, i);
    const buf = await grab();
    if (!ff.stdin.write(buf)) await new Promise((ok) => ff.stdin.once("drain", ok));
    if (i % meta.fps === 0 || i === total - 1) {
      const pct = (((i + 1) / total) * 100).toFixed(0).padStart(3);
      process.stdout.write(`\rrender ${id}: ${pct}%  frame ${i + 1}/${total}  ${((Date.now() - started) / 1000).toFixed(0)}s`);
    }
  }
  ff.stdin.end();
  await ffDone;
  process.stdout.write("\n");

  // Cover image for the Reels grid.
  await frameAt(meta.cover, Math.round(meta.cover * meta.fps));
  const coverPath = path.join(EXPORTS, `${id}-cover.png`);
  fs.writeFileSync(coverPath, await grab("png"));
  await browser.close();
  server.close();

  // Sound effects track, then the final mix with the voiceover.
  const eventsPath = path.join(EXPORTS, `.${id}.events.json`);
  const sfxPath = path.join(EXPORTS, `.${id}.sfx.wav`);
  fs.writeFileSync(eventsPath, JSON.stringify({ duration, bed: opts.bed && reel.bed !== false, events: meta.events.filter((e) => e.t <= duration) }));
  run("python3", [path.join(ROOT, "engine/sfx.py"), eventsPath, sfxPath]);

  // Audio stems: effects always, the beat for music reels, the voiceover when there is one.
  const stems = [{ file: sfxPath, gain: reel.sfxGain ?? 0.9 }];
  const musicPath = path.join(EXPORTS, `.${id}.music.wav`);
  if (reel.music) {
    run("python3", [path.join(ROOT, "engine/music.py"), path.join(opts.reelDir, "reel.json"), musicPath]);
    stems.push({ file: musicPath, gain: reel.music.gain ?? 1.0 });
  }
  const vo = reel.vo ? path.join(opts.reelDir, timing.voAudio || reel.vo.audio || "audio/vo.mp3") : null;
  const voMissing = Boolean(vo) && !fs.existsSync(vo);
  if (vo && !voMissing) {
    const cut = timing.voEnd < timing.voDuration - 0.05 ? timing.voEnd : null;
    stems.push({ file: vo, gain: 1.0, mono: true, trim: cut });
  }

  const out = path.join(EXPORTS, `${id}${voMissing ? "-NO-VOICEOVER" : ""}${opts.to ? "-partial" : ""}.mp4`);
  const mixPath = path.join(EXPORTS, `.${id}.mix.wav`);
  const chains = stems.map((st, k) =>
    `[${k}:a]aresample=48000${st.mono ? ",pan=stereo|c0=c0|c1=c0" : ""}` +
    `${st.trim ? `,afade=t=out:st=${(st.trim - 0.2).toFixed(3)}:d=0.2,atrim=end=${st.trim.toFixed(3)}` : ""},volume=${st.gain}[s${k}]`);
  const graph = `${chains.join(";")};${stems.map((_, k) => `[s${k}]`).join("")}amix=inputs=${stems.length}:duration=longest:normalize=0,lowpass=f=16000,lowpass=f=16000[a]`;
  run("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", ...stems.flatMap((st) => ["-i", st.file]),
    "-filter_complex", graph, "-map", "[a]", "-t", duration.toFixed(3), "-c:a", "pcm_f32le", mixPath]);

  // Two-pass loudness normalisation to Instagram's -14 LUFS, then a limiter so
  // peaks stay below -1.5 dBTP after Instagram re-encodes the audio.
  const target = "I=-14:TP=-1.5:LRA=11";
  const probe = spawnSync("ffmpeg", ["-hide_banner", "-i", mixPath, "-af", `loudnorm=${target}:print_format=json`, "-f", "null", "-"], { encoding: "utf8" });
  const m = JSON.parse(probe.stderr.slice(probe.stderr.lastIndexOf("{")));
  const second = `loudnorm=${target}:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}` +
    `:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true,alimiter=limit=0.74:level=false,aresample=48000`;
  run("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", "-i", silentVideo, "-i", mixPath, "-af", second,
    "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
    "-t", duration.toFixed(3), "-movflags", "+faststart", out]);
  for (const f of [silentVideo, eventsPath, sfxPath, musicPath, mixPath]) fs.rmSync(f, { force: true });

  console.log(`done -> ${path.relative(ROOT, out)}  (${duration.toFixed(2)}s, timing: ${timingSource})`);
  console.log(`cover -> ${path.relative(ROOT, coverPath)}`);
  if (voMissing) console.log("note: no voiceover file yet, so this export has no voice. Add the audio file and render again.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
