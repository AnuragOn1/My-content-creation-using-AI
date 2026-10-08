# AI for builders: daily Reels

Production repo for a faceless Instagram series that teaches one AI skill a day. Each reel is generated from two files: a voice script and a scene file. Voice, captions, motion graphics, music and SFX all come out of one command.

## What's in each day

```
reels/day02/
  day02.mp4        ready to post: 1080x1920, 30fps, H.264 + AAC, ~32s, 25 MB
  day02_cover.jpg  cover (the hook frame, no captions)
  caption.txt      Instagram caption + hashtags
  script.md        voiceover + on-screen text, scene by scene
  higgsfield.md    optional B-roll prompts
  qa_sheet.png     14 frames across the reel for a quick visual check
  reel.json        voiceover lines (what gets spoken)
  scenes.js        motion design, keyed to spoken words
```

## Pipeline

| Step | Tool | Output |
|------|------|--------|
| Voice | `engine/tts.py`: Kokoro TTS (offline, Apache-2.0), female `af_heart` | `voice.wav` + word timestamps from the model's own phoneme durations |
| Cue sheet | `engine/render.js cues`: every animation registers its SFX | `cues.json` |
| Audio | `engine/audio.py`: original procedural beat (sidechain pump), synthesized SFX, voice ducking, loudness to −13.6 LUFS / −1.5 dBTP | `mix.wav` |
| Video | `engine/render.js video`: Skia canvas, 4 parallel workers (~35s per reel) | `video.mp4` |
| Final | `engine/make.py`: mux + light film grain, cover, QA sheet | `dayXX.mp4` |

```bash
engine/setup.sh                                # once per machine: deps + TTS model
cd engine && python3 make.py ../reels/day02    # full rebuild, ~2 min
node render.js ../reels/day02 stills 1.5,9.6   # spot-check frames
```

## Making the next day

1. Copy `reels/day02` to `reels/day03` and set `"day": 3`.
2. Write the voiceover in `reel.json`: one segment per section (hook, title, problem, fix, proof, recap, tease). Aim for about 85 words, which comes out near 30s.
3. Adapt `scenes.js`. Animations are pinned to spoken words (`w('fix', 'extract')`), so timing follows the voice automatically.
4. `python3 make.py ../reels/day03`, then review `qa_sheet.png`.

## Brand

Colors: blue `#3884FF` · light blue `#8CBEFF` · background `#080A10` · text `#F2F5FA` · muted `#8C96AA` · panel `#101520` · border `#323E56`.
Fonts: Inter Display (ExtraBold/Black) for headlines and captions, JetBrains Mono for prompts. Both are OFL and live in `engine/fonts`.
Panels: blue liquid glass (`"glass": "blue"` in reel.json; see `engine/lib/glass.js`).
Logo: an original terminal-prompt tile (blue rounded square, dark `>`, blinking white `_`), drawn in code in `engine/lib/draw.js`.

## Posting checklist

- [ ] Post 7–9 PM IST, upload `dayXX_cover.jpg` as the cover
- [ ] Paste `caption.txt`; turn on Instagram's **AI label** (AI voice + visuals)
- [ ] Optional: add a trending sound at ~5%
- [ ] First hour: reply to every comment, share to Story, send to friends
- [ ] After 48h: log views, average watch time, saves, shares and follows below

## Results log

| Day | Posted | Length | Views (48h) | Avg watch | Saves | Shares | Follows | Notes |
|-----|--------|--------|-------------|-----------|-------|--------|---------|-------|
| 01 | | 33.5s (remade, was 41s) | | | | | | |
| 02 | | 32.4s, 4K | | | | | | |
| 03 | | 29.9s, 4K, liquid glass, beat-synced | | | | | | |

## 4K renders

Set `"res": 2` in a reel's `reel.json` to render natively at 2160×3840: text, lines and glass are drawn at 4K, not upscaled. `"grain": 0` turns off film grain, which Instagram's re-compression smears. A 4K build takes about 7 minutes and comes out around 60 MB.
On Instagram, turn on **Settings → Data usage and media quality → Upload at highest quality** before posting, or the app compresses the upload more.
