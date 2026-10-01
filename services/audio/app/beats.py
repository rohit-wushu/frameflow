"""Beat grid of a music track with librosa: BPM, beat times and downbeats.

librosa's tracker gets the tempo right but can lock onto off-beats (hi-hats) and reports
beats a frame or two late. So after tracking we:
  1. compare kick (low-band) energy on the beats vs half a beat later, and shift if needed;
  2. move each beat to its kick onset when there is a clear one nearby.
"""
import numpy as np

SR = 22050
HOP = 256  # librosa tracking resolution (~11.6 ms)
FINE_HOP = 64  # kick-onset resolution (~2.9 ms)
REFINE_WINDOW = 0.06  # seconds a beat may move to reach its kick


def low_band_onsets(y, sr, hop=FINE_HOP, win=512):
    """Rise in low-band (<150 Hz) energy per frame; frame k is time k * hop / sr."""
    from scipy.signal import butter, sosfilt

    low = sosfilt(butter(4, 150, btype="low", fs=sr, output="sos"), y)
    energy = np.convolve(low ** 2, np.ones(win) / win)[: len(low)][::hop]  # trailing window: rises right at the onset
    log_e = np.log(energy + 1e-6 * energy.max() + 1e-12)
    return np.maximum(0.0, np.diff(log_e, prepend=log_e[0]))


def _peak_near(env, t, radius, sr=SR, hop=FINE_HOP):
    i0 = max(0, int((t - radius) * sr / hop))
    i1 = min(len(env), int((t + radius) * sr / hop) + 1)
    if i1 <= i0:
        return 0.0, t
    k = i0 + int(np.argmax(env[i0:i1]))
    return float(env[k]), k * hop / sr


def fix_offbeat(beats, env):
    """If kicks sit half a beat away from the tracked beats, move the whole grid by half a beat."""
    half = float(np.median(np.diff(beats))) / 2
    on = sum(_peak_near(env, t, 0.03)[0] for t in beats)
    off = sum(_peak_near(env, t + half, 0.03)[0] for t in beats)
    return beats + half if off > 1.3 * on else beats


def refine(beats, env):
    """Snap each beat to its kick onset when a clear one is within REFINE_WINDOW."""
    peaks = [_peak_near(env, t, REFINE_WINDOW) for t in beats]
    threshold = 0.3 * np.percentile([p for p, _ in peaks], 75)
    return np.array([at if strength > threshold else t for t, (strength, at) in zip(beats, peaks)])


def downbeat_phase(beats, env, beats_per_bar=4):
    """Which of the 4 beat positions is the bar's "one": the one with the most kick energy."""
    strength = np.array([_peak_near(env, t, 0.03)[0] for t in beats])
    return int(np.argmax([strength[p::beats_per_bar].sum() for p in range(beats_per_bar)]))


def analyze(path, bpm_hint=None):
    import librosa

    y, sr = librosa.load(path, sr=SR, mono=True)
    onset_env = librosa.onset.onset_strength(y=y, sr=sr, hop_length=HOP)
    tempo, frames = librosa.beat.beat_track(onset_envelope=onset_env, sr=sr, hop_length=HOP, start_bpm=bpm_hint or 120.0)
    beats = librosa.frames_to_time(np.asarray(frames, dtype=int), sr=sr, hop_length=HOP)
    if len(beats) < 8:
        raise ValueError("too few beats detected; is this a music track?")

    env = low_band_onsets(y, sr)
    beats = refine(fix_offbeat(beats, env), env)
    beats = beats[beats < len(y) / sr]

    # BPM from the median beat spacing: steadier than librosa's tempo estimate for a finished track
    bpm = 60.0 / float(np.median(np.diff(beats)))
    phase = downbeat_phase(beats, env)
    return {
        "bpm": round(bpm, 2),
        "librosaTempo": round(float(np.atleast_1d(tempo)[0]), 2),
        "beats": [round(float(t), 4) for t in beats],
        "downbeats": [round(float(t), 4) for t in beats[phase::4]],
        "duration": round(len(y) / sr, 3),
    }
