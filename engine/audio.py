"""Audio: original procedural beat + synthesized SFX + voice, mixed and normalized.

Usage: python3 audio.py <reelDir> [--bpm 122] [--lufs -13.5]

Reads build/voice.wav and build/cues.json (written by render.js), writes
build/mix.wav (normalized) plus stems for QA. Every sound here is generated
from scratch with numpy, so there is nothing copyrighted in the mix.
"""
import argparse
import json
import re
import subprocess
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy.signal import butter, fftconvolve, resample_poly, sosfilt

SR = 48000
rs = np.random.default_rng(7)


# ---------------------------------------------------------------- helpers
def t_(dur):
    return np.arange(int(dur * SR)) / SR


def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], "bandpass", fs=SR, output="sos"), x)


def hp(x, f, order=2):
    return sosfilt(butter(order, f, "highpass", fs=SR, output="sos"), x)


def lp(x, f, order=2):
    return sosfilt(butter(order, f, "lowpass", fs=SR, output="sos"), x)


def noise(dur):
    return rs.standard_normal(int(dur * SR))


def norm(x, peak=1.0):
    m = np.max(np.abs(x)) or 1.0
    return x / m * peak


def svf_sweep(x, f0, f1, q=2.0, curve=1.0):
    """Band-pass state-variable filter whose centre glides f0 -> f1."""
    n = len(x)
    u = (np.arange(n) / max(1, n - 1)) ** curve
    fc = f0 * (f1 / f0) ** u
    g = 2 * np.sin(np.pi * np.minimum(fc, SR / 6) / SR)
    low = band = 0.0
    out = np.empty(n)
    k = 1.0 / q
    for i in range(n):
        high = x[i] - low - k * band
        band += g[i] * high
        low += g[i] * band
        out[i] = band
    return out


def midi(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def saw(f, t):
    return 2 * ((t * f) % 1.0) - 1


def place(buf, x, at, gain=1.0):
    i = int(at * SR)
    if i >= len(buf):
        return
    if i < 0:
        x = x[-i:]
        i = 0
    n = min(len(x), len(buf) - i)
    buf[i:i + n] += x[:n] * gain


# ---------------------------------------------------------------- drums & synths
def kick():
    t = t_(0.5)
    f = 46 + 90 * np.exp(-t / 0.04)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.24)
    click = hp(noise(0.5), 2000) * np.exp(-t / 0.003) * 0.35
    # a touch of 2nd harmonic so phones hear it
    harm = np.sin(4 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.08) * 0.18
    return np.tanh((body + click + harm) * 1.6) * 0.9


def clap():
    t = t_(0.35)
    env = np.zeros_like(t)
    for d in (0.0, 0.011, 0.022):
        env += (t >= d) * np.exp(-np.maximum(0, t - d) / (0.012 if d < 0.02 else 0.14))
    return norm(bp(noise(0.35), 900, 3200) * env, 0.8)


def hat(open_=False):
    d = 0.22 if open_ else 0.045
    t = t_(d + 0.02)
    return norm(hp(noise(d + 0.02), 7500, 4) * np.exp(-t / (0.07 if open_ else 0.012)), 0.5)


def pad_chord(notes, dur):
    t = t_(dur)
    x = np.zeros_like(t)
    for m in notes:
        for det in (-0.09, 0.0, 0.08):
            x += saw(midi(m + det), t + rs.random())
    x = lp(x, 1500, 2)
    a = np.minimum(1, t / 0.25) * np.minimum(1, (dur - t) / 0.15).clip(0, 1)
    return x * a / (len(notes) * 3)


def pluck(m, dur=0.22):
    t = t_(dur)
    f = midi(m)
    x = (np.sin(2 * np.pi * f * t) + 0.35 * np.sin(4 * np.pi * f * t) + 0.12 * saw(f, t)) * np.exp(-t / 0.085)
    return x


