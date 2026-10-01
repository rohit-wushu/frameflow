"""How a Frameflow voice id and style become an Indic Parler-TTS request (no model needed here).

Indic Parler-TTS is steered by a plain-English description of the voice. A named speaker in the
description ("Rohit's voice ...") gives a consistent voice; the model card lists recommended speakers
per language. Voice ids look like pr_<language>_<speaker>, e.g. pr_hi_rohit, or pr_<language>_female /
pr_<language>_male for languages without a named speaker.
"""
import re

STYLES = {
    "natural": "speaks in a natural, friendly tone with moderate expressivity",
    "calm": "speaks in a calm, soothing and warm tone",
    "energetic": "speaks in an energetic, upbeat and highly expressive tone",
    "cheerful": "speaks in a cheerful, happy and expressive tone",
    "serious": "speaks in a serious, confident and authoritative tone",
    "warm": "speaks in a warm, kind and reassuring tone",
}

# sentence ends: Latin punctuation, the Devanagari danda (। ॥), the Urdu full stop (۔) and Ol Chiki (᱾ ᱿)
SENTENCE_END = re.compile(r"(?<=[.!?।॥۔᱾᱿])\s+")


class VoiceError(ValueError):
    pass


def parse_voice(voice_id):
    """pr_hi_rohit -> ("hi", "Rohit", None); pr_ur_female -> ("ur", None, "female")."""
    m = re.fullmatch(r"pr_([a-z]+)_([a-z]+)", voice_id or "")
    if not m:
        raise VoiceError(f"'{voice_id}' is not an Indic Parler voice id (pr_<language>_<speaker>)")
    lang, name = m.groups()
    if name in ("female", "male"):
        return lang, None, name
    return lang, name.capitalize(), None


def describe(voice_id, style=None):
    """The voice description the model is conditioned on."""
    _, speaker, gender = parse_voice(voice_id)
    tone = STYLES.get(style or "natural")
    if tone is None:
        raise VoiceError(f"unknown style '{style}' (use one of {', '.join(STYLES)})")
    who = f"{speaker}'s voice" if speaker else f"A {gender} speaker's voice"
    # the speed is applied afterwards (time stretch), so the description always asks for a moderate pace
    return f"{who} {tone}, at a moderate pace. The recording is of very high quality, with the speaker's voice sounding clear and very close up, with no background noise."


def sentences(text, max_chars=220):
    """Split a voiceover into sentences (the model is most reliable on short inputs); a very long sentence
    is split again at commas."""
    out = []
    for s in SENTENCE_END.split(text.strip()):
        s = s.strip()
        while len(s) > max_chars:
            cut = s.rfind(",", 0, max_chars)
            if cut < max_chars // 3:
                cut = s.rfind(" ", 0, max_chars)
            if cut <= 0:
                break
            out.append(s[: cut + 1].strip())
            s = s[cut + 1 :].strip()
        if s:
            out.append(s)
    return out
