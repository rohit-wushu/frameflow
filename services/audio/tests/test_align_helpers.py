"""Unit tests for the alignment helpers (no models needed)."""
import unittest

from app.align import fill_gaps, spoken_words


class SpokenWordsTest(unittest.TestCase):
    def test_plain_words_pass_through(self):
        self.assertEqual(spoken_words("Hello,"), ["Hello,"])

    def test_numbers_are_spelled_out(self):
        self.assertEqual(spoken_words("10,000"), ["ten", "thousand"])
        self.assertEqual(spoken_words("40%"), ["forty", "percent"])
        self.assertEqual(spoken_words("$29."), ["twenty", "nine", "dollars"])
        self.assertEqual(spoken_words("3x"), ["three", "x"])
        self.assertEqual(spoken_words("4.9"), ["four", "point", "nine"])

    def test_symbols(self):
        self.assertEqual(spoken_words("&"), ["and"])


class FillGapsTest(unittest.TestCase):
    def test_interpolates_missing_words(self):
        out = fill_gaps([(0.0, 0.5), None, None, (1.5, 2.0)], 3.0)
        self.assertEqual(out[1], (0.5, 1.0))
        self.assertEqual(out[2], (1.0, 1.5))

    def test_missing_at_the_edges(self):
        out = fill_gaps([None, (1.0, 1.2), None], 2.0)
        self.assertEqual(out[0], (0.0, 1.0))
        self.assertEqual(out[2], (1.2, 2.0))


if __name__ == "__main__":
    unittest.main()
