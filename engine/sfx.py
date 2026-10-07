"""Synthesize the sound-effects track for a reel from the cue list the page exports.

No sample packs and no music licences: every sound is generated here, so the
track is ours to post. Cue types: hit, whoosh, riser, tick, type, pop, ping.
A quiet ambient bed runs underneath unless the reel turns it off.

Usage: python3 engine/sfx.py <events.json> <out.wav>
events.json: {"duration": 31.2, "bed": true, "events": [{"t": 0.0, "type": "hit", "gain": 1.0}, ...]}
"""

import json
import sys
import wave

import numpy as np

SR = 48000
RNG = np.random.default_rng(7)  # fixed seed: the same reel always renders the same audio


def env_exp(n, decay_s):
    return np.exp(-np.arange(n) / (decay_s * SR))


def one_pole_lowpass(x, cutoff_hz):
    """Lowpass with a per-sample cutoff (scalar or array)."""
    cutoff = np.broadcast_to(np.asarray(cutoff_hz, dtype=float), x.shape)
    alpha = 1 - np.exp(-2 * np.pi * cutoff / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i in range(len(x)):
        acc += alpha[i] * (x[i] - acc)
        y[i] = acc
    return y


def hit():
    n = int(0.6 * SR)
    t = np.arange(n) / SR
    freq = 45 + 75 * np.exp(-t / 0.05)
    body = np.sin(2 * np.pi * np.cumsum(freq) / SR) * env_exp(n, 0.22)
    click = RNG.standard_normal(n) * env_exp(n, 0.004) * 0.35
    return (body + click) * 0.8


def whoosh():
    n = int(0.55 * SR)
    shape = np.sin(np.pi * np.linspace(0, 1, n) ** 0.7) ** 2
    cutoff = 300 + 4200 * shape
    return one_pole_lowpass(RNG.standard_normal(n), cutoff) * shape * 0.55


def riser():
    n = int(1.1 * SR)
    ramp = np.linspace(0, 1, n)
    noise = one_pole_lowpass(RNG.standard_normal(n), 200 + 5000 * ramp ** 2) * ramp ** 2
    tone = np.sin(2 * np.pi * np.cumsum(180 + 520 * ramp ** 2) / SR) * ramp ** 3 * 0.25
    return (noise * 0.45 + tone) * 0.6


def tick():
    n = int(0.03 * SR)
    t = np.arange(n) / SR
    return np.sin(2 * np.pi * 2600 * t) * env_exp(n, 0.006) * 0.35


def type_click():
    n = int(0.018 * SR)
    burst = np.diff(RNG.standard_normal(n + 1)) * env_exp(n, 0.003)
    return burst * (0.10 + 0.05 * RNG.random())


def pop():
    n = int(0.09 * SR)
    t = np.arange(n) / SR
    freq = 660 + 400 * np.exp(-t / 0.02)
    return np.sin(2 * np.pi * np.cumsum(freq) / SR) * env_exp(n, 0.03) * 0.4


def ping():
    n = int(1.0 * SR)
    t = np.arange(n) / SR
    bell = (np.sin(2 * np.pi * 1318.5 * t) * env_exp(n, 0.35)
            + 0.5 * np.sin(2 * np.pi * 2637 * t) * env_exp(n, 0.15)
            + 0.25 * np.sin(2 * np.pi * 3955 * t) * env_exp(n, 0.07))
    return bell * 0.28


SOUNDS = {"hit": hit, "whoosh": whoosh, "riser": riser, "tick": tick,
          "type": type_click, "pop": pop, "ping": ping}
# Risers build up to their cue; everything else starts on it.
ALIGN_END = {"riser"}


def bed(duration):
    """Low D-minor-add9 pad with a slow breathing swell, sitting well under the voice."""
    n = int(duration * SR)
    t = np.arange(n) / SR
    pad = np.zeros(n)
    for freq, amp in ((73.42, 0.5), (146.83, 0.35), (220.0, 0.22), (329.63, 0.12), (349.23, 0.06)):
        detune = 1 + 0.0015 * np.sin(2 * np.pi * 0.07 * t + freq)
        pad += amp * np.sin(2 * np.pi * freq * detune * t)
    swell = 0.75 + 0.25 * np.sin(2 * np.pi * t / 8.0)
    fade = np.minimum(1, t / 1.5) * np.minimum(1, (duration - t) / 1.5)
    return pad * swell * np.clip(fade, 0, 1) * 0.05


def main(events_path, out_path):
    spec = json.loads(open(events_path).read())
    duration = spec["duration"]
    mix = np.zeros(int((duration + 1.5) * SR))
    if spec.get("bed", True):
        b = bed(duration)
        mix[: len(b)] += b
    for ev in spec["events"]:
        sound = SOUNDS[ev["type"]]() * ev.get("gain", 1.0)
        start = int(ev["t"] * SR) - (len(sound) if ev["type"] in ALIGN_END else 0)
        start = max(0, start)
        end = min(len(mix), start + len(sound))
        mix[start:end] += sound[: end - start]
    mix = mix[: int(duration * SR)]
    peak = np.max(np.abs(mix)) or 1.0
    if peak > 0.89:
        mix *= 0.89 / peak
    pcm = (np.repeat(mix[:, None], 2, axis=1) * 32767).astype(np.int16)
    with wave.open(out_path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    print(f"sfx: {len(spec['events'])} cues, {duration:.2f}s -> {out_path}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    main(sys.argv[1], sys.argv[2])
