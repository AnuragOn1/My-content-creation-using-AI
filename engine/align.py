"""Build timing.json for a reel: when each script segment and each word is spoken.

Sources, best first:
  1. audio/vo.words.json  word timestamps from ElevenLabs Scribe (exact)
  2. audio/vo.mp3 alone   the N-1 longest pauses split the segments, words are
                          spread across each segment by length (good enough for
                          a voiceover you recorded or made in another tool)
  3. no audio yet         estimated speaking pace, flagged "provisional"

Set "endAfterSegment" in the reel's vo block to end the reel after that line;
the voiceover is faded out there and the rest is dropped.

Usage: python3 engine/align.py reels/<reel-dir>
"""

import difflib
import json
import re
import subprocess
import sys
from pathlib import Path

BREAK_FRAGMENTS = ("<break", "time=", "/>")


def norm(word):
    return re.sub(r"[^a-z0-9]", "", word.lower())


def script_words(segments):
    words = []
    for seg_index, text in enumerate(segments):
        for token in text.split():
            words.append({"text": token, "seg": seg_index})
    return words


def audio_duration(path):
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
        capture_output=True, text=True, check=True,
    )
    return float(out.stdout.strip())


def from_scribe(words, scribe_words):
    """Copy Scribe timestamps onto the script words, interpolating any it missed."""
    spoken = [w for w in scribe_words if w.get("type", "word") == "word"
              and not w["text"].startswith(BREAK_FRAGMENTS) and norm(w["text"])]
    a = [norm(w["text"]) for w in words]
    b = [norm(w["text"]) for w in spoken]
    for block in difflib.SequenceMatcher(a=a, b=b, autojunk=False).get_matching_blocks():
        for k in range(block.size):
            words[block.a + k]["start"] = spoken[block.b + k]["start"]
            words[block.a + k]["end"] = spoken[block.b + k]["end"]
    fill_gaps(words)
    return words


def fill_gaps(words):
    known = [i for i, w in enumerate(words) if "start" in w]
    if not known:
        raise SystemExit("align: no word in the transcript matched the script")
    for i, w in enumerate(words):
        if "start" in w:
            continue
        prev = max((k for k in known if k < i), default=None)
        nxt = min((k for k in known if k > i), default=None)
        lo = words[prev]["end"] if prev is not None else 0.0
        hi = words[nxt]["start"] if nxt is not None else lo + 0.4
        span = (nxt if nxt is not None else i + 1) - (prev if prev is not None else -1)
        step = (hi - lo) / span
        offset = i - (prev if prev is not None else -1)
        w["start"] = lo + step * (offset - 1)
        w["end"] = lo + step * offset


def silences(path, noise_db=-40, min_len=0.3):
    out = subprocess.run(
        ["ffmpeg", "-hide_banner", "-i", str(path), "-af",
         f"silencedetect=noise={noise_db}dB:d={min_len}", "-f", "null", "-"],
        capture_output=True, text=True,
    ).stderr
    starts = [float(x) for x in re.findall(r"silence_start: ([0-9.]+)", out)]
    ends = [float(x) for x in re.findall(r"silence_end: ([0-9.]+)", out)]
    return list(zip(starts, ends))


def spread(words, start, end):
    """Spread words across [start, end] by character count, with a beat after punctuation."""
    weights = [len(norm(w["text"])) + 2 + (3 if w["text"][-1] in ",.?!:" else 0) for w in words]
    total = sum(weights)
    t = start
    for w, weight in zip(words, weights):
        dur = (end - start) * weight / total
        w["start"], w["end"] = t, t + dur * 0.85
        t += dur


def from_pauses(words, n_segments, audio):
    duration = audio_duration(audio)
    gaps = silences(audio)
    lead = gaps[0][1] if gaps and gaps[0][0] < 0.05 else 0.0
    tail = gaps[-1][0] if gaps and gaps[-1][1] > duration - 0.05 else duration
    inner = [g for g in gaps if g[0] > lead + 0.05 and g[1] < tail - 0.05]
    cuts = sorted(sorted(inner, key=lambda g: g[1] - g[0], reverse=True)[: n_segments - 1])
    if len(cuts) < n_segments - 1:
        raise SystemExit(f"align: found {len(cuts)} pauses, need {n_segments - 1}. "
                         "Add a word-timing file or longer pauses between segments.")
    bounds = [lead] + [x for g in cuts for x in g] + [tail]
    for seg in range(n_segments):
        spread([w for w in words if w["seg"] == seg], bounds[2 * seg], bounds[2 * seg + 1])
    return words


def provisional(words, n_segments):
    t = 0.0
    for seg in range(n_segments):
        for w in (w for w in words if w["seg"] == seg):
            dur = 0.06 * len(norm(w["text"])) + 0.12
            w["start"], w["end"] = t, t + dur
            t += dur + (0.28 if w["text"][-1] in ",.?!:" else 0.04)
        t += 0.75
    return words


def main(reel_dir):
    reel_dir = Path(reel_dir)
    reel = json.loads((reel_dir / "reel.json").read_text())
    vo = reel["vo"]
    segments = vo["segments"]
    words = script_words(segments)
    audio = reel_dir / vo["audio"]
    scribe = reel_dir / vo.get("words", "audio/vo.words.json")

    if audio.exists() and scribe.exists():
        source = "scribe"
        from_scribe(words, json.loads(scribe.read_text())["words"])
        vo_duration = audio_duration(audio)
    elif audio.exists():
        source = "pauses"
        from_pauses(words, len(segments), audio)
        vo_duration = audio_duration(audio)
    else:
        source = "provisional"
        provisional(words, len(segments))
        vo_duration = words[-1]["end"] + 0.3

    segs = []
    for i, text in enumerate(segments):
        mine = [w for w in words if w["seg"] == i]
        segs.append({"text": text, "start": round(mine[0]["start"], 3), "end": round(mine[-1]["end"], 3)})
    for w in words:
        w["start"], w["end"] = round(w["start"], 3), round(w["end"], 3)

    # A reel can stop after an earlier line (e.g. to drop a teaser the voiceover ends with).
    last = vo.get("endAfterSegment")
    vo_end = round(segs[last]["end"] + 0.25, 3) if last is not None else round(vo_duration, 3)
    timing = {
        "source": source,
        "provisional": source == "provisional",
        "voDuration": round(vo_duration, 3),
        "voEnd": vo_end,
        "duration": round(vo_end + reel.get("tail", 1.0), 3),
        "segments": segs if last is None else segs[: last + 1],
        "words": words if last is None else [w for w in words if w["seg"] <= last],
    }
    (reel_dir / "timing.json").write_text(json.dumps(timing, indent=1) + "\n")
    print(f"align: {reel_dir.name}: {len(timing['segments'])} segments, {len(timing['words'])} words, "
          f"{timing['duration']:.2f}s ({source})")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    main(sys.argv[1])
