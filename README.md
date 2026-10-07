# My content creation using AI

Upload-ready Instagram Reels for a faceless-by-default page about using AI to its full capacity, tied to an engineering career push. Each reel is code: an HTML page animated frame by frame, rendered to MP4 with its voiceover or a synthesized beat. Editing a reel means editing its text and rendering again.

**Brand:** electric blue `#3884FF` on black, Inter + JetBrains Mono (`brand/brand.css`).

## Reels

| Reel | Folder | Audio | Status |
| --- | --- | --- | --- |
| I turned my portfolio into a motion graphic | `reels/portfolio-motion-graphics` | synthesized 120 BPM track, no voiceover | ready to post |
| 5 things I use Claude for every day (30 LPA prep) | `reels/five-things-claude` | ElevenLabs voice "Utkarsh" | ready to post |

Each reel folder has a `caption.md` with the caption, hashtags, pinned comment and cover frame.

## Render a reel

Needs Node 18+, Python 3 with numpy, and ffmpeg.

```bash
npm install
npx playwright install chromium        # first time only
node engine/render.mjs reels/portfolio-motion-graphics
node engine/render.mjs reels/five-things-claude
```

The MP4 and a cover PNG land in `exports/` (not committed). Useful options:

- `--still 3.7`: write one frame as PNG, to check a moment without rendering everything
- `--set credit="CLAUDE"`: override any value in the reel's `params` (here, the "made with" credit)
- `--to 10`: render only the first 10 seconds

To preview a reel live with a scrub bar, run `npx serve .` and open `reels/<reel>/index.html`.

## How it works

```
engine/
  render.mjs   headless Chromium steps through the reel frame by frame, ffmpeg encodes,
               then mixes effects + music/voice and normalises to -14 LUFS (Instagram's level)
  runtime.js   browser helpers every reel uses: timing lookups, easing, dot grid, captions
  align.py     voiceover reels: word timestamps -> timing.json, so text lands on the spoken word
  music.py     beat reels: synthesizes the track (drums, bass, pads, riser, drop)
  sfx.py       synthesizes the whooshes, hits, ticks and typing sounds each reel asks for
```

All audio is generated or ElevenLabs-made, so there is nothing to license.

### Voiceover reels

1. Write the script lines in `reel.json` → `vo.segments`.
2. Generate the voiceover in ElevenLabs (voice **Utkarsh – Viral UGC Content Creator**, `0S6xG2aDSxyTDcYrV1oo`, model `eleven_multilingual_v2`, with `<break time="0.7s" />` between lines). Save it as `audio/vo.mp3`.
3. Optional but best: transcribe it with ElevenLabs Scribe and save the word timings as `audio/vo.words.json`. Without that file, `align.py` splits the lines at the longest pauses.
4. Render.

To shorten a reel without regenerating the voice, add a `vo.edit` block: phrases to `drop`, a `maxPause`, a `segmentGap` and a `speed`. `align.py` cuts the audio at the word timestamps and re-times every slide to match (see `reels/five-things-claude/reel.json`).

## Decisions so far

- **Standalone reels.** These reels are not part of the "Day 1, Day 2…" series: no day tag, no next-day teaser.
- **Voice is male.** Utkarsh replaced the female voice (Rhea) used earlier.
- **ElevenLabs free tier is disabled** on the account ("unusual activity", most likely from generating on a cloud server). New voiceovers need a paid plan, a different tool, or a recorded MP3.
- **Photo approved** for the portfolio reel. The page stays faceless elsewhere unless decided otherwise.
- **The portfolio stays red** inside the portfolio reel so it matches the live site; the reel's own graphics stay brand blue.

See `plan/content-plan.md` for the weekly rhythm, hook patterns and idea backlog.
