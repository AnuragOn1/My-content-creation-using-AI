"""Build timing.json for a reel: when each script segment and each word is spoken.

Sources, best first:
  1. audio/vo.words.json  word timestamps from ElevenLabs Scribe (exact)
  2. audio/vo.mp3 alone   the N-1 longest pauses split the segments, words are
                          spread across each segment by length (good enough for
                          a voiceover you recorded or made in another tool)
  3. no audio yet         estimated speaking pace, flagged "provisional"

Set "endAfterSegment" in the reel's vo block to end the reel after that line;
the voiceover is faded out there and the rest is dropped.

An optional "edit" block tightens the voiceover without regenerating it:
  "drop":       phrases to cut, e.g. [{"seg": 1, "text": "Number one."}]
  "maxPause":   longest pause kept inside a line (seconds)
  "segmentGap": pause between lines (seconds)
  "speed":      tempo change, pitch preserved (e.g. 1.2)
The edited audio is written to audio/vo.cut.wav and every word time is remapped,
so the visuals stay in sync. This needs word timings (vo.words.json).

Usage: python3 engine/align.py reels/<reel-dir>
"""

import difflib
import json
import re
import subprocess
import sys
import wave
from pathlib import Path

import numpy as np

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


def edit_voiceover(reel_dir, audio, words, edit):
    """Cut phrases and long pauses out of the voiceover, then speed it up.

    Returns the remapped words, the edited file's path (relative to the reel) and its duration.
    """
    sr = 44100
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(audio), "-ac", "1", "-ar", str(sr), "-f", "f32le", "-"],
                         capture_output=True, check=True).stdout
    x = np.frombuffer(raw, dtype=np.float32)
    src_len = len(x) / sr

    dropped = set()
    for d in edit.get("drop", []):
        target = [norm(t) for t in d["text"].split()]
        ids_in_seg = [i for i, w in enumerate(words) if w["seg"] == d["seg"]]
        for k in range(len(ids_in_seg) - len(target) + 1):
            ids = ids_in_seg[k:k + len(target)]
            if [norm(words[i]["text"]) for i in ids] == target:
                dropped.update(ids)
                break
        else:
            raise SystemExit(f"align: can't find \"{d['text']}\" in segment {d['seg']}")

    max_pause = edit.get("maxPause", 0.25)
    seg_gap = edit.get("segmentGap", 0.3)
    speed = edit.get("speed", 1.0)
    pad_in, pad_out, fade = 0.04, 0.06, int(0.008 * sr)
    pieces = []
    out = 0.0

    def take(a, b):
        clip = x[int(a * sr):int(b * sr)].copy()
        n = min(fade, len(clip) // 2)
        if n:
            clip[:n] *= np.linspace(0, 1, n)
            clip[-n:] *= np.linspace(1, 0, n)
        pieces.append(clip)
        return len(clip) / sr

    kept = [i for i in range(len(words)) if i not in dropped]
    remapped = []
    src_a = out_a = None
    for n, i in enumerate(kept):
        w = words[i]
        p = kept[n - 1] if n else None
        if p is None:
            src_a, out_a = max(0.0, w["start"] - pad_in), 0.0
        else:
            prev = words[p]
            gap = max(0.0, w["start"] - prev["end"])
            if not (i == p + 1 and w["seg"] == prev["seg"] and gap <= max_pause):
                # Close the running clip without swallowing the start of whatever follows it.
                src_b = min(prev["end"] + pad_out, words[p + 1]["start"])
                out += take(src_a, src_b)
                want = seg_gap if w["seg"] != prev["seg"] else min(gap, max_pause)
                start = max(w["start"] - pad_in, words[i - 1]["end"] if i - 1 != p else src_b)
                silence = max(0.0, want - (src_b - prev["end"]) - (w["start"] - start))
                pieces.append(np.zeros(int(silence * sr), dtype=np.float32))
                out += silence
                src_a, out_a = start, out
        remapped.append(dict(w, start=out_a + w["start"] - src_a, end=out_a + w["end"] - src_a))
    out += take(src_a, min(words[kept[-1]]["end"] + 0.15, src_len))

    cut = reel_dir / "audio" / "vo.cut.wav"
    pcm = (np.clip(np.concatenate(pieces), -1, 1) * 32767).astype(np.int16)
    tmp = cut.with_suffix(".tmp.wav")
    with wave.open(str(tmp), "wb") as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(sr)
        f.writeframes(pcm.tobytes())
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(tmp), "-af", f"atempo={speed}", str(cut)], check=True)
    tmp.unlink()
    for w in remapped:
        w["start"] /= speed
        w["end"] /= speed
    return remapped, str(cut.relative_to(reel_dir)), audio_duration(cut)


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

    # A reel can stop after an earlier line (e.g. to drop a teaser the voiceover ends with).
    last = vo.get("endAfterSegment")
    if last is not None:
        segments = segments[: last + 1]
        words = [w for w in words if w["seg"] <= last]
    vo_audio = vo["audio"]
    if vo.get("edit"):
        if source != "scribe":
            raise SystemExit("align: the voiceover edit needs word timings (audio/vo.words.json)")
        words, vo_audio, vo_duration = edit_voiceover(reel_dir, audio, words, vo["edit"])
        vo_end = vo_duration
    elif last is not None:
        vo_end = words[-1]["end"] + 0.25
    else:
        vo_end = vo_duration

    segs = []
    for i, text in enumerate(segments):
        mine = [w for w in words if w["seg"] == i]
        segs.append({"text": text, "start": round(mine[0]["start"], 3), "end": round(mine[-1]["end"], 3)})
    for w in words:
        w["start"], w["end"] = round(w["start"], 3), round(w["end"], 3)

    timing = {
        "source": source,
        "provisional": source == "provisional",
        "voAudio": vo_audio,
        "voDuration": round(vo_duration, 3),
        "voEnd": round(vo_end, 3),
        "duration": round(vo_end + reel.get("tail", 1.0), 3),
        "segments": segs,
        "words": words,
    }
    (reel_dir / "timing.json").write_text(json.dumps(timing, indent=1) + "\n")
    print(f"align: {reel_dir.name}: {len(timing['segments'])} segments, {len(timing['words'])} words, "
          f"{timing['duration']:.2f}s ({source})")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    main(sys.argv[1])
