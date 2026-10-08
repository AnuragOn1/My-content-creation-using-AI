"""One command per reel: voice -> cue sheet -> audio -> video -> final MP4 + cover + QA sheet.

Usage: python3 make.py ../reels/day02 [--cover 1.95] [--skip-tts]
"""
import argparse
import json
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent


def run(*cmd, **kw):
    print("+", " ".join(str(c) for c in cmd), flush=True)
    subprocess.run([str(c) for c in cmd], check=True, cwd=HERE, **kw)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("reel")
    ap.add_argument("--cover", type=float, default=None, help="time of the cover frame (s)")
    ap.add_argument("--skip-tts", action="store_true")
    ap.add_argument("--workers", type=int, default=4)
    a = ap.parse_args()
    reel = Path(a.reel).resolve()
    build = reel / "build"
    spec = json.loads((reel / "reel.json").read_text())
    day = f"day{spec['day']:02d}"

    if not a.skip_tts:
        run(sys.executable, "tts.py", reel / "reel.json", build)
    run("node", "render.js", reel, "cues")
    run(sys.executable, "audio.py", reel)
    run("node", "render.js", reel, "video", a.workers)

    out = reel / f"{day}.mp4"
    # 4K (res 2): high bitrate so Instagram gets a clean source; 1080p stays under 30 MB
    res = spec.get("res", 1)
    grain = spec.get("grain", 5)
    vf = (f"noise=c0s={grain}:c0f=t+u," if grain else "") + "format=yuv420p"
    rate = (["-crf", "14", "-maxrate", "20M", "-bufsize", "40M", "-level:v", "5.1"] if res > 1
            else ["-crf", "18", "-maxrate", "6M", "-bufsize", "12M"])
    # with an external song: the post version has no music (add the song in Instagram),
    # plus a preview with the song mixed in to check the beat sync
    outputs = [(out, "mix.wav")]
    if (spec.get("music") or {}).get("track"):
        outputs = [(out, "mix_nomusic.wav"), (reel / f"{day}_preview_with_song.mp4", "mix.wav")]
    for dst, mixfile in outputs:
        run("ffmpeg", "-y", "-loglevel", "error",
            "-i", build / "video.mp4", "-i", build / mixfile,
            "-vf", vf,
            "-c:v", "libx264", "-preset", "slow", "-profile:v", "high", *rate,
            "-r", "30", "-g", "60",
            "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2",
            "-movflags", "+faststart", "-shortest", dst)

    cues = json.loads((build / "cues.json").read_text())
    cover = spec.get("cover", {"scene": "hook", "t": 3.2})
    cover_t = a.cover if a.cover is not None else cover["t"]
    run("node", "render.js", reel, "stills", f"{cover_t}", f"nocap,clean,scene={cover['scene']}", build / "cover")
    png = sorted((build / "cover").glob("*.png"))[-1]
    run("ffmpeg", "-y", "-loglevel", "error", "-i", png, "-q:v", "2", reel / f"{day}_cover.jpg")

    # QA: frames from every scene, as a contact sheet
    dur = cues["duration"]
    qa = [round(dur * k / 15, 2) for k in range(1, 15)]
    run("node", "render.js", reel, "stills", ",".join(map(str, qa)), "cap", build / "qa")
    run(sys.executable, "sheet.py", reel / "qa_sheet.png", *sorted((build / "qa").glob("*.png")))

    probe = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration,size",
                            "-of", "json", str(out)], capture_output=True, text=True).stdout
    f = json.loads(probe)["format"]
    print(f"\n{out.name}: {float(f['duration']):.2f}s, {int(f['size']) / 1e6:.1f} MB")


if __name__ == "__main__":
    main()
