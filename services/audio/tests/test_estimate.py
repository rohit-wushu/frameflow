import unittest

import numpy as np

from app.align import SAMPLE_RATE, estimate


def tone(seconds):
    t = np.arange(int(seconds * SAMPLE_RATE)) / SAMPLE_RATE
    return (0.3 * np.sin(2 * np.pi * 220 * t)).astype(np.float32)


def silence(seconds):
    return np.zeros(int(seconds * SAMPLE_RATE), dtype=np.float32)


class EstimateTest(unittest.TestCase):
    def test_phrases_follow_the_pauses(self):
        # two phrases of speech with a 0.4 s pause between them
        audio = np.concatenate([silence(0.1), tone(1.0), silence(0.4), tone(1.5), silence(0.1)])
        words = estimate(audio, "नमस्ते दोस्तों, आपका वीडियो तैयार है।")
        self.assertEqual(len(words), 6)
        self.assertAlmostEqual(words[0]["start"], 0.1, delta=0.05)
        self.assertAlmostEqual(words[1]["end"], 1.1, delta=0.05)  # first phrase ends at the pause
        self.assertAlmostEqual(words[2]["start"], 1.5, delta=0.05)  # second starts after it
        self.assertAlmostEqual(words[-1]["end"], 3.0, delta=0.05)
        for a, b in zip(words, words[1:]):
            self.assertLessEqual(a["end"], b["start"] + 1e-6)

    def test_falls_back_to_one_stretch(self):
        audio = np.concatenate([tone(1.0), silence(0.3), tone(1.0)])
        words = estimate(audio, "एक दो तीन")  # no punctuation but two stretches
        self.assertEqual(len(words), 3)
        self.assertAlmostEqual(words[0]["start"], 0.0, delta=0.05)
        self.assertAlmostEqual(words[-1]["end"], 2.3, delta=0.05)


if __name__ == "__main__":
    unittest.main()
