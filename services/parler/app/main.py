"""Frameflow Indic voices: AI4Bharat Indic Parler-TTS (Apache-2.0) behind a tiny HTTP API.

The main audio service (services/audio) forwards /tts requests for "indic-parler" voices here and starts
this service when it is needed. Run by hand: pnpm parler:start (uvicorn on 127.0.0.1:8792).

The model is gated on Hugging Face: accept its terms on the model page, then put a read token in .env as
HF_TOKEN. First use downloads ~3.5 GB (pnpm parler:setup does it ahead of time).
"""
import hashlib
import io
import os
import threading

import numpy as np
import soundfile as sf
from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field

from . import env
from .voice import VoiceError, describe, sentences

env.load()

MODEL_ID = os.environ.get("PARLER_MODEL", "ai4bharat/indic-parler-tts")
GAP_SECONDS = 0.12  # silence between sentences

app = FastAPI(title="Frameflow Indic voices")
_state = {}
_lock = threading.Lock()  # one generation at a time: keeps memory flat


class TTSRequest(BaseModel):
    text: str = Field(min_length=1, max_length=2000)
    voiceId: str
    style: str | None = None
    speed: float = Field(1.0, ge=0.5, le=2.0)


def _device():
    import torch

    want = os.environ.get("PARLER_DEVICE")
    if want:
        return want
    if torch.cuda.is_available():
        return "cuda:0"
    return "cpu"  # Apple's MPS backend is not reliable for this model yet


def _load():
    if "model" not in _state:
        from parler_tts import ParlerTTSForConditionalGeneration
        from transformers import AutoTokenizer

        device = _device()
        model = ParlerTTSForConditionalGeneration.from_pretrained(MODEL_ID).to(device)
        _state.update(
            model=model,
            device=device,
            tokenizer=AutoTokenizer.from_pretrained(MODEL_ID),
            description_tokenizer=AutoTokenizer.from_pretrained(model.config.text_encoder._name_or_path),
            rate=model.config.sampling_rate,
        )
    return _state


def trim_silence(audio, sr, threshold_db=-45.0, pad=0.04):
    if audio.size == 0:
        return audio
    level = 10 ** (threshold_db / 20) * max(float(np.abs(audio).max()), 1e-9)
    loud = np.flatnonzero(np.abs(audio) > level)
    if loud.size == 0:
        return audio
    return audio[max(0, loud[0] - int(pad * sr)) : min(audio.size, loud[-1] + int(pad * sr))]


def synthesize(text, voice_id, style=None, speed=1.0):
    """Return (mono float32 audio, sample rate)."""
    import torch

    description = describe(voice_id, style)
    parts = sentences(text)
    if not parts:
        raise VoiceError("text is empty")
    with _lock:
        s = _load()
        desc = s["description_tokenizer"](description, return_tensors="pt").to(s["device"])
        chunks = []
        for part in parts:
            # the same text and voice always give the same audio (sampling is seeded)
            torch.manual_seed(int(hashlib.sha1(f"{voice_id}|{style}|{part}".encode()).hexdigest()[:8], 16))
            prompt = s["tokenizer"](part, return_tensors="pt").to(s["device"])
            with torch.inference_mode():
                out = s["model"].generate(
                    input_ids=desc.input_ids,
                    attention_mask=desc.attention_mask,
                    prompt_input_ids=prompt.input_ids,
                    prompt_attention_mask=prompt.attention_mask,
                )
            chunks.append(trim_silence(out.cpu().numpy().squeeze().astype(np.float32), s["rate"]))
        rate = s["rate"]
    gap = np.zeros(int(GAP_SECONDS * rate), dtype=np.float32)
    audio = np.concatenate([x for c in chunks for x in (c, gap)][:-1])
    if abs(speed - 1.0) > 0.02:
        import librosa

        audio = librosa.effects.time_stretch(audio, rate=speed)
    return audio.astype(np.float32), rate


@app.get("/health")
def health():
    return {"ok": True, "loaded": "model" in _state, "model": MODEL_ID}


@app.post("/unload")
def unload():
    import gc

    with _lock:
        _state.clear()
    gc.collect()
    return {"ok": True}


@app.post("/tts")
def tts(req: TTSRequest):
    try:
        audio, rate = synthesize(req.text, req.voiceId, req.style, req.speed)
    except VoiceError as e:
        raise HTTPException(400, str(e))
    except OSError as e:  # gated model without access, or no network for the first download
        raise HTTPException(503, f"could not load {MODEL_ID} (accept its terms on Hugging Face and set HF_TOKEN in .env): {e}")
    buf = io.BytesIO()
    sf.write(buf, audio, rate, format="WAV", subtype="PCM_16")
    return Response(buf.getvalue(), media_type="audio/wav", headers={"X-Duration": f"{len(audio) / rate:.3f}"})
