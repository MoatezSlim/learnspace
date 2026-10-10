# Upscales (Real-ESRGAN x4) and mattes (BiRefNet) every frame listed in v3/boxes.json -> v3/x4/.
# Usage: python extract_frames.py
import sys, os, json, time, cv2, numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from esrgan import upscale
from matte import matte
im = cv2.imread('v3/sheet.png')
boxes = json.load(open('v3/boxes.json'))
todo = [('row1', 'r1', i) for i in range(14)] + [('row3', 'r3', i) for i in (4, 6, 8, 9, 3)]
for row, key, i in todo:
    out = f'v3/x4/{key}_{i:02d}'
    if os.path.exists(out + '_alpha.png'):
        continue
    l, t, r, b = boxes[row][i]
    t0 = time.time()
    if os.path.exists(out + '.png'):
        up = cv2.imread(out + '.png')
    else:
        up = upscale(im[t:b, l:r])
        cv2.imwrite(out + '.png', up)
    a = matte(up)
    cv2.imwrite(out + '_alpha.png', (a * 255).astype(np.uint8))
    print(out, up.shape, f'{time.time() - t0:.1f}s', flush=True)
print('done', flush=True)
