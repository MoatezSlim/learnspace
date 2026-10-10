# Steady hair: every front-facing expression keeps the reference frame's head, hair, neck and outfit;
# only the inner face (brows, eyes, nose, mouth, cheeks) comes from the expression. The expression's
# face is moved onto the reference face by its nose (template match refined to subpixel, checked
# against the white highlight on the tip of the nose), then blended with Poisson cloning so the skin
# tones meet without a seam.
# Reads v3/aligned/*.png (align_frames.py), writes v3/aligned_fs/*.png (same canvas) + v3/faceswap_sheet.png
# Usage: python face_composite.py   then   SRC=v3/aligned_fs python eye_rig.py <out dir>
import os, json, math, sys
import numpy as np, cv2
def nose_tip(img, x0=215, x1=390, y0=462, y1=560):
    """Centre of the white highlight on the tip of the nose (drawn in every frame of the sheet)."""
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV).astype(int)
    V = hsv[y0:y1, x0:x1, 2]; S = hsv[y0:y1, x0:x1, 1]
    for thr in (248, 240, 230):
        m = ((V >= thr) & (S < 60)).astype(np.uint8)
        n, lab, st, cen = cv2.connectedComponentsWithStats(m, 8)
        cands = [(st[i, 4], cen[i]) for i in range(1, n) if 4 <= st[i, 4] <= 250 and st[i, 2] <= 26 and st[i, 3] <= 22]
        if cands:
            area, c = max(cands, key=lambda t: t[0])
            return float(c[0] + x0), float(c[1] + y0), int(area), thr
    return None

SRC, DST = 'v3/aligned', 'v3/aligned_fs'
os.makedirs(DST, exist_ok=True)
meta = json.load(open(f'{SRC}/meta.json'))
CW, CH = meta['canvas']
REF = 'r1_00'
SWAP = ['r1_01', 'r1_02', 'r1_03', 'r1_04', 'r1_07', 'r1_08', 'r1_10', 'r1_11', 'r1_12']
# thinking (hand on the chin), curious (head tilted up), skeptical (head turned) and laugh (head tilted,
# face redrawn) keep their whole frame
KEEP = ['r1_05', 'r1_06', 'r1_09', 'r1_13']
MASK = dict(scale_x=float(os.environ.get('FS_SX', 0.98)), top=float(os.environ.get('FS_TOP', 0.62)),
            bottom=float(os.environ.get('FS_BOT', 1.47)), feather=int(os.environ.get('FS_FEATHER', 21)))

def load(k):
    x = cv2.imread(f'{SRC}/{k}.png', cv2.IMREAD_UNCHANGED)
    return x[..., :3].copy(), x[..., 3].copy()

base, base_a = load(REF)
# reference landmarks (x4 canvas): eye centres from the eye rig
EYE_L, EYE_R = np.array([182.6, 429.4]), np.array([376.5, 415.6])
mid = (EYE_L + EYE_R) / 2
d = np.linalg.norm(EYE_R - EYE_L)
ang = math.degrees(math.atan2(EYE_R[1] - EYE_L[1], EYE_R[0] - EYE_L[0]))

def face_mask(scale_x=0.76, top=0.50, bottom=1.30, feather=13):
    """Ellipse over the inner face, tilted like the eye line (in reference coordinates)."""
    m = np.zeros((CH, CW), np.uint8)
    y_top, y_bot = mid[1] - top * d, mid[1] + bottom * d
    ell_c = (float(mid[0] + d * 0.02), float((y_top + y_bot) / 2))
    axes = (float(d * scale_x), float((y_bot - y_top) / 2))
    cv2.ellipse(m, (ell_c, (axes[0] * 2, axes[1] * 2), ang), 255, -1, cv2.LINE_AA)
    m = np.where(m > 127, 255, 0).astype(np.uint8)
    m[base_a < 250] = 0                                  # never clone over the transparent edge
    x, y, w, h = cv2.boundingRect(m)
    center = (x + w // 2, y + h // 2)                    # seamlessClone centres the patch on this point
    soft = cv2.GaussianBlur(cv2.erode(m, np.ones((feather, feather), np.uint8)).astype(np.float32), (0, 0), feather / 2) / 255.
    return m, soft, center

mask8, soft, center = face_mask(**MASK)
NOSE = (285, 530)

def skin(img, alpha):
    """Face skin (with what it encloses: eyes, brows, mouth), told from the hair by its colour:
    blond hair is much yellower (Lab b - a) than the skin."""
    Lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB).astype(np.float32)
    f = cv2.GaussianBlur(Lab[..., 2] - Lab[..., 1], (0, 0), 2)
    m = ((f < 8) & (alpha > 200)).astype(np.uint8)
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))
    n, lab, st, _ = cv2.connectedComponentsWithStats(m, 8)
    i = lab[NOSE[1], NOSE[0]]
    if i == 0: i = 1 + int(np.argmax(st[1:, 4]))
    m = (lab == i).astype(np.uint8) * 255
    # fill what the face encloses (eyes, brows, mouth)
    ff = m.copy(); h, w = m.shape
    cv2.floodFill(ff, np.zeros((h + 2, w + 2), np.uint8), (0, 0), 255)
    return m | cv2.bitwise_not(ff)

