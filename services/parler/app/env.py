"""Read HF_TOKEN (and PARLER_*) from the repo's .env when they aren't in the environment already."""
import os
from pathlib import Path

ENV_FILE = Path(__file__).resolve().parents[3] / ".env"


def load():
    if not ENV_FILE.exists():
        return
    for line in ENV_FILE.read_text().splitlines():
        key, sep, value = line.partition("=")
        key = key.strip()
        if sep and (key == "HF_TOKEN" or key.startswith("PARLER_")) and key not in os.environ:
            os.environ[key] = value.strip().strip('"').strip("'")
