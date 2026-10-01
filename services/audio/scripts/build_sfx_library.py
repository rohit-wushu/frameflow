"""Build the SFX library in assets/sfx: WAV files + sfx.json.

- pop, click, ding come from Kenney's Interface Sounds pack (CC0), downloaded on first run.
- whoosh, swoosh, riser, impact are synthesized here (our own work, released as CC0).

Every sound is resampled to 48 kHz stereo and normalized to the same perceived level,
so the mixer only applies each cue's volume on top.

Run: cd services/audio && uv run python scripts/build_sfx_library.py
"""
import io
import json
import urllib.request
import zipfile
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy.signal import istft, resample_poly, stft

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "assets" / "sfx"
CACHE = ROOT / "storage" / "cache" / "kenney"
SR = 48000
KENNEY_URL = "https://kenney.nl/media/pages/assets/interface-sounds/fa43c1dd4d-1677589452/kenney_interface-sounds.zip"
KENNEY = {  # our id -> file in the pack
    "pop": "drop_001.ogg",
    "click": "click_001.ogg",
    "ding": "confirmation_002.ogg",
}
rng = np.random.default_rng(7)  # fixed seed: rebuilding gives identical files


# ---------- synthesis helpers ----------

def band_sweep(duration, centers, width_octaves, pan=None):
    """Noise whose pass band follows `centers(t)` (Hz); returns stereo (n, 2)."""
    n = int(duration * SR)
    noise = rng.normal(0, 1, n)
    f, t, Z = stft(noise, fs=SR, nperseg=1024, noverlap=768)
    fc = centers(t / duration)[None, :]
    octaves = np.log2(np.maximum(f[:, None], 1.0) / fc)
    Z *= np.exp(-0.5 * (octaves / width_octaves) ** 2)
    _, x = istft(Z, fs=SR, nperseg=1024, noverlap=768)
    x = x[:n]
    pos = np.linspace(0, 1, n)
    p = pan(pos) if pan else np.zeros(n)  # -1 left .. 1 right
    return np.stack([x * np.sqrt((1 - p) / 2), x * np.sqrt((1 + p) / 2)], axis=1)


def envelope(n, peak_at, attack_curve=2.0, release_curve=2.5):
    t = np.linspace(0, 1, n)
    up = (t / peak_at) ** attack_curve
    down = ((1 - t) / (1 - peak_at)) ** release_curve
    return np.where(t < peak_at, up, down)


def whoosh():
    d, peak = 0.75, 0.55
    x = band_sweep(d, lambda u: 350 * 7 ** np.sin(np.pi * u) , 0.9, pan=lambda u: 1.2 * (u - 0.5))
    return x * envelope(len(x), peak)[:, None], d * peak


def swoosh():
    d, peak = 0.38, 0.45
    x = band_sweep(d, lambda u: 1500 * 4 ** np.sin(np.pi * u), 0.7, pan=lambda u: -1.0 * (u - 0.5))
    return x * envelope(len(x), peak, 1.5, 2.0)[:, None], d * peak


def riser():
    d = 2.0
    x = band_sweep(d, lambda u: 300 * 20 ** (u ** 1.5), 0.6)
    t = np.arange(len(x)) / SR
    tone = np.sin(2 * np.pi * np.cumsum(180 * 4 ** (t / d)) / SR) * 0.25
    x = x + tone[:, None]
    env = (t / d) ** 2.5
    env[-int(0.02 * SR):] *= np.linspace(1, 0, int(0.02 * SR))  # stop cleanly at the hit
    return x * env[:, None], d


