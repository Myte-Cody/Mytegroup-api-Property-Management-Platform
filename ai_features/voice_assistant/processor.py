import wave
from .constants import PRICING

def calculate_cost(cost_type: str, units: float) -> float:
    if cost_type == "audio":
        return (units / 60) * PRICING["whisper_per_min"]
    elif cost_type == "input_tokens":
        return (units / 1_000_000) * PRICING["gpt4o_input_per_1m"]
    elif cost_type == "output_tokens":
        return (units / 1_000_000) * PRICING["gpt4o_output_per_1m"]
    return 0.0

def get_audio_duration(file_obj) -> float:
    try:
        file_obj.seek(0)
        with wave.open(file_obj, 'rb') as wf:
            frames = wf.getnframes()
            rate = wf.getframerate()
            duration = frames / float(rate)
        file_obj.seek(0)
        return duration
    except Exception:
        return 0.0
