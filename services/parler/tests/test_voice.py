"""Unit tests for voice ids, descriptions and sentence splitting (no model needed)."""
import unittest

from app.voice import VoiceError, describe, parse_voice, sentences


class ParseVoiceTest(unittest.TestCase):
    def test_named_speaker(self):
        self.assertEqual(parse_voice("pr_hi_rohit"), ("hi", "Rohit", None))

    def test_generic_voice(self):
        self.assertEqual(parse_voice("pr_ur_female"), ("ur", None, "female"))

    def test_rejects_other_ids(self):
        for bad in ("af_heart", "pr_hi", "pr_hi_Rohit", "", None):
            with self.assertRaises(VoiceError):
                parse_voice(bad)


class DescribeTest(unittest.TestCase):
    def test_names_the_speaker_and_style(self):
        d = describe("pr_ta_jaya", "calm")
        self.assertTrue(d.startswith("Jaya's voice speaks in a calm"))
        self.assertIn("no background noise", d)

    def test_generic_and_default_style(self):
        self.assertTrue(describe("pr_ur_male").startswith("A male speaker's voice speaks in a natural"))

    def test_unknown_style(self):
        with self.assertRaises(VoiceError):
            describe("pr_hi_rohit", "angry")


class SentencesTest(unittest.TestCase):
    def test_splits_on_latin_and_indic_stops(self):
        self.assertEqual(sentences("नमस्ते। यह हमारा ऐप है। Try it!  Now."), ["नमस्ते।", "यह हमारा ऐप है।", "Try it!", "Now."])

    def test_urdu_full_stop(self):
        self.assertEqual(sentences("پہلا جملہ۔ دوسرا جملہ"), ["پہلا جملہ۔", "دوسرا جملہ"])

    def test_long_sentence_splits_at_commas(self):
        text = ", ".join(["word " * 10] * 6).strip()
        parts = sentences(text, max_chars=120)
        self.assertTrue(len(parts) > 1)
        self.assertTrue(all(len(p) <= 120 for p in parts))
        self.assertEqual(" ".join(parts).split(), text.split())


if __name__ == "__main__":
    unittest.main()
