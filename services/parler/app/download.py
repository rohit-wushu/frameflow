"""Download the Indic Parler-TTS model ahead of time (pnpm parler:setup), so the first video doesn't wait."""
import os
import sys

from app import env

env.load()

from huggingface_hub import snapshot_download  # noqa: E402 (reads HF_TOKEN when imported)

MODEL_ID = os.environ.get("PARLER_MODEL", "ai4bharat/indic-parler-tts")

if __name__ == "__main__":
    if not os.environ.get("HF_TOKEN"):
        sys.exit("HF_TOKEN is not set: accept the model's terms on huggingface.co, create a read token and add HF_TOKEN=... to .env")
    path = snapshot_download(MODEL_ID)
    # the description encoder is a separate model the tokenizer is loaded from
    snapshot_download("google/flan-t5-large", allow_patterns=["*.json", "*.model", "*.txt"])
    print(f"downloaded {MODEL_ID} to {path}")
