"""Word timestamps by forced alignment with WhisperX.

We already know the exact voiceover text, so we skip speech recognition and only run
WhisperX's wav2vec2 alignment step: faster, lighter, and the words are always the script's words.

The English wav2vec2 model only knows letters, so numbers and symbols are spelled out for
alignment ("40%" -> "forty percent") and the timings are folded back onto the original words.
"""
import re
import threading

import numpy as np

SAMPLE_RATE = 16000  # whisperx.load_audio resamples to this

_models = {}
_lock = threading.Lock()

SUFFIX_WORDS = {"%": ["percent"], "k": ["thousand"], "m": ["million"], "b": ["billion"], "x": ["x"]}
SYMBOL_WORDS = {"&": ["and"], "+": ["plus"], "@": ["at"], "=": ["equals"]}
NUMBER = re.compile(r"(\$)?(\d[\d,]*(?:\.\d+)?)(%|[kKmMbBxX])?")


class AlignError(ValueError):
    pass


def spoken_words(token):
    """How a written token is spoken, as a list of plain words (used only for alignment)."""
    from num2words import num2words

    core = token.strip(".,!?;:\"'()[]")
    if core in SYMBOL_WORDS:
        return SYMBOL_WORDS[core]
    m = NUMBER.fullmatch(core)
    if not m:
        return [token]
    dollar, digits, suffix = m.groups()
    value = float(digits.replace(",", "")) if "." in digits else int(digits.replace(",", ""))
    words = re.split(r"[\s,-]+", num2words(value))
    if suffix:
        words += SUFFIX_WORDS[suffix.lower()]
    if dollar:
        words.append("dollars")
    return [w for w in words if w]


def fill_gaps(times, total):
    """Give words the aligner could not place a (start, end) by interpolating between neighbours."""
    n = len(times)
    out = list(times)
    i = 0
    while i < n:
        if out[i] is not None:
            i += 1
            continue
        j = i
        while j < n and out[j] is None:
            j += 1
        left = out[i - 1][1] if i > 0 else 0.0
        right = out[j][0] if j < n else total
        step = max(right - left, 0.0) / (j - i)
        for k in range(i, j):
            out[k] = (left + step * (k - i), left + step * (k - i + 1))
        i = j
    return out


def estimate(audio, text, sr=SAMPLE_RATE):
    """Word timings without an aligner (used for Hindi until a commercially usable Hindi wav2vec2 model
    is set up): find the pauses in the audio, give each phrase between punctuation one stretch of speech
    when the counts match, and share each stretch out by word length."""
    tokens = text.split()
    total = len(audio) / sr
    frame = int(0.02 * sr)
    energy = np.array([np.sqrt(np.mean(audio[i:i + frame] ** 2)) for i in range(0, max(len(audio) - frame, 1), frame)])
    quiet = energy < max(energy.max() * 0.04, 1e-4)
    # speech stretches separated by pauses of 120 ms or more
    stretches, start, gap = [], None, 0
    for i, q in enumerate(quiet):
        if not q:
            if start is None:
                start = i
            gap = 0
        elif start is not None:
            gap += 1
            if gap * 0.02 >= 0.12:
                stretches.append((start * 0.02, (i - gap + 1) * 0.02))
                start, gap = None, 0
    if start is not None:
        stretches.append((start * 0.02, min(total, (len(quiet) - gap) * 0.02)))
    if not stretches:
        stretches = [(0.0, total)]
    # phrases end at punctuation (including the Devanagari danda)
    phrases, cur = [], []
    for t in tokens:
        cur.append(t)
        if re.search(r"[.,!?;:\u0964\u0965]$", t):
            phrases.append(cur)
            cur = []
    if cur:
        phrases.append(cur)
    if len(phrases) != len(stretches):
        phrases, stretches = [tokens], [(stretches[0][0], stretches[-1][1])]
    weight = lambda w: max(1, len(re.sub(r"[^\w]", "", w)))
    words = []
    for words_in, (a, b) in zip(phrases, stretches):
        total_w = sum(weight(w) for w in words_in)
        t = a
        for w in words_in:
            d = (b - a) * weight(w) / total_w
            words.append({"word": w, "start": round(t, 3), "end": round(t + d, 3), "score": 0.0})
            t += d
    return words


def _model(language):
    import whisperx

    if language not in _models:
        _models[language] = whisperx.load_align_model(language_code=language, device="cpu")
    return _models[language]


def align(audio_path, text, language="en"):
    """Return (words, duration). words = [{word, start, end, score}] in seconds from the file start."""
    import whisperx

    tokens = text.split()
    if not tokens:
        raise AlignError("text is empty")
    audio = whisperx.load_audio(audio_path)
    duration = len(audio) / SAMPLE_RATE
    if language != "en":
        return estimate(audio, text), round(duration, 3)

    expanded = [spoken_words(t) for t in tokens]
    flat = [w for ws in expanded for w in ws]
    with _lock:
        model, meta = _model(language)
        result = whisperx.align([{"text": " ".join(flat), "start": 0.0, "end": duration}], model, meta, audio, "cpu")
    segs = result["word_segments"]

    if len(segs) == len(flat):
        flat_times = [(s["start"], s["end"]) if "start" in s and "end" in s else None for s in segs]
        scores = [s.get("score", 0.0) for s in segs]
    else:  # should not happen; fall back to even spacing so the pipeline still runs
        flat_times = [None] * len(flat)
        scores = [0.0] * len(flat)
    flat_times = fill_gaps(flat_times, duration)

    words, k = [], 0
    for token, ws in zip(tokens, expanded):
        span = flat_times[k: k + len(ws)]
        score = float(np.mean(scores[k: k + len(ws)]))
        words.append({"word": token, "start": round(span[0][0], 3), "end": round(span[-1][1], 3), "score": round(score, 3)})
        k += len(ws)
    return words, round(duration, 3)


def loaded():
    return sorted(_models)


def unload():
    with _lock:
        _models.clear()
