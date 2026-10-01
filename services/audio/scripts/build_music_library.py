"""Build the music library in assets/music: download tracks + write music.json.

Tracks are by Kevin MacLeod (incompetech.com), CC BY 4.0: free for commercial use, but every
video that uses one must show the attribution line stored in music.json (the pipeline writes
it to credits.txt next to each render).

Mood and energy tags are ours; BPM and duration are measured with the same beat detector as /beats.

Run: cd services/audio && uv run python scripts/build_music_library.py
"""
import json
import sys
import urllib.parse
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.beats import analyze  # noqa: E402

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "assets" / "music"
BASE_URL = "https://incompetech.com/music/royalty-free/mp3-royaltyfree/"
ATTRIBUTION = (
    '"{title}" Kevin MacLeod (incompetech.com)\n'
    "Licensed under Creative Commons: By Attribution 4.0 License\n"
    "http://creativecommons.org/licenses/by/4.0/"
)

TRACKS = [  # id, title on incompetech, our mood tags, energy 0..1, incompetech "feel"
    ("motivator", "Motivator", ["energetic"], 0.85, "Bouncy, Bright, Driving, Uplifting"),
    ("inspired", "Inspired", ["premium", "calm", "serious"], 0.5, "Bright, Relaxed, Calming, Uplifting"),
    ("life-of-riley", "Life of Riley", ["playful"], 0.6, "Bright, Relaxed, Uplifting"),
]


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    tracks = []
    for tid, title, moods, energy, feel in TRACKS:
        path = OUT / f"{tid}.mp3"
        url = BASE_URL + urllib.parse.quote(title) + ".mp3"
        if not path.exists():
            print(f"downloading {title}...")
            path.write_bytes(urllib.request.urlopen(url).read())
        grid = analyze(str(path))
        tracks.append({
            "id": tid,
            "title": title,
            "file": path.name,
            "moods": moods,
            "energy": energy,
            "bpm": grid["bpm"],
            "duration": grid["duration"],
            "feel": feel,
            "source": url,
            "license": "CC-BY-4.0",
            "attribution": ATTRIBUTION.format(title=title),
        })
        print(f"{tid:14s} {grid['bpm']:6.2f} BPM  {grid['duration']:6.1f}s  {', '.join(moods)}")
    (OUT / "music.json").write_text(json.dumps({"tracks": tracks}, indent=2) + "\n")
    print(f"wrote {len(tracks)} tracks to {OUT / 'music.json'}")


if __name__ == "__main__":
    main()
