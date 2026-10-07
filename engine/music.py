"""Synthesize a beat track for reels that have no voiceover.

Everything is generated from oscillators and noise, so the music is ours to post
and the visuals can cut exactly on its beats. D minor, i-VI-III-VII (Dm Bb F C).

Section kinds (per bar range):
  drop   four-on-the-floor kick, claps on 2 and 4, hats, pumping bass and pads, 16th arp
  build  no kick, filtered pads, 16th hats getting louder, snare roll and riser into the next bar
  outro  pads and a soft kick on the one, fading out

Usage: python3 engine/music.py <reel.json> <out.wav>   (reads the "music" block)
"""

import json
import sys
import wave

import numpy as np

SR = 48000
RNG = np.random.default_rng(11)

CHORDS = [  # one chord per bar, cycling: (bass root Hz, pad voicing Hz)
    (73.42, [146.83, 174.61, 220.00, 261.63]),   # Dm7
    (58.27, [116.54, 146.83, 174.61, 220.00]),   # Bbmaj7
    (87.31, [174.61, 220.00, 261.63, 329.63]),   # Fmaj7
    (65.41, [130.81, 164.81, 196.00, 293.66]),   # Cadd9
]


def shape(x, cutoff, kind="low", order=4):
    """Zero-phase FFT filter with a Butterworth-like magnitude response."""
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    f[0] = 1e-6
    H = 1 / (1 + (f / cutoff) ** order) if kind == "low" else 1 / (1 + (cutoff / f) ** order)
    return np.fft.irfft(X * H, n=len(x))


def saw(freq, n, detune_cents=0.0):
    t = np.arange(n) / SR
    f = freq * 2 ** (detune_cents / 1200)
    return 2 * ((f * t + RNG.random()) % 1.0) - 1


def decay(n, seconds):
    return np.exp(-np.arange(n) / (seconds * SR))


def kick(gain=1.0):
    n = int(0.4 * SR)
    t = np.arange(n) / SR
    freq = 46 + 115 * np.exp(-t / 0.035)
    body = np.sin(2 * np.pi * np.cumsum(freq) / SR) * decay(n, 0.16)
    knock = np.sin(2 * np.pi * 1800 * t) * decay(n, 0.004) * 0.35
    click = shape(RNG.standard_normal(n) * decay(n, 0.003), 2500, "high") * 0.9
    return (body * 0.75 + knock + click) * gain


def clap(gain=1.0):
    n = int(0.3 * SR)
    noise = shape(shape(RNG.standard_normal(n), 900, "high"), 6000)
    env = np.zeros(n)
    for k, off in enumerate((0.0, 0.011, 0.022)):
        s = int(off * SR)
        env[s:] += decay(n - s, 0.006 if k < 2 else 0.11)
    body = np.sin(2 * np.pi * 190 * np.arange(n) / SR) * decay(n, 0.04) * 0.3
    return (noise * env * 0.6 + body) * gain


def hat(gain=1.0, open_=False):
    n = int((0.22 if open_ else 0.05) * SR)
    noise = shape(RNG.standard_normal(n), 7500, "high", order=6)
    return noise * decay(n, 0.08 if open_ else 0.012) * gain


def add(track, sound, start_s):
    s = int(start_s * SR)
    if s >= len(track):
        return
    e = min(len(track), s + len(sound))
    track[s:e] += sound[: e - s]