def bass_note(m, dur):
    t = t_(dur)
    f = midi(m)
    x = 0.75 * np.sin(2 * np.pi * f * t) + 0.45 * lp(saw(f, t), 420, 2)
    env = np.minimum(1, t / 0.005) * np.exp(-t / 0.18)
    return np.tanh(x * env * 1.4)


def music(dur, bpm, sections):
    beat = 60 / bpm
    n = int(dur * SR) + SR
    drums = np.zeros(n)
    synth = np.zeros(n)
    bass = np.zeros(n)
    prog = [
        ([53, 56, 60], 41),  # Fm
        ([49, 53, 56], 37),  # Db
        ([56, 60, 63], 44),  # Ab
        ([51, 55, 58], 39),  # Eb
    ]
    K, C, Hc, Ho = kick(), clap(), hat(), hat(True)
    nbeats = int(dur / beat) + 2
    full_from, full_to = sections
    for b in range(nbeats):
        tb = b * beat
        bar = b // 4
        chord, root = prog[bar % 4]
        full = full_from <= tb < full_to
        place(drums, K, tb, 1.0)
        if b % 2 == 1:
            place(drums, C, tb, 0.55 if full else 0.3)
        place(drums, Hc, tb + beat / 2, 0.5)
        if full:
            place(drums, Hc, tb + beat / 4, 0.18)
            place(drums, Hc, tb + 3 * beat / 4, 0.22)
            if b % 4 == 3:
                place(drums, Ho, tb + beat / 2, 0.35)
            place(bass, bass_note(root, beat / 2), tb + beat / 2, 0.8)
        if b % 4 == 0:
            place(synth, pad_chord(chord, beat * 4 + 0.3), tb, 0.55)
        # 16th arp, octave up
        pat = [0, 1, 2, 1]
        for s in range(4):
            m = chord[pat[s]] + 12 + (12 if (b % 2 and s == 2) else 0)
            place(synth, pluck(m), tb + s * beat / 4, 0.16 if full else 0.08)
    # ping-pong-ish delay on the synth bus
    d = int(beat * 0.75 * SR)
    wet = np.zeros(n)
    wet[d:] += synth[:-d] * 0.32
    wet[2 * d:] += synth[:-2 * d] * 0.12
    synth = synth + lp(wet, 3500)
    # sidechain pump from the kick
    tt = np.arange(n) / SR
    ph = (tt % beat)
    pump = 1 - 0.72 * np.exp(-ph / 0.11) * np.minimum(1, ph / 0.004 + 0.2)
    mixm = drums * 0.9 + (synth + bass) * pump
    return mixm[: int(dur * SR)]


# ---------------------------------------------------------------- SFX
def sfx_impact():
    t = t_(1.0)
    f = 34 + 80 * np.exp(-t / 0.08)
    sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.3)
    crack = lp(noise(1.0), 6000) * np.exp(-t / 0.05)
    tail = lp(noise(1.0), 1800) * np.exp(-t / 0.2) * 0.25
    return norm(np.tanh((sub * 1.2 + crack * 0.7 + tail) * 1.5), 0.95)


def sfx_thud():
    t = t_(0.35)
    f = 50 + 70 * np.exp(-t / 0.05)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.12)
    tick = bp(noise(0.35), 1500, 5000) * np.exp(-t / 0.008) * 0.5
    return norm(body + tick, 0.8)


def sfx_whoosh(dur=0.38, f0=350, f1=4200, q=1.6):
    t = t_(dur)
    x = svf_sweep(noise(dur), f0, f1, q, 0.8)
    env = np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 2
    return norm(x * env, 0.8)


def sfx_wipe():
    dur = 0.5
    t = t_(dur)
    w = sfx_whoosh(dur, 250, 3200, 1.3)
    tone = np.sin(2 * np.pi * np.cumsum(260 * (4 ** (t / dur))) / SR) * np.sin(np.pi * t / dur) ** 2 * 0.18
    return norm(w + tone, 0.8)


def sfx_swoosh():
    return sfx_whoosh(0.2, 1200, 7000, 1.4) * 0.8


