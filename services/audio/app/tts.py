"""Text to speech with Kokoro (Apache-2.0, runs on CPU).

Kokoro voice ids start with their language code: "a" = American English (af_heart, am_michael, ...),
"b" = British English (bf_emma, bm_george, ...), "h" = Hindi (hf_alpha, hf_beta, hm_omega, hm_psi; read
through espeak-ng). The spec's Indic Parler-TTS is gated on Hugging Face (needs a token); see CLAUDE.md.
"""
import threading

import numpy as np

SAMPLE_RATE = 24000
REPO_ID = "hexgrad/Kokoro-82M"
LANG_CODES = ("a", "b", "h")

_pipelines = {}
_lock = threading.Lock()  # one synthesis at a time: keeps memory flat on small machines


class TTSError(ValueError):
    pass


def _pipeline(lang_code):
    from kokoro import KPipeline  # heavy import, only when first needed

    if lang_code not in _pipelines:
        _pipelines[lang_code] = KPipeline(lang_code=lang_code, repo_id=REPO_ID, device="cpu")
    return _pipelines[lang_code]


def trim_silence(audio, sr=SAMPLE_RATE, threshold_db=-45.0, pad=0.04):
    """Cut leading/trailing silence but keep `pad` seconds so consonants are not clipped."""
    if audio.size == 0:
        return audio
    level = 10 ** (threshold_db / 20) * max(float(np.abs(audio).max()), 1e-9)
    loud = np.flatnonzero(np.abs(audio) > level)
    if loud.size == 0:
        return audio
    start = max(0, loud[0] - int(pad * sr))
    end = min(audio.size, loud[-1] + int(pad * sr))
    return audio[start:end]


def synthesize(text, voice_id, speed=1.0):
    """Return mono float32 audio at SAMPLE_RATE."""
    text = text.strip()
    if not text:
        raise TTSError("text is empty")
    lang_code = voice_id[:1]
    if lang_code not in LANG_CODES:
        raise TTSError(f"voice '{voice_id}' is not a Kokoro voice we support (ids start with 'a', 'b' or 'h')")
    with _lock:
        pipe = _pipeline(lang_code)
        try:
            chunks = [r.audio.numpy() for r in pipe(text, voice=voice_id, speed=speed, split_pattern=None) if r.audio is not None]
        except Exception as e:  # unknown voice ids fail while downloading the voice pack
            raise TTSError(f"kokoro failed for voice '{voice_id}': {e}") from e
    if not chunks:
        raise TTSError("kokoro produced no audio")
    return trim_silence(np.concatenate(chunks).astype(np.float32))


def loaded():
    return sorted(_pipelines)


def unload():
    with _lock:
        _pipelines.clear()