def render(spec):
    bpm = spec.get("bpm", 120)
    beat = 60 / bpm
    bar = 4 * beat
    bars = spec["bars"]
    total = int((bars * bar + 2.0) * SR)
    kind_of = ["drop"] * bars
    for sec in spec.get("sections", []):
        for b in range(sec["from"], min(sec["to"], bars)):
            kind_of[b] = sec["kind"]

    drums = np.zeros(total)
    bass = np.zeros(total)
    pads = np.zeros(total)
    arp = np.zeros(total)
    fx = np.zeros(total)
    duck = np.ones(total)  # sidechain envelope from the kick

    for b in range(bars):
        kind = kind_of[b]
        t0 = b * bar
        root, voicing = CHORDS[b % 4]
        nbar = int(bar * SR)
        s0 = int(t0 * SR)

        # Pads: detuned saws, darker in builds and outros.
        chord = np.zeros(nbar)
        for f in voicing:
            for cents in (-8, 0, 8):
                chord += saw(f, nbar, cents)
        cutoff = 3600 if kind == "drop" else 1400
        if kind == "build":
            cutoff = 900 + 2600 * (b == bars - 1 or kind_of[min(b + 1, bars - 1)] != "build")
        chord = shape(chord, cutoff) / 12
        edge = np.minimum(1, np.minimum(np.arange(nbar), nbar - np.arange(nbar)) / (0.02 * SR))
        pads[s0:s0 + nbar] += chord * edge

        for q in range(4):  # beats
            tb = t0 + q * beat
            if kind == "drop" or (kind == "outro" and q == 0):
                add(drums, kick(1.0 if kind == "drop" else 0.6), tb)
                d0 = int(tb * SR)
                dn = min(len(duck) - d0, int(beat * SR))
                duck[d0:d0 + dn] = np.minimum(duck[d0:d0 + dn], 1 - 0.65 * decay(dn, 0.11))
            if kind == "drop" and q in (1, 3):
                add(drums, clap(0.9), tb)
            if kind == "drop":
                add(drums, hat(0.34), tb + beat / 2)
                add(drums, hat(0.1), tb + beat / 4)
                add(drums, hat(0.1), tb + 3 * beat / 4)
            if kind == "build":
                progress = (b - next(i for i in range(b, -1, -1) if i == 0 or kind_of[i - 1] != "build") + q / 4) / 2
                for k in range(4):
                    add(drums, hat(0.05 + 0.15 * progress), tb + k * beat / 4)

            # Bass: pumping 8ths on the root (drop), long notes otherwise.
            if kind == "drop":
                for k, mult in enumerate((1, 2)):
                    n = int(beat / 2 * SR * 0.9)
                    note = shape(saw(root * 2 * mult, n), 1100) * decay(n, 0.16)
                    add(bass, note * (0.8 if k == 0 else 1.0), tb + k * beat / 2)
            elif q == 0:
                n = int(bar * SR * 0.95)
                add(bass, shape(saw(root * 2, n), 700) * decay(n, 1.4) * 0.8, tb)

            # Arp: 16th-note pluck walking up the chord, drops only.
            if kind == "drop":
                tones = voicing + [voicing[0] * 2, voicing[2] * 2]
                for k in range(4):
                    idx = (q * 4 + k) % len(tones)
                    n = int(0.16 * SR)
                    pluck = shape(saw(tones[idx] * 2, n), 5000) * decay(n, 0.09)
                    add(arp, pluck, tb + k * beat / 4)

        # Build-up end: snare roll and riser into the next bar.
        nxt = kind_of[b + 1] if b + 1 < bars else None
        if kind == "build" and nxt != "build":
            for k in range(16):
                frac = k / 16
                add(drums, clap(0.15 + 0.4 * frac), t0 + bar / 2 + frac * bar / 2)
            n = int(bar * SR)
            ramp = np.linspace(0, 1, n)
            noise = shape(RNG.standard_normal(n), 6000) * ramp ** 2
            tone = np.sin(2 * np.pi * np.cumsum(150 + 650 * ramp ** 2) / SR) * ramp ** 3 * 0.3
            add(fx, (noise * 0.25 + tone) * 0.5, t0)
        # Impact on the first beat of each drop that follows something else.
        prev = kind_of[b - 1] if b > 0 else None
        if kind == "drop" and prev != "drop":
            n = int(1.5 * SR)
            t = np.arange(n) / SR
            sub = np.sin(2 * np.pi * np.cumsum(40 + 80 * np.exp(-t / 0.08)) / SR) * decay(n, 0.5)
            crash = shape(RNG.standard_normal(n), 4000, "high") * decay(n, 0.6) * 0.25
            add(fx, sub * 0.45 + crash * 1.6, t0)

    end = int(bars * bar * SR)
    fade = np.ones(total)
    fade[end - int(0.8 * SR):end] = np.linspace(1, 0, int(0.8 * SR))
    fade[end:] = 0

    left = drums * 0.8 + bass * 0.30 + pads * duck * 0.42 + arp * duck * 0.20 + fx
    right = left.copy()
    # A touch of width: pads and arp slightly delayed on the right channel.
    lag = int(0.012 * SR)
    wide = pads * duck * 0.42 + arp * duck * 0.20
    right[lag:] += wide[:-lag] * 0.35
    right -= wide * 0.35
    # Naive saws and noise put a lot of energy near Nyquist; AAC strips it and the
    # waveform overshoots by several dB. Roll everything off above ~15 kHz first.
    left, right = shape(left, 15000, order=8), shape(right, 15000, order=8)
    mix = np.stack([left, right], axis=1) * fade[:, None]
    mix = np.tanh(mix * 1.2) / np.tanh(1.2)
    return mix[:end] / max(1e-9, np.max(np.abs(mix))) * 0.89


def main(reel_path, out_path):
    spec = json.loads(open(reel_path).read())["music"]
    mix = render(spec)
    pcm = (mix * 32767).astype(np.int16)
    with wave.open(out_path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    print(f"music: {spec['bars']} bars at {spec.get('bpm', 120)} bpm -> {out_path}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    main(sys.argv[1], sys.argv[2])