def sfx_pop():
    t = t_(0.12)
    f0 = 700 + rs.random() * 250
    f = f0 * (0.55 + 0.45 * np.exp(-t / 0.02))
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.035)
    click = hp(noise(0.12), 3000) * np.exp(-t / 0.002) * 0.3
    return norm(x + click, 0.8)


def sfx_click():
    t = t_(0.03)
    c = bp(noise(0.03), 1800 + rs.random() * 1500, 6500) * np.exp(-t / 0.0035)
    thock = np.sin(2 * np.pi * (170 + rs.random() * 40) * t) * np.exp(-t / 0.006) * 0.35
    return norm(c + thock, 0.5 + rs.random() * 0.3)


def sfx_typing(dur, cps):
    n = int((dur + 0.1) * SR)
    x = np.zeros(n)
    k = 0.0
    step = 1.0 / min(cps, 24)
    while k < dur:
        place(x, sfx_click(), k + rs.normal(0, step * 0.12), 1.0)
        k += step * (0.75 + rs.random() * 0.5)
    return x


def sfx_tick():
    t = t_(0.025)
    x = np.sin(2 * np.pi * 2600 * t) * np.exp(-t / 0.004) + hp(noise(0.025), 4000) * np.exp(-t / 0.0015) * 0.4
    return norm(x, 0.5)


def sfx_ding():
    t = t_(1.3)
    x = np.zeros_like(t)

    def bell(f, at, g):
        tt = np.maximum(0, t - at)
        on = t >= at
        y = (np.sin(2 * np.pi * f * tt) * np.exp(-tt / 0.9)
             + 0.45 * np.sin(2 * np.pi * f * 2.0 * tt) * np.exp(-tt / 0.45)
             + 0.2 * np.sin(2 * np.pi * f * 3.01 * tt) * np.exp(-tt / 0.2)
             + 0.12 * np.sin(2 * np.pi * f * 4.07 * tt) * np.exp(-tt / 0.12))
        return y * on * g * np.minimum(1, tt / 0.002)

    x += bell(1318.5, 0.0, 0.7)  # E6
    x += bell(1975.5, 0.075, 0.6)  # B6
    # sparkle
    for _ in range(9):
        at = 0.05 + rs.random() * 0.45
        f = 3500 + rs.random() * 4500
        tt = np.maximum(0, t - at)
        x += np.sin(2 * np.pi * f * tt) * np.exp(-tt / 0.03) * (t >= at) * 0.12
    return norm(x, 0.75)


def sfx_riser(dur):
    t = t_(dur)
    w = svf_sweep(noise(dur), 300, 7000, 2.5, 1.6)
    tone = np.sin(2 * np.pi * np.cumsum(180 * (5 ** (t / dur))) / SR) * 0.25
    env = (t / dur) ** 2.2
    return norm((w + tone) * env, 0.75)


def sfx_scribble(dur):
    t = t_(dur)
    x = bp(noise(dur), 1800, 5200)
    strokes = 0.55 + 0.45 * np.sin(2 * np.pi * 13 * t + rs.random() * 6) ** 2
    grain = 0.6 + 0.4 * lp(np.abs(noise(dur)), 60)
    env = np.minimum(1, t / 0.02) * np.minimum(1, (dur - t) / 0.04).clip(0, 1)
    return norm(x * strokes * grain * env, 0.45)


def sfx_buzz():
    t = t_(0.32)
    sq = np.sign(np.sin(2 * np.pi * 110 * t)) + np.sign(np.sin(2 * np.pi * 116.5 * t))
    gate = ((t < 0.11) | ((t > 0.16) & (t < 0.28))).astype(float)
    return norm(lp(sq, 1400) * gate * np.exp(-t / 0.4), 0.5)


