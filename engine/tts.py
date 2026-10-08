"""Voiceover: Kokoro TTS (offline) -> voice.wav + word-level timings.

Usage: python3 tts.py <reel.json> <out_dir>

The reel spec lists voice segments. Each segment is synthesized on its own,
then joined with a short gap, so every scene starts on a clean breath.
Word timings come from the phoneme durations the model predicts.
"""
import json
import re
import sys
from pathlib import Path

import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

HERE = Path(__file__).resolve().parent
MODEL = HERE / "models" / "kokoro-v1.0-timed.onnx"
VOICES = HERE / "models" / "voices-v1.0.bin"


def phoneme_words(timings):
    """Group per-phoneme timings into space-separated phoneme words."""
    words, cur = [], []
    for t in timings:
        if t.phoneme == " ":
            if cur:
                words.append(cur)
                cur = []
        else:
            cur.append(t)
    if cur:
        words.append(cur)
    out = []
    for w in words:
        # skip pure punctuation runs
        voiced = [t for t in w if re.match(r"[^\s.,!?;:…\"'()\-]", t.phoneme)]
        if not voiced:
            continue
        out.append((voiced[0].start, voiced[-1].end))
    return out


def align(text_words, ph_spans, kokoro, lang):
    """Map spoken text words to phoneme-word spans."""
    counts = []
    for w in text_words:
        p = kokoro.tokenizer.phonemize(w, lang).split()
        counts.append(max(1, len(p)))
    if sum(counts) == len(ph_spans):
        spans, i = [], 0
        for c in counts:
            spans.append((ph_spans[i][0], ph_spans[i + c - 1][1]))
            i += c
        return spans, True
    # Fallback: spread the voiced time across words by letter count
    t0, t1 = ph_spans[0][0], ph_spans[-1][1]
    lens = np.array([max(1, len(re.sub(r"\W", "", w))) for w in text_words], float)
    edges = t0 + np.concatenate([[0], np.cumsum(lens)]) / lens.sum() * (t1 - t0)
    return [(edges[i], edges[i + 1]) for i in range(len(text_words))], False


def main(spec_path, out_dir):
    spec = json.loads(Path(spec_path).read_text())
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    vcfg = spec["voice"]
    kokoro = Kokoro(str(MODEL), str(VOICES))
    lang = vcfg.get("lang", "en-us")

    voice = vcfg["name"]
    if "+" in voice:  # blend, e.g. "af_heart:0.7+af_bella:0.3"
        style = 0
        for part in voice.split("+"):
            name, w = part.split(":")
            style = style + kokoro.get_voice_style(name) * float(w)
        voice = style.astype(np.float32)

    sr = 24000
    lead = int(vcfg.get("lead_in", 0.0) * sr)
    audio = [np.zeros(lead, np.float32)]
    cursor = lead
    segments = []
    for seg in spec["segments"]:
        say = seg["say"]
        samples, sr, timings = kokoro.create_timed(
            say, voice, speed=seg.get("speed", vcfg.get("speed", 1.0)), lang=lang,
            sentence_pause=vcfg.get("sentence_pause", 0.18),
            clause_pause=vcfg.get("clause_pause", 0.08),
        )
        text_words = say.split()
        show_words = seg.get("show", say).split()
        if len(show_words) != len(text_words):
            raise SystemExit(f"[{seg['id']}] 'show' must have the same word count as 'say'")
        spans, exact = align(text_words, phoneme_words(timings), kokoro, lang)
        if not exact:
            print(f"  ! {seg['id']}: approximate word timing")
        off = cursor / sr
        words = [
            {"w": s, "start": round(off + a, 3), "end": round(off + b, 3)}
            for s, (a, b) in zip(show_words, spans)
        ]
        dur = len(samples) / sr
        segments.append({"id": seg["id"], "start": round(off, 3),
                         "end": round(off + dur, 3), "words": words})
        audio.append(samples.astype(np.float32))
        gap = int(seg.get("gap_after", vcfg.get("gap", 0.12)) * sr)
        snap = spec.get("snap")
        if snap:
            # beat sync: the next line starts `lead` seconds after a beat, so every
            # scene cut (placed `lead` before the line) lands exactly on the beat
            period = 60.0 / snap["bpm"] * snap.get("every", 1)
            lead_s = snap.get("lead", 0.1)
            earliest = (cursor + len(samples) + gap) / sr
            k = int(np.ceil((earliest - snap.get("offset", 0.0) - lead_s) / period - 1e-9))
            target = snap.get("offset", 0.0) + k * period + lead_s
            gap = int(round(target * sr)) - (cursor + len(samples))
        audio.append(np.zeros(gap, np.float32))
        cursor += len(samples) + gap
        print(f"  {seg['id']:<8} {off:6.2f}s -> {off + dur:6.2f}s  {len(text_words)} words")

    full = np.concatenate(audio)
    sf.write(out / "voice.wav", full, sr)
    total = len(full) / sr
    (out / "timeline.json").write_text(json.dumps(
        {"duration": round(total, 3), "segments": segments}, indent=1))
    n = sum(len(s["words"]) for s in segments)
    print(f"voice: {total:.2f}s, {n} words, {n / total * 60:.0f} wpm")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
