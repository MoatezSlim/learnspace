# Aligns Léa's frames (v3/x4: x4 upscaled + matted) on one canvas:
#  - colour decontamination of the soft edges, neighbouring frames' pieces removed
#  - alignment on the reference expression by silhouette (head and hair outline; shoulders for poses)
#  - common silhouette (fade where the sheet cut any frame), canvas cropped to the union
import sys, os, json, math
import numpy as np, cv2

OUT = sys.argv[1] if len(sys.argv) > 1 else 'v3/out'
os.makedirs(OUT, exist_ok=True)
SRC = 'v3/x4'
REF = 'r1_00'
R = 0.72  # export scale relative to the x4 working images

NAMES = {  # frame id -> expression name
    'r1_00': 'neutral', 'r1_01': 'smile', 'r1_02': 'happy', 'r1_03': 'excited', 'r1_04': 'delighted',
    'r1_05': 'thinking', 'r1_06': 'curious', 'r1_07': 'surprised', 'r1_08': 'sad', 'r1_09': 'skeptical',
    'r1_10': 'wink', 'r1_11': 'wink2', 'r1_12': 'content', 'r1_13': 'laugh',
    'r3_04': 'downRight', 'r3_06': 'lookUp', 'r3_08': 'downLeft', 'r3_09': 'shy', 'r3_03': 'shyLeft',
}
RIGGED = {'r1_00', 'r1_01', 'r1_02', 'r1_03', 'r1_04', 'r1_07', 'r1_08', 'r1_09'}
POSES = {'r3_04', 'r3_06', 'r3_08', 'r3_09', 'r3_03'}

ids = [k for k in NAMES if os.path.exists(f'{SRC}/{k}_alpha.png')]
print('frames', len(ids), ids)

# ------------------------------------------------------------------ decontaminate
from pymatting import estimate_foreground_ml
def clean(img, a):
    a = a.copy(); a[a < 0.03] = 0
    small = 0.5
    im_s = cv2.resize(img, None, fx=small, fy=small, interpolation=cv2.INTER_AREA).astype(np.float64) / 255.
    a_s = cv2.resize(a, None, fx=small, fy=small, interpolation=cv2.INTER_AREA).astype(np.float64)
    fg_s = estimate_foreground_ml(im_s[..., ::-1], a_s)[..., ::-1]
    fg = cv2.resize((fg_s * 255).clip(0, 255).astype(np.float32), (img.shape[1], img.shape[0]), interpolation=cv2.INTER_CUBIC)
    wmix = np.clip((a - 0.9) / 0.1, 0, 1)[..., None]
    out = img.astype(np.float32) * wmix + fg * (1 - wmix)
    # keep only the main figure (drop pieces of the neighbouring frames)
    n, lab, stats, _ = cv2.connectedComponentsWithStats((a > 0.15).astype(np.uint8), 8)
    if n > 1:
        big = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
        keep = cv2.dilate((lab == big).astype(np.uint8), np.ones((9, 9), np.uint8)).astype(np.float32)
        a = a * keep
    return out.clip(0, 255), a

frames = {}
for k in ids:
    img = cv2.imread(f'{SRC}/{k}.png')
    a = cv2.imread(f'{SRC}/{k}_alpha.png', cv2.IMREAD_GRAYSCALE).astype(np.float32) / 255.
    work, a = clean(img, a)
    frames[k] = {'img': work, 'a': a, 'valid': np.ones(a.shape, np.float32)}
    print('clean', k, img.shape, flush=True)

# ------------------------------------------------------------------ alignment
# The frames were drawn separately, so feature matching is unreliable. Each frame is aligned on the
# reference by its silhouette: the head and hair outline for expressions, the shoulders for poses
# (their head turns). Search over scale and a small rotation, translation by phase correlation.
ref = frames[REF]
PAD_X, PAD_T, PAD_B = 90, 60, 10
CW, CH = ref['a'].shape[1] + 2 * PAD_X, ref['a'].shape[0] + PAD_T + PAD_B
Q = 0.25

def placed(a):
    c = np.zeros((CH, CW), np.float32)
    h, w = a.shape
    c[PAD_T:PAD_T + h, PAD_X:PAD_X + w] = a[:CH - PAD_T, :CW - PAD_X]
    return c