ERODE_B = int(os.environ.get('FS_ERODE_B', 15))   # margin inside the reference face outline
ERODE_E = int(os.environ.get('FS_ERODE_E', 32))   # wider margin inside the expression's outline (its shading line)
base_skin = skin(base, base_a)
# both eyes with their eyeliner wings and the brows always come from the expression (their outer corners
# touch the hair at the temples, so the skin test alone would leave them out)
eyes = np.zeros_like(mask8)
for (ex, ey) in (EYE_L, EYE_R):
    cv2.ellipse(eyes, (int(ex), int(ey)), (82, 44), ang, 0, 360, 255, -1)
    cv2.ellipse(eyes, (int(ex), int(ey - 50)), (80, 34), ang, 0, 360, 255, -1)
# the mouth too: the reference smile's corners and every expression's mouth sit inside this
cv2.ellipse(eyes, (288, 588), (114, 52), ang, 0, 360, 255, -1)
eyes &= mask8
def ek(r):
    return cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1))
def mask_for(wimg, walpha):
    m = mask8 & cv2.erode(base_skin, ek(ERODE_B)) & cv2.erode(skin(wimg, walpha), ek(ERODE_E))
    m |= eyes
    # smooth outline, one piece
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (25, 25)))
    m = (cv2.GaussianBlur(m.astype(np.float32), (0, 0), 6) > 127).astype(np.uint8) * 255
    n, lab, st, _ = cv2.connectedComponentsWithStats(m, 8)
    if n > 2: m = (lab == 1 + int(np.argmax(st[1:, 4]))).astype(np.uint8) * 255
    x, y, w, h = cv2.boundingRect(m)
    f = MASK['feather']
    sf = cv2.GaussianBlur(cv2.erode(m, np.ones((f, f), np.uint8)).astype(np.float32), (0, 0), f / 2) / 255.
    return m, sf, (x + w // 2, y + h // 2)

def grad(g):
    gx = cv2.Sobel(g, cv2.CV_32F, 1, 0, ksize=3); gy = cv2.Sobel(g, cv2.CV_32F, 0, 1, ksize=3)
    return np.sqrt(gx * gx + gy * gy)

def subpix(res, ml):
    """Parabolic refinement of a correlation peak."""
    x, y = ml
    def p(a, b, c):
        den = a - 2 * b + c
        return 0.0 if abs(den) < 1e-9 else 0.5 * (a - c) / den
    dx = p(res[y, x - 1], res[y, x], res[y, x + 1]) if 0 < x < res.shape[1] - 1 else 0.0
    dy = p(res[y - 1, x], res[y, x], res[y + 1, x]) if 0 < y < res.shape[0] - 1 else 0.0
    return x + float(np.clip(dx, -0.5, 0.5)), y + float(np.clip(dy, -0.5, 0.5))

def nose_shift(img):
    g0 = cv2.GaussianBlur(cv2.cvtColor(base, cv2.COLOR_BGR2GRAY).astype(np.float32), (0, 0), 1.2)
    g1 = cv2.GaussianBlur(cv2.cvtColor(img, cv2.COLOR_BGR2GRAY).astype(np.float32), (0, 0), 1.2)
    nx, ny = NOSE
    best = None
    for (hw, ht, hb) in [(40, 30, 22), (52, 46, 30)]:
        tpl = g0[ny - ht:ny + hb, nx - hw:nx + hw]
        S = 46
        reg = g1[ny - ht - S:ny + hb + S, nx - hw - S:nx + hw + S]
        for mode, (a, b) in (('gray', (reg, tpl)), ('grad', (grad(reg), grad(tpl)))):
            res = cv2.matchTemplate(a, b, cv2.TM_CCOEFF_NORMED)
            _, mv, _, ml = cv2.minMaxLoc(res)
            sx, sy = subpix(res, ml)
            dx, dy = sx - S, sy - S
            if abs(dx) < S - 2 and abs(dy) < S - 2 and (best is None or mv > best[2]):
                best = (dx, dy, float(mv), mode, hw)
    return best

tip0 = nose_tip(base)
out_ids = [REF] + SWAP + KEEP
cv2.imwrite(f'{DST}/{REF}.png', np.dstack([base, base_a]))
report = {}
for k in SWAP:
    img, a = load(k)
    tdx, tdy, score, mode, hw = nose_shift(img)
    tip = nose_tip(img)
    dx, dy, how = tdx, tdy, 'template'
    if tip and tip0:
        hdx, hdy = tip[0] - tip0[0], tip[1] - tip0[1]
        if math.hypot(hdx - tdx, hdy - tdy) <= 4.5:      # both agree: average them
            dx, dy, how = (tdx + hdx) / 2, (tdy + hdy) / 2, 'template+tip'
    M = np.float32([[1, 0, -dx], [0, 1, -dy]])          # move the expression's face onto the reference face
    wimg = cv2.warpAffine(img, M, (CW, CH), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
    walpha = cv2.warpAffine(a, M, (CW, CH), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=0)
    m8, sf, c = mask_for(wimg, walpha)
    out = np.zeros_like(base)
    # OpenCV 5.0 seamlessClone needs fresh buffers on every call (it reuses its inputs otherwise)
    clone = cv2.seamlessClone(wimg.copy(), base.copy(), m8.copy(), (int(c[0]), int(c[1])), cv2.NORMAL_CLONE, out)
    clone = out if clone is None else clone
    comp = (clone.astype(np.float32) * sf[..., None] + base.astype(np.float32) * (1 - sf[..., None])).clip(0, 255).astype(np.uint8)
    cv2.imwrite(f'{DST}/{k}.png', np.dstack([comp, base_a]))
    cv2.imwrite(f'{DST}/_mask_{k}.png', m8)
    diff = float(np.abs(comp.astype(int) - base.astype(int))[m8 > 0].mean())
    report[k] = {'dx': round(dx, 2), 'dy': round(dy, 2), 'how': how, 'score': round(score, 3), 'mode': mode, 'tpl': hw, 'diff_in_mask': round(diff, 1)}
    print(k, report[k], flush=True)
json.dump(report, open(f'{DST}/shifts.json', 'w'), indent=1)
for k in KEEP:
    img, a = load(k)
    cv2.imwrite(f'{DST}/{k}.png', np.dstack([img, a]))
json.dump({'canvas': [CW, CH], 'ids': out_ids, 'swapped': SWAP, 'kept': KEEP, 'mask': MASK}, open(f'{DST}/meta.json', 'w'))

# contact sheet: composites on a light background + the mask outline on the reference
def comp_bg(x):
    al = x[..., 3:4].astype(np.float32) / 255
    return (x[..., :3].astype(np.float32) * al + np.full(x.shape[:2] + (3,), (250, 244, 238), np.float32) * (1 - al)).astype(np.uint8)
tiles = []
for k in out_ids:
    x = cv2.imread(f'{DST}/{k}.png', cv2.IMREAD_UNCHANGED)
    c = comp_bg(x)[200:760, 30:551]
    mk = mask8 if k == REF else (cv2.imread(f'{DST}/_mask_{k}.png', 0) if k in SWAP else None)
    if mk is not None and os.environ.get('FS_OUTLINE'):
        cnts, _ = cv2.findContours(np.ascontiguousarray(mk[200:760, 30:551]), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
        cv2.drawContours(c, cnts, -1, (0, 0, 255), 1)
    c = cv2.resize(c, None, fx=0.5, fy=0.5, interpolation=cv2.INTER_AREA)
    cv2.putText(c, k, (4, 14), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 0, 200), 1)
    tiles.append(c)
while len(tiles) % 7:
    tiles.append(np.full_like(tiles[0], 255))
rows = [np.hstack(tiles[i:i + 7]) for i in range(0, len(tiles), 7)]
cv2.imwrite('v3/faceswap_sheet.png', np.vstack(rows))
print('done')