def sfx_for(c):
    k = c["type"]
    if k == "impact":
        return sfx_impact()
    if k == "thud":
        return sfx_thud()
    if k == "whoosh":
        return sfx_whoosh()
    if k == "wipe":
        return sfx_wipe()
    if k == "swoosh":
        return sfx_swoosh()
    if k == "pop":
        return sfx_pop()
    if k == "type":
        return sfx_typing(c.get("dur", 0.5), c.get("cps", 20))
    if k == "tick":
        return sfx_tick()
    if k == "ding":
        return sfx_ding()
    if k == "riser":
        return sfx_riser(c.get("dur", 0.8))
    if k == "scribble":
        return sfx_scribble(c.get("dur", 0.3))
    if k == "buzz":
        return sfx_buzz()
    raise ValueError(k)


# riser cues end exactly on their reveal, so they are placed early
BASE_GAIN = {"impact": 0.5, "thud": 0.5, "whoosh": 0.5, "wipe": 0.5, "swoosh": 0.38, "pop": 0.55,
             "type": 0.42, "tick": 0.38, "ding": 0.45, "riser": 0.36, "scribble": 0.45, "buzz": 0.3}


def reverb_ir(dur=0.7):
    t = t_(dur)
    return lp(noise(dur), 4000) * np.exp(-t / 0.18) * 0.06


# ---------------------------------------------------------------- loudness
def limiter(x, ceiling_db=-1.5, look=0.004, release=0.08):
    """Look-ahead limiter on 4x-oversampled peaks, so true peak stays under the ceiling."""
    from scipy.ndimage import maximum_filter1d
    ceiling = 10 ** (ceiling_db / 20)
    over = np.abs(resample_poly(x, 4, 1)).reshape(-1, 4).max(axis=1)[: len(x)]
    w = int(look * SR)
    pk = maximum_filter1d(over, size=2 * w + 1)
    g = np.minimum(1.0, ceiling / np.maximum(pk, 1e-9))
    r = np.exp(-1 / (release * SR))
    out = np.empty_like(g)
    acc = 1.0
    for i in range(0, len(g), 32):
        m = g[i:i + 32].min()
        acc = m if m < acc else acc * r ** 32 + (1 - r ** 32) * m
        out[i:i + 32] = min(acc, m)
    return x * out


