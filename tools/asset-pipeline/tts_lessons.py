import sys, os, json, subprocess
import numpy as np, soundfile as sf
from huggingface_hub import hf_hub_download
from kokoro_onnx import Kokoro
LINES, OUTDIR, MANIFEST, VOICES = sys.argv[1:5]
k = Kokoro(hf_hub_download('onnx-community/Kokoro-82M-v1.0-ONNX', 'onnx/model.onnx'), VOICES)
lines = json.load(open(LINES)); man = {}
FIX = {'BA 1462': 'B A fourteen sixty-two', 'gate twenty-three': 'gate twenty-three'}
for ln in lines:
    text = ln['text']
    for a, b in FIX.items(): text = text.replace(a, b)
    samples, sr = k.create(text, voice=ln['voice'], speed=0.96, lang='en-gb')
    samples = np.asarray(samples, np.float32); samples = samples / (np.max(np.abs(samples)) or 1) * 0.89
    pad = np.zeros(int(0.08 * sr), np.float32); samples = np.concatenate([pad, samples, pad])
    wav = f"{OUTDIR}/l_{ln['key']}.wav"; mp3 = f"{OUTDIR}/l_{ln['key']}.mp3"
    sf.write(wav, samples, sr)
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', wav, '-ac', '1', '-ar', '24000', '-c:a', 'libmp3lame', '-b:a', '56k', mp3], check=True)
    os.remove(wav); man[ln['key']] = round(len(samples) / sr, 3)
    print(ln['voice'], man[ln['key']], ln['text'][:50], flush=True)
json.dump(man, open(MANIFEST, 'w'), separators=(',', ':'))
