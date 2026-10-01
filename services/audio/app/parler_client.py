"""Client for the Indic voices service (services/parler, Indic Parler-TTS).

It lives in its own Python environment (parler-tts pins an older transformers than WhisperX needs), so
/tts requests for "indic-parler" voices are forwarded to it over HTTP. When it isn't running on this
machine, it is started on demand and stopped with this service.
"""
import atexit
import io
import json
import os
import subprocess
import threading
import time
import urllib.error
import urllib.request
from pathlib import Path
from urllib.parse import urlparse

import soundfile as sf

URL = os.environ.get("PARLER_URL", "http://127.0.0.1:8792").rstrip("/")
SERVICE_DIR = Path(__file__).resolve().parents[2] / "parler"
_proc = None
_start_lock = threading.Lock()


class ParlerError(ValueError):
    pass


def _request(path, body=None, timeout=5.0):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(f"{URL}{path}", data=data, method="POST" if body is not None else "GET", headers={"content-type": "application/json"})
    return urllib.request.urlopen(req, timeout=timeout)


def healthy():
    try:
        with _request("/health", timeout=2.0) as r:
            return r.status == 200
    except OSError:
        return False


def _stop():
    if _proc and _proc.poll() is None:
        _proc.terminate()


def ensure():
    """Start the service if it is local and not running yet (the model itself loads on the first request)."""
    global _proc
    if healthy():
        return
    with _start_lock:
        if healthy():
            return
        host, port = urlparse(URL).hostname, urlparse(URL).port or 80
        if host not in ("127.0.0.1", "localhost"):
            raise ParlerError(f"the Indic voices service at {URL} is not reachable")
        if not (SERVICE_DIR / ".venv").exists():
            raise ParlerError("the Indic voices service is not set up: run `pnpm parler:setup`")
        log = open(SERVICE_DIR / "parler.log", "a")
        _proc = subprocess.Popen(["uv", "run", "uvicorn", "app.main:app", "--host", host, "--port", str(port)], cwd=SERVICE_DIR, stdout=log, stderr=log)
        atexit.register(_stop)
        for _ in range(240):
            if _proc.poll() is not None:
                raise ParlerError(f"the Indic voices service exited while starting; see {SERVICE_DIR / 'parler.log'}")
            if healthy():
                return
            time.sleep(0.5)
        raise ParlerError("the Indic voices service did not start within 2 minutes")


def synthesize(text, voice_id, speed=1.0, style=None):
    """Return (mono float32 audio, sample rate)."""
    ensure()
    try:
        # the first request loads (and may download) the model: allow a long wait
        with _request("/tts", {"text": text, "voiceId": voice_id, "style": style, "speed": speed}, timeout=1800) as r:
            audio, rate = sf.read(io.BytesIO(r.read()), dtype="float32")
    except urllib.error.HTTPError as e:
        detail = e.read().decode(errors="replace")
        try:
            detail = json.loads(detail).get("detail", detail)
        except ValueError:
            pass
        raise ParlerError(f"Indic voice failed: {detail}") from e
    return audio, rate


def unload():
    """Free the model's memory (before rendering). Best effort."""
    if healthy():
        try:
            _request("/unload", {}, timeout=10.0).close()
        except OSError:
            pass