def loudnorm(src, dst, target, tp=-1.0):
    cmd = ["ffmpeg", "-hide_banner", "-nostats", "-i", str(src), "-af",
           f"loudnorm=I={target}:TP={tp}:LRA=11:print_format=json", "-f", "null", "-"]
    err = subprocess.run(cmd, capture_output=True, text=True).stderr
    m = json.loads(re.search(r"\{[^{}]*\"input_i\"[^{}]*\}", err, re.S).group(0))
    af = (f"loudnorm=I={target}:TP={tp}:LRA=11:measured_I={m['input_i']}:measured_TP={m['input_tp']}:"
          f"measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(src), "-af", af, "-ar", str(SR), str(dst)], check=True)


def lufs(path):
    err = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(path), "-af", "ebur128=peak=true", "-f", "null", "-"],
                         capture_output=True, text=True).stderr
    i = float(re.findall(r"I:\s+(-?[\d.]+) LUFS", err)[-1])
    p = re.findall(r"Peak:\s+(-?[\d.]+|-inf) dBFS", err)
    return i, (float(p[-1]) if p and p[-1] != "-inf" else None)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("reel")
    ap.add_argument("--bpm", type=float, default=122)
    ap.add_argument("--lufs", type=float, default=-13.5)
    ap.add_argument("--music-lu", type=float, default=13.0, help="music level below the voice")
    ap.add_argument("--sfx-lu", type=float, default=9.0, help="SFX level below the voice")
    a = ap.parse_args()
    build = Path(a.reel) / "build"
    cues = json.loads((build / "cues.json").read_text())
    dur = cues["duration"]
    n = int(dur * SR)

    # voice: 24k -> 48k, clean low end, gentle compression
    v, vsr = sf.read(build / "voice.wav")
    v = resample_poly(v, SR, vsr)
    v = hp(v, 85)
    env = np.sqrt(lp(v ** 2, 8) .clip(0)) + 1e-6
    gain = np.minimum(1.0, (0.12 / env) ** 0.35)
    v = norm(v * gain, 0.7)
    voice = np.zeros(n)
    voice[: min(n, len(v))] = v[:n]

    # ducking envelope from the voice (fast attack, slow release)
    e = np.abs(voice)
    att, rel = np.exp(-1 / (0.01 * SR)), np.exp(-1 / (0.28 * SR))
    env = np.zeros(n)
    acc = 0.0
    step = 64
    for i in range(0, n, step):
        x = e[i:i + step].max()
        acc = att ** step * acc + (1 - att ** step) * x if x > acc else rel ** step * acc + (1 - rel ** step) * x
        env[i:i + step] = acc
    duck = 1 - 0.6 * np.clip(env / 0.25, 0, 1)

    title_start = next((c["t"] for c in cues["cues"] if c["type"] in ("wipe", "whoosh")), 2.3)
    spec = json.loads((Path(a.reel) / "reel.json").read_text())
    bpm = (spec.get("snap") or {}).get("bpm", a.bpm)
    track = (spec.get("music") or {}).get("track")
    if track:
        # an external (e.g. trending) song: used for the sync preview mix only
        tp = Path(a.reel) / track
        start = spec["music"].get("start", 0.0)
        raw = subprocess.run(["ffmpeg", "-v", "error", "-ss", str(start), "-t", str(dur + 1), "-i", str(tp),
                              "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"], capture_output=True, check=True).stdout
        bed = np.zeros(n)
        tr = np.frombuffer(raw, np.float32).astype(np.float64)[:n]
        bed[: len(tr)] = tr
    else:
        bed = music(dur, bpm, (title_start + 0.25, dur - 0.8))
    bed = norm(bed, 1.0) * 0.17 * duck
    fade = np.ones(n)
    fl = int(0.5 * SR)
    fade[-fl:] = np.linspace(1, 0, fl) ** 2
    fade[: int(0.01 * SR)] = np.linspace(0, 1, int(0.01 * SR))
    bed *= fade

    fx = np.zeros(n + SR)
    for c in cues["cues"]:
        x = sfx_for(c)
        at = c["t"]
        place(fx, x, at, BASE_GAIN[c["type"]] * c.get("gain", 1.0))
    fx = fx + fftconvolve(fx, reverb_ir())[: len(fx)]
    fx = fx[:n]

    # balance stems by loudness, not by peak: voice on top, music and SFX under it
    def at_lufs(x, target, name):
        sf.write(build / f"stem_{name}.wav", x, SR)
        cur, _ = lufs(build / f"stem_{name}.wav")
        y = x * 10 ** ((target - cur) / 20)
        sf.write(build / f"stem_{name}.wav", y, SR)
        return y

    V = -16.0
    voice = at_lufs(voice, V, "voice")
    bed = at_lufs(bed, V - a.music_lu, "music")
    fx = at_lufs(fx, V - a.sfx_lu, "sfx")
    # with an external track, also write a music-free mix: post that one and add the
    # song inside Instagram (licensed, and the reel shows up on the sound's page)
    mixes = [("mix.wav", voice + bed + fx)]
    if track:
        mixes.append(("mix_nomusic.wav", voice + fx))
    for name, mix in mixes:
        write_mix(build / name, mix, a.lufs)
    i, p = lufs(build / "mix.wav")
    print(f"mix: {i:.1f} LUFS, peak {p} dBFS | music {a.music_lu} LU and SFX {a.sfx_lu} LU under the voice")


def write_mix(path, mix, target):
    # gain to target loudness, limit peaks, repeat once to make up what the limiter took
    for _ in range(6):
        sf.write(path, mix, SR)
        cur, _ = lufs(path)
        if abs(cur - target) < 0.15:
            break
        mix = limiter(mix * 10 ** ((target - cur) * 1.4 / 20))
    sf.write(path, mix.astype(np.float32), SR, subtype="FLOAT")


if __name__ == "__main__":
    main()