def impact():
    d = 1.8
    n = int(d * SR)
    t = np.arange(n) / SR
    boom = np.sin(2 * np.pi * np.cumsum(40 + 60 * np.exp(-t * 12)) / SR) * np.exp(-t * 2.2)
    crack = rng.normal(0, 1, n) * np.exp(-t * 45)
    f, tt, Z = stft(crack, fs=SR, nperseg=512)
    Z *= (f < 2500)[:, None]
    _, crack = istft(Z, fs=SR, nperseg=512)
    tail_ir = rng.normal(0, 1, int(1.2 * SR)) * np.exp(-np.arange(int(1.2 * SR)) / SR * 4)
    dry = boom + 0.35 * crack[:n]
    wet = np.convolve(dry, tail_ir)[:n]
    wet /= np.abs(wet).max() + 1e-9
    x = dry / (np.abs(dry).max() + 1e-9) + 0.18 * wet
    stereo = np.stack([x, np.roll(x, int(0.004 * SR))], axis=1)  # tiny offset for width
    return stereo, 0.005


# ---------- normalization + IO ----------

def normalize(x, target_rms_db=-18.0, peak_db=-1.0):
    """Match loudness on the audible part (RMS above -30 dB of peak), never exceed peak_db."""
    mono = np.abs(x).max(axis=1)
    active = x[mono > np.abs(x).max() * 10 ** (-30 / 20)]
    rms = np.sqrt(np.mean(active ** 2)) + 1e-12
    gain = min(10 ** (target_rms_db / 20) / rms, 10 ** (peak_db / 20) / np.abs(x).max())
    return (x * gain).astype(np.float32)


def kenney_pack():
    CACHE.mkdir(parents=True, exist_ok=True)
    zpath = CACHE / "kenney_interface-sounds.zip"
    if not zpath.exists():
        print("downloading Kenney Interface Sounds (CC0)...")
        zpath.write_bytes(urllib.request.urlopen(KENNEY_URL).read())
    return zipfile.ZipFile(zpath)


def load_from_pack(pack, name):
    member = next(m for m in pack.namelist() if m.endswith("/" + name) or m == name)
    x, sr = sf.read(io.BytesIO(pack.read(member)), always_2d=True)
    x = resample_poly(x, SR, sr, axis=0)
    return np.repeat(x, 2, axis=1) if x.shape[1] == 1 else x[:, :2]


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    pack = kenney_pack()
    kenney_src = "Kenney Interface Sounds (https://kenney.nl/assets/interface-sounds), file {file}"
    synth_src = "Synthesized by services/audio/scripts/build_sfx_library.py"
    specs = [  # id, description, default cue volume, audio + hit offset
        ("whoosh", "Airy whoosh for scene cuts; peaks at the cut", 0.55, whoosh()),
        ("swoosh", "Short bright swoosh for small moves and slides", 0.45, swoosh()),
        ("riser", "2 s tension riser that ends exactly on the next hit", 0.4, riser()),
        ("impact", "Deep cinematic hit for logo reveals and big moments", 0.8, impact()),
        ("pop", "Soft bubbly pop for list items appearing", 0.5, (load_from_pack(pack, KENNEY["pop"]), 0.0)),
        ("click", "Crisp UI click for buttons and small UI changes", 0.45, (load_from_pack(pack, KENNEY["click"]), 0.0)),
        ("ding", "Bright chime for success moments and stats", 0.45, (load_from_pack(pack, KENNEY["ding"]), 0.0)),
    ]
    sounds = []
    for sid, desc, gain, (audio, hit) in specs:
        audio = normalize(audio)
        sf.write(OUT / f"{sid}.wav", audio, SR, subtype="PCM_16")
        from_kenney = sid in KENNEY
        sounds.append({
            "id": sid,
            "file": f"{sid}.wav",
            "description": desc,
            "duration": round(len(audio) / SR, 3),
            "hitOffset": round(hit, 3),
            "gain": gain,
            "source": kenney_src.format(file=KENNEY[sid]) if from_kenney else synth_src,
            "license": "CC0-1.0",
        })
        print(f"{sid:7s} {len(audio) / SR:5.2f}s hit at {hit:.3f}s")
    (OUT / "sfx.json").write_text(json.dumps({"sounds": sounds}, indent=2) + "\n")
    print(f"wrote {len(sounds)} sounds to {OUT}")


if __name__ == "__main__":
    main()
