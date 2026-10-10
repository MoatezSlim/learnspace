# Finds the frames of the character sheet: row bands, then one box per head (row 1: 14 expressions,
# row 3: 12 poses). Writes v3/boxes.json. Usage: python find_frames.py   (expects v3/sheet.png)
import json, cv2, numpy as np
im = cv2.imread('v3/sheet.png')
hsv = cv2.cvtColor(im, cv2.COLOR_BGR2HSV)
fg = (hsv[..., 1].astype(int) > 40) | (hsv[..., 2].astype(int) < 150)   # the checkerboard is grey/white

def runs(prof, thr, minlen):
    out, start = [], None
    for x, v in enumerate(prof):
        if v > thr and start is None: start = x
        if v <= thr and start is not None:
            if x - start >= minlen: out.append((start, x))
            start = None
    if start is not None: out.append((start, len(prof)))
    return out

bands = runs(fg.mean(1), 0.02, 40)          # rows of the sheet
boxes = {}
for name, (y0, y1) in zip(['row1', 'row2', 'row3'], bands):
    if name == 'row2':
        continue                              # eye close-ups (not used)
    heads = runs(fg[y0:y0 + int((y1 - y0) * 0.45)].mean(0), 0.03, 25)
    xs = []
    for i, (a, b) in enumerate(heads):
        left = 0 if i == 0 else (heads[i - 1][1] + a) // 2
        right = im.shape[1] if i == len(heads) - 1 else (b + heads[i + 1][0]) // 2
        xs.append((left, max(0, y0 - 16), right, min(im.shape[0], y1 + 8)))
    boxes[name] = xs
json.dump(boxes, open('v3/boxes.json', 'w'))
print({k: len(v) for k, v in boxes.items()})
