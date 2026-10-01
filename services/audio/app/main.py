"""Frameflow audio service: /tts (Kokoro; Indic Parler-TTS through services/parler), /align (WhisperX), /beats (librosa).

Run: pnpm audio:start   (uvicorn on 127.0.0.1:8790)
"""
import gc
import io
import os
import tempfile

import soundfile as sf
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, Field

from . import align as align_mod
from . import beats as beats_mod
from . import parler_client
from . import tts as tts_mod

app = FastAPI(title="Frameflow audio service")


class TTSRequest(BaseModel):
    text: str = Field(min_length=1, max_length=2000)
    voiceId: str = "af_heart"
    speed: float = Field(1.0, ge=0.5, le=2.0)
    engine: str = "kokoro"
    style: str | None = None  # Indic Parler voices only: natural, calm, energetic, cheerful, serious, warm


def _save_upload(upload: UploadFile):
    suffix = os.path.splitext(upload.filename or "")[1] or ".wav"
    fd, path = tempfile.mkstemp(suffix=suffix)
    with os.fdopen(fd, "wb") as f:
        f.write(upload.file.read())
    return path


@app.get("/health")
def health():
    return {"ok": True, "loaded": {"tts": tts_mod.loaded(), "align": align_mod.loaded()}}


@app.post("/unload")
def unload():
    """Free the voice and alignment models (they reload on the next request). The pipeline calls this
    before rendering so headless Chrome has the memory on 8 GB machines."""
    tts_mod.unload()
    align_mod.unload()
    parler_client.unload()
    gc.collect()
    return {"ok": True}


@app.post("/tts")
def tts(req: TTSRequest):
    try:
        if req.engine == "kokoro":
            audio, rate = tts_mod.synthesize(req.text, req.voiceId, req.speed), tts_mod.SAMPLE_RATE
        elif req.engine == "indic-parler":
            audio, rate = parler_client.synthesize(req.text, req.voiceId, req.speed, req.style)
        else:
            raise HTTPException(400, f"unknown voice engine '{req.engine}' (kokoro or indic-parler)")
    except (tts_mod.TTSError, parler_client.ParlerError) as e:
        raise HTTPException(400, str(e))
    buf = io.BytesIO()
    sf.write(buf, audio, rate, format="WAV", subtype="PCM_16")
    duration = len(audio) / rate
    return Response(buf.getvalue(), media_type="audio/wav", headers={"X-Duration": f"{duration:.3f}"})


@app.post("/align")
def align(file: UploadFile = File(...), text: str = Form(...), language: str = Form("en")):
    path = _save_upload(file)
    try:
        words, duration = align_mod.align(path, text, language)
    except align_mod.AlignError as e:
        raise HTTPException(400, str(e))
    finally:
        os.unlink(path)
    return {"words": words, "duration": duration}


@app.post("/beats")
def beats(file: UploadFile = File(...), bpm_hint: float | None = Form(None)):
    path = _save_upload(file)
    try:
        return beats_mod.analyze(path, bpm_hint)
    except ValueError as e:
        raise HTTPException(400, str(e))
    finally:
        os.unlink(path)
