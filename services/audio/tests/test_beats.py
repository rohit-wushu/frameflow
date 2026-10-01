"""Beat detection on synthetic audio with a known tempo and phase.

kick_track() is adapted from motion-video-skill (scripts/tests/test_audio_tools.py),
Copyright (c) 2026 BestAgentKits, MIT License. https://github.com/bestagentkits/motion-video-skill

Run: pnpm audio:test
"""
import tempfile
import unittest
import wave
from pathlib import Path

import numpy as np

from app import beats

SR = 44100


def write_wav(path, x):
    pcm = (np.clip(x, -1, 1) * 32767).astype("<i2")
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


def kick_track(bpm, beat0, seconds, accent_every=4, seed=0):
    """Sine-sweep kicks on every beat (louder on each bar's first beat) plus a little noise and a hi-hat."""
    rng = np.random.default_rng(seed)
    x = rng.normal(0, 0.01, int(seconds * SR)).astype(np.float32)
    t = np.arange(int(0.12 * SR)) / SR
    kick = np.sin(2 * np.pi * (120 - 400 * t) * t) * np.exp(-t * 30)
    hat = rng.normal(0, 1, int(0.03 * SR)) * np.exp(-np.arange(int(0.03 * SR)) / SR * 200)
    beat = 60 / bpm
    n = 0
    while beat0 + n * beat + 0.12 < seconds:
        i = int((beat0 + n * beat) * SR)
        x[i: i + len(kick)] += (0.9 if n % accent_every == 0 else 0.35) * kick
        j = int((beat0 + (n + 0.5) * beat) * SR)  # off-beat hi-hat, no low end
        if j + len(hat) < len(x):
            x[j: j + len(hat)] += 0.15 * hat
        n += 1
    return x


class BeatsTest(unittest.TestCase):
    def test_recovers_tempo_phase_and_downbeats(self):
        bpm, beat0 = 110, 0.25
        with tempfile.TemporaryDirectory() as d:
            f = Path(d) / "click.wav"
            write_wav(f, kick_track(bpm, beat0, 30))
            r = beats.analyze(str(f))
        self.assertAlmostEqual(r["bpm"], bpm, delta=1.0)
        period = 60 / bpm
        for t in r["beats"][2:-2]:  # every detected beat sits on the true grid
            k = round((t - beat0) / period)
            self.assertLess(abs(t - (beat0 + k * period)), 0.03, f"beat at {t:.3f}s is off the grid")
        for t in r["downbeats"][1:-1]:  # downbeats are the accented kicks
            k = round((t - beat0) / period)
            self.assertEqual(k % 4, 0, f"downbeat at {t:.3f}s is beat {k}, not a bar start")


if __name__ == "__main__":
    unittest.main()