def region_mask(a, kind):
    """Weights for the part of the silhouette used to align (in canvas coordinates)."""
    ys, xs = np.nonzero(a > 0.5)
    top, bot = ys.min(), ys.max()
    m = np.zeros_like(a)
    if kind == 'head':
        m[top:top + int((bot - top) * 0.56)] = 1
    else:
        y0 = top + int((bot - top) * 0.66)
        x0, x1 = xs.min(), xs.max(); cut = int((x1 - x0) * 0.12)
        m[y0:bot - 6, x0 + cut:x1 - cut] = 1
    return m

def score(r, m):
    return float((r * m).sum() / (np.sqrt((r * r).sum() * (m * m).sum()) + 1e-6))

T = {}
ref_full = placed(ref['a'])
blur = lambda x: cv2.GaussianBlur(x, (0, 0), 1.2)
for k, f in frames.items():
    if k == REF:
        T[k] = np.array([[1, 0, PAD_X], [0, 1, PAD_T]], np.float64); continue
    kind = 'body' if k in POSES else 'head'
    rq = blur(cv2.resize(ref_full * region_mask(ref_full, kind), None, fx=Q, fy=Q, interpolation=cv2.INTER_AREA))
    hq, wq = rq.shape
    fa = placed(f['a'])
    fq0 = cv2.resize(fa * region_mask(fa, kind), (wq, hq), interpolation=cv2.INTER_AREA)
    best = (-1.0, None, 0.0, 0.0)
    for sc in np.linspace(0.90, 1.10, 21):
        for rot in np.linspace(-3, 3, 7):
            M = cv2.getRotationMatrix2D((wq / 2, hq * 0.4), rot, sc)
            mq = blur(cv2.warpAffine(fq0, M, (wq, hq)))
            (dx, dy), _ = cv2.phaseCorrelate(rq.astype(np.float64), mq.astype(np.float64))
            for sgn in (1, -1):
                M2 = M.copy(); M2[0, 2] -= sgn * dx; M2[1, 2] -= sgn * dy
                sco = score(rq, blur(cv2.warpAffine(fq0, M2, (wq, hq))))
                if sco > best[0]:
                    best = (sco, M2.copy(), sc, rot)
    sco, M2, sc, rot = best
    Mf = M2.copy(); Mf[:, 2] /= Q
    P = np.array([[1, 0, PAD_X], [0, 1, PAD_T], [0, 0, 1]], np.float64)
    T[k] = (np.vstack([Mf, [0, 0, 1]]) @ P)[:2]
    print(f'align {k} ({kind}): score {sco:.3f} scale {sc:.3f} rot {rot:.1f} t ({Mf[0,2]:.1f},{Mf[1,2]:.1f})', flush=True)

for k, f in frames.items():
    M = T[k]
    f['img'] = cv2.warpAffine(f['img'], M, (CW, CH), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
    f['a'] = cv2.warpAffine(f['a'], M, (CW, CH), flags=cv2.INTER_LINEAR, borderValue=0)
    f['valid'] = cv2.warpAffine(f['valid'], M, (CW, CH), flags=cv2.INTER_LINEAR, borderValue=0)

# common silhouette: fade where any expression frame was cut by the sheet (sides, bottom)
common = np.ones((CH, CW), np.float32)
for k, f in frames.items():
    if k.startswith('r1'):
        common = np.minimum(common, cv2.erode(f['valid'], np.ones((5, 5), np.uint8)))
dist = cv2.distanceTransform((common > 0.99).astype(np.uint8), cv2.DIST_L2, 5)
fade = np.clip(dist / 46.0, 0, 1) ** 1.2
for f in frames.values():
    f['a'] = f['a'] * fade

# crop the canvas to the union of silhouettes
union = np.zeros((CH, CW), np.float32)
for f in frames.values():
    union = np.maximum(union, f['a'])
ys, xs = np.nonzero(union > 0.02)
x0, x1, y0, y1 = max(0, xs.min() - 6), min(CW, xs.max() + 7), max(0, ys.min() - 6), min(CH, ys.max() + 7)
for f in frames.values():
    for key in ('img', 'a'):
        f[key] = f[key][y0:y1, x0:x1]
CH, CW = y1 - y0, x1 - x0
print('canvas', CW, CH)

# ------------------------------------------------------------------ save the aligned frames (x4 scale, RGBA)
os.makedirs('v3/aligned', exist_ok=True)
for k, f in frames.items():
    rgba = np.dstack([f['img'].clip(0, 255), (f['a'] * 255).clip(0, 255)]).astype(np.uint8)
    cv2.imwrite(f'v3/aligned/{k}.png', rgba)
json.dump({'canvas': [int(CW), int(CH)], 'ids': ids}, open('v3/aligned/meta.json', 'w'))
print('saved aligned frames', CW, CH)
