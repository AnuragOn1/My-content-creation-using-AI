"""Find the tempo and beat grid of a music track, for beat-synced reels.

Usage: python3 beats.py <track.mp3|wav|m4a> [--start 12.5] [--dur 35]

Prints the BPM, where the first beat falls (relative to --start), and the
"snap" block to paste into reel.json. Uses spectral-flux onsets + autocorrelation.
"""
import argparse
import json
import subprocess

import numpy as np

SR = 22050
HOP = 256


def load(path, start, dur):
    cmd = ["ffmpeg", "-v", "error", "-ss", str(start), "-t", str(dur), "-i", path,
           "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"]
    return np.frombuffer(subprocess.run(cmd, capture_output=True, check=True).stdout, np.float32)


def onset_envelope(x):
    n = 1024
    win = np.hanning(n)
    frames = np.lib.stride_tricks.sliding_window_view(np.pad(x, (n // 2, n // 2)), n)[::HOP] * win
    mag = np.log1p(np.abs(np.fft.rfft(frames, axis=1)) * 10)
    flux = np.maximum(0, np.diff(mag, axis=0)).sum(axis=1)
    flux = np.concatenate([[0], flux])
    flux -= np.convolve(flux, np.ones(16) / 16, mode="same")  # local mean removal
    return np.maximum(flux, 0)


def tempo(env, lo=80, hi=170):
    fps = SR / HOP
    ac = np.correlate(env, env, mode="full")[len(env) - 1:]
    best, score = 120.0, -1
    for bpm in np.arange(lo, hi, 0.25):
        lag = 60 / bpm * fps
        # weight the beat lag and its multiples (bars) to avoid octave errors
        s = sum(np.interp(lag * k, np.arange(len(ac)), ac) / k for k in (1, 2, 4))
        if s > score:
            best, score = bpm, s
    return best


def phase(env, bpm):
    fps = SR / HOP
    period = 60 / bpm * fps
    t = np.arange(len(env))
    scores = []
    for ph in np.linspace(0, period, 64, endpoint=False):
        idx = np.arange(ph, len(env), period)
        scores.append(np.interp(idx, t, env).sum())
    return float(np.linspace(0, period, 64, endpoint=False)[int(np.argmax(scores))] / fps)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("track")
    ap.add_argument("--start", type=float, default=0.0, help="where the reel's part of the song begins (s)")
    ap.add_argument("--dur", type=float, default=35.0)
    a = ap.parse_args()
    env = onset_envelope(load(a.track, a.start, a.dur))
    bpm = tempo(env)
    # refine: the tempo whose beat grid lines up best with the onsets over the whole clip
    fps = SR / HOP
    tt = np.arange(len(env))
    best = (-1, bpm)
    for cand in np.arange(bpm - 0.5, bpm + 0.5, 0.02):
        ph = phase(env, cand) * fps
        sc = np.interp(np.arange(ph, len(env), 60 / cand * fps), tt, env).mean()
        best = max(best, (sc, cand))
    bpm = best[1]
    off = phase(env, bpm)
    print(json.dumps({"bpm": round(bpm, 2), "first_beat": round(off, 3)}))
    print('reel.json -> "snap": ' + json.dumps({"bpm": round(bpm, 2), "offset": round(off, 3), "every": 1, "lead": 0.1}))


if __name__ == "__main__":
    main()
