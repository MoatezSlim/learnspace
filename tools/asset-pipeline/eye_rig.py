# Stage 2: eye rig on the aligned frames (x4 scale) and export.
#  - reference iris (frame r1_00) measured on its edges against the sclera, texture rebuilt (polar fill)
#  - other frames: iris found by template matching the reference iris (visible lower part)
#  - eye opening: corners and sclera boundaries -> two quadratic curves (top fitted on the sclera
#    columns only, because the dark upper iris merges with the lash line)
#  - base image: iris erased inside the opening (sclera fill) so the live iris can move
# Usage: SRC=v3/aligned_fs python eye_rig.py <out dir>   (frames, iris, faces and frames.json for src/lea-frames.json)
#        SRC defaults to v3/aligned; v3/aligned_fs is the output of face_composite.py (steady hair)
import sys, os, json, math
import numpy as np, cv2

OUT = sys.argv[1]
SRC = os.environ.get('SRC', 'v3/aligned')   # v3/aligned_fs: front expressions on the reference head
os.makedirs(OUT, exist_ok=True)
R = 0.72
meta = json.load(open(f'{SRC}/meta.json'))
CW, CH = meta['canvas']
NAMES = {
    'r1_00': 'neutral', 'r1_01': 'smile', 'r1_02': 'happy', 'r1_03': 'excited', 'r1_04': 'delighted',
    'r1_05': 'thinking', 'r1_06': 'curious', 'r1_07': 'surprised', 'r1_08': 'sad', 'r1_09': 'skeptical',
    'r1_10': 'wink', 'r1_11': 'wink2', 'r1_12': 'content', 'r1_13': 'laugh',
}
RIGGED = ['r1_00', 'r1_01', 'r1_02', 'r1_03', 'r1_04', 'r1_07', 'r1_08']
OVERRIDE = json.load(open('v3/eye_override.json')) if os.path.exists('v3/eye_override.json') else {}

def load(k):
    x = cv2.imread(f'{SRC}/{k}.png', cv2.IMREAD_UNCHANGED).astype(np.float32)
    return x[..., :3], x[..., 3] / 255.

def hsv(img):
    h = cv2.cvtColor(img.clip(0, 255).astype(np.uint8), cv2.COLOR_BGR2HSV).astype(np.int32)
    return h[..., 0], h[..., 1], h[..., 2]

def masks(img):
    H_, S_, V_ = hsv(img)
    blue = (H_ >= 90) & (H_ <= 132) & (S_ > 60) & (V_ > 45)
    darkblue = (H_ >= 95) & (H_ <= 140) & (V_ <= 110) & (S_ > 40)
    sclera = (S_ < 55) & (V_ > 165)
    return blue, darkblue, sclera

def fit_circle(pts):
    x, y = pts[:, 0].astype(float), pts[:, 1].astype(float)
    A = np.c_[2 * x, 2 * y, np.ones(len(x))]
    c, *_ = np.linalg.lstsq(A, x * x + y * y, rcond=None)
    cx, cy = c[0], c[1]
    return cx, cy, math.sqrt(max(1e-6, c[2] + cx * cx + cy * cy))

def quad_ctrl(a, b, pts):
    a, b = np.array(a, float), np.array(b, float)
    t = np.clip((pts[:, 0] - a[0]) / max(b[0] - a[0], 1e-6), 0.02, 0.98)
    k = 2 * (1 - t) * t
    q = pts - ((1 - t) ** 2)[:, None] * a - (t ** 2)[:, None] * b
    return (k[:, None] * q).sum(0) / (k * k).sum()

def bez(p0, c, p1, n=13):
    t = np.linspace(0, 1, n)[:, None]
    return (1 - t) ** 2 * np.array(p0, float) + 2 * (1 - t) * t * np.array(c, float) + t ** 2 * np.array(p1, float)

def blobs_in_band(img, a):
    blue, _, _ = masks(img)
    band = np.zeros(a.shape, bool); band[int(CH * 0.30):int(CH * 0.50), int(CW * 0.12):int(CW * 0.88)] = True
    m = (blue & band & (a > 0.9)).astype(np.uint8)
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    n, lab, st, cen = cv2.connectedComponentsWithStats(m, 8)
    bl = sorted([(st[i, 4], i) for i in range(1, n)], reverse=True)[:2]
    out = [(cen[i], st[i, :4], lab == i) for _, i in bl]
    return sorted(out, key=lambda b: b[0][0])

def ref_iris(img, blob):
    """Iris circle from its edge against the sclera (left, right, bottom)."""
    (cxb, cyb), (bx, by, bw, bh), m = blob
    blue, darkblue, sclera = masks(img)
    win = np.zeros(img.shape[:2], bool)
    win[int(cyb - bw * 1.2):int(cyb + bw * 1.0), int(cxb - bw * 1.6):int(cxb + bw * 1.6)] = True
    iris = (blue | darkblue) & win
    iris = cv2.morphologyEx(iris.astype(np.uint8), cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))) > 0
    scl = sclera & win
    near_scl = cv2.dilate(scl.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
    edge = (cv2.morphologyEx(iris.astype(np.uint8), cv2.MORPH_GRADIENT, np.ones((3, 3), np.uint8)) > 0) & near_scl
    pts = np.c_[np.nonzero(edge)[::-1]]
    cx, cy, r = fit_circle(pts)
    return cx, cy, r

def iris_texture(img, cx, cy, r, opening):
    pad = int(r + 6)
    ix, iy = int(round(cx)), int(round(cy))
    patch = img[iy - pad:iy + pad + 1, ix - pad:ix + pad + 1].astype(np.float32)
    valid = cv2.erode(opening.astype(np.uint8), np.ones((5, 5), np.uint8))[iy - pad:iy + pad + 1, ix - pad:ix + pad + 1]
    c = (pad + (cx - ix), pad + (cy - iy))
    NR, NA = 64, 360
    pol = cv2.warpPolar(patch, (NR, NA), c, r + 2, cv2.WARP_POLAR_LINEAR | cv2.INTER_CUBIC)
    pv = cv2.warpPolar(valid.astype(np.float32), (NR, NA), c, r + 2, cv2.WARP_POLAR_LINEAR | cv2.INTER_LINEAR) > 0.99
    for ri in range(NR):
        ok = np.nonzero(pv[:, ri])[0]; bad = np.nonzero(~pv[:, ri])[0]
        if len(ok) < 8 or len(bad) == 0:
            continue
        angs = np.r_[ok - NA, ok, ok + NA]
        for ch in range(3):
            vals = np.r_[pol[ok, ri, ch], pol[ok, ri, ch], pol[ok, ri, ch]]
            pol[bad, ri, ch] = np.interp(bad, angs, vals)
    good_rows = [q for q in range(NR) if pv[:, q].sum() >= 8]
    for ri in range(NR):
        if pv[:, ri].sum() < 8 and good_rows:
            pol[:, ri] = pol[:, min(good_rows, key=lambda q: abs(q - ri))]
    disc = cv2.warpPolar(pol, patch.shape[1::-1], c, r + 2, cv2.WARP_POLAR_LINEAR | cv2.WARP_INVERSE_MAP | cv2.INTER_CUBIC)
    yy, xx = np.mgrid[0:patch.shape[0], 0:patch.shape[1]]
    dd = np.hypot(xx - c[0], yy - c[1])
    da = np.clip((r + 0.5 - dd) / 1.6, 0, 1)
    return np.dstack([disc.clip(0, 255), da * 255]), pad

def match_iris(img, tex, r_ref, guess, search=22):
    """Template match of the reference iris (its lower 58 %, always visible) around `guess`."""
    best = (-2, None)
    gx, gy = guess
    for s in np.linspace(0.84, 1.16, 17):
        t = cv2.resize(tex, None, fx=s, fy=s, interpolation=cv2.INTER_AREA)
        th, tw = t.shape[:2]
        rr = r_ref * s
        yy, xx = np.mgrid[0:th, 0:tw]
        cyt, cxt = th / 2, tw / 2
        mk = ((np.hypot(xx - cxt, yy - cyt) < rr * 0.98) & (yy > cyt - rr * 0.16)).astype(np.float32)
        x0, y0 = int(gx - tw / 2 - search), int(gy - th / 2 - search)
        reg = img[y0:y0 + th + 2 * search, x0:x0 + tw + 2 * search].astype(np.float32)
        if reg.shape[0] < th or reg.shape[1] < tw:
            continue
        res = cv2.matchTemplate(reg, t[..., :3].astype(np.float32), cv2.TM_CCORR_NORMED, mask=np.dstack([mk] * 3))
        res = np.nan_to_num(res, nan=-1)
        _, mv, _, ml = cv2.minMaxLoc(res)
        if mv > best[0]:
            best = (mv, (x0 + ml[0] + tw / 2, y0 + ml[1] + th / 2, rr))
    return best

def cubic_ctrl(a, b, pts):
    """Two control points of the cubic Bezier from a to b closest to pts (t taken from x)."""
    a, b = np.array(a, float), np.array(b, float)
    t = np.clip((pts[:, 0] - a[0]) / max(b[0] - a[0], 1e-6), 0.01, 0.99)
    b1 = 3 * (1 - t) ** 2 * t; b2 = 3 * (1 - t) * t * t
    rhs = pts - ((1 - t) ** 3)[:, None] * a - (t ** 3)[:, None] * b
    A = np.c_[b1, b2]
    sol, *_ = np.linalg.lstsq(A, rhs, rcond=None)
    return sol[0], sol[1]

def cbez(p0, c1, c2, p1, n=13):
    t = np.linspace(0, 1, n)[:, None]
    return (1 - t) ** 3 * p0 + 3 * (1 - t) ** 2 * t * c1 + 3 * (1 - t) * t * t * c2 + t ** 3 * p1

def opening(img, a, cx, cy, r):
    H_, S_, V_ = hsv(img)
    B_, G_, R_ = img[..., 0], img[..., 1], img[..., 2]
    X0, X1 = int(cx - r * 2.9), int(cx + r * 2.9)
    Y0, Y1 = int(cy - r * 1.7), int(cy + r * 1.5)
    win = np.zeros(a.shape, bool); win[Y0:Y1, X0:X1] = True
    yy, xx = np.mgrid[0:a.shape[0], 0:a.shape[1]]
    d = np.hypot(xx - cx, yy - cy)
    sclera = (S_ < 62) & (V_ > 145) & win & (d > r * 0.98) & (yy < cy + r * 1.0) & (yy > cy - r * 1.3)
    n, lab = cv2.connectedComponents(sclera.astype(np.uint8), 8)
    ring = (d <= r * 1.3) & win
    keep = np.zeros_like(sclera)
    for i in range(1, n):
        part = lab == i
        if (part & ring).sum() > 4 and part.sum() > 25:
            keep |= part
    sclera = keep
    ys, xs = np.nonzero(sclera)
    if len(xs) < 30:
        return None
    band = (ys > cy - r * 0.95) & (ys < cy + r * 0.72)
    xb, yb_ = xs[band], ys[band]
    xl, xr = xb.min(), xb.max()
    al = np.array([xl - 0.5, yb_[xb <= xl + 1].mean()], float); ar = np.array([xr + 0.5, yb_[xb >= xr - 1].mean()], float)
    sclera &= (xx >= xl) & (xx <= xr)
    bluish = ((B_ - R_) >= 5) & (B_ >= 10) & (d <= r * 1.02)
    bright_blue = (H_ >= 90) & (H_ <= 132) & (S_ > 60) & (V_ > 45) & (d <= r * 1.04)
    tops, bots = [], []
    for c in range(int(xl) + 1, int(xr)):
        dx = abs(c - cx)
        col_s = np.nonzero(sclera[:, c])[0]
        if dx > r * 0.95 and len(col_s):
            tops.append([c, col_s.min() - 0.5]); bots.append([c, col_s.max() + 0.5])
            continue
        if dx < r * 0.95:
            if dx > r * 0.35:
                yb = np.nonzero(bluish[:, c] & (yy[:, c] < cy))[0]
                if len(yb):
                    tops.append([c, yb.min() - 0.5])
            yl = np.nonzero((bright_blue[:, c] | sclera[:, c]) & (yy[:, c] > cy))[0]
            if len(yl):
                bots.append([c, yl.max() + 0.5])
    tops, bots = np.array(tops, float), np.array(bots, float)
    if len(tops) < 6 or len(bots) < 6:
        return None
    def robust(pts):
        c1, c2 = cubic_ctrl(al, ar, pts)
        for _ in range(2):
            curve = cbez(al, c1, c2, ar, 200)
            res = np.abs(pts[:, 1] - np.interp(pts[:, 0], curve[:, 0], curve[:, 1]))
            keep = res < 3.0
            if keep.sum() < 6 or keep.all():
                break
            pts = pts[keep]; c1, c2 = cubic_ctrl(al, ar, pts)
        return c1, c2, pts
    t1, t2, tops = robust(tops); b1, b2, bots = robust(bots)
    return dict(a=al, b=ar, t1=t1, t2=t2, b1=b1, b2=b2, tops=tops, bots=bots)

def curves(e, n=13):
    return cbez(e['a'], e['t1'], e['t2'], e['b'], n), cbez(e['a'], e['b1'], e['b2'], e['b'], n)

def poly_mask(poly, shape):
    m = np.zeros(shape, np.uint8)
    cv2.fillPoly(m, [np.round(poly * 8).astype(np.int32)], 255, lineType=cv2.LINE_AA, shift=3)
    return m.astype(np.float32) / 255.

def fill_sclera(work, img, e, iris):
    top, bot = curves(e, 64)
    m = poly_mask(np.r_[top, bot[::-1]], img.shape[:2])
    cx, cy, r = iris
    yy, xx = np.mgrid[0:img.shape[0], 0:img.shape[1]]
    ttop = np.interp(xx, top[:, 0], top[:, 1]); tbot = np.interp(xx, bot[:, 0], bot[:, 1])
    vv = np.clip((yy - ttop) / np.maximum(tbot - ttop, 1), 0, 1)
    mid = (e['a'][0] + e['b'][0]) / 2; half = abs(e['b'][0] - e['a'][0]) / 2
    d = np.clip(np.abs(xx - mid) / half, 0, 1)
    cand = (m > 0.9) & (np.hypot(xx - cx, yy - cy) > r + 3)
    H_, S_, V_ = hsv(img)
    strict = cand & (S_ < 40) & (V_ > 175)
    pix = img[strict].astype(np.float32)
    if len(pix) < 20:
        pix = img[cand].astype(np.float32)
    lum = pix.mean(1) if len(pix) else np.array([])
    sc = np.percentile(pix[lum > np.percentile(lum, 40)], 60, axis=0) if len(pix) > 20 else np.array([240, 241, 245], np.float32)
    shade = (0.74 + 0.26 * np.clip(vv / 0.55, 0, 1) ** 0.8) * (1 - 0.12 * np.clip((d - 0.6) / 0.4, 0, 1))
    sclera = sc[None, None, :] * shade[..., None]
    inner = cv2.GaussianBlur(cv2.erode(m, np.ones((3, 3), np.uint8)), (0, 0), 1.1)
    work[:] = work * (1 - inner[..., None]) + sclera * inner[..., None]
    band = (yy > ttop - 34) & (yy < ttop - 14) & (xx > e['a'][0] + 8) & (xx < e['b'][0] - 8)
    lid = np.median(img[band].astype(np.float32), axis=0)
    lb = (yy > ttop - 10) & (yy < ttop + 1) & (xx > e['a'][0] + 10) & (xx < e['b'][0] - 10)
    lash = np.percentile(img[lb].astype(np.float32), 8, axis=0)
    return lid, lash, sc

hexc = lambda bgr: '#%02x%02x%02x' % tuple(int(x) for x in bgr[::-1])

# ---------------------------------------------------------------- reference
ref_img, ref_a = load('r1_00')
rb = blobs_in_band(ref_img, ref_a)
ref_eyes = []
for b in rb:
    cx, cy, r = ref_iris(ref_img, b)
    ref_eyes.append((cx, cy, r))
print('reference irises', [tuple(round(v, 1) for v in e) for e in ref_eyes])
e0 = opening(ref_img, ref_a, *ref_eyes[0])
top0, bot0 = curves(e0, 64)
op0 = poly_mask(np.r_[top0, bot0[::-1]], ref_img.shape[:2]) > 0.5
tex, tpad = iris_texture(ref_img, *ref_eyes[0], op0)
r_ref = ref_eyes[0][2]
cv2.imwrite(f'{OUT}/iris.webp', cv2.resize(tex, None, fx=R, fy=R, interpolation=cv2.INTER_AREA).astype(np.uint8), [cv2.IMWRITE_WEBP_QUALITY, 95])
cv2.imwrite('v3/iris_tex.png', tex.astype(np.uint8))

out = {'canvas': [round(CW * R), round(CH * R)], 'iris': {'src': 'x/iris.webp', 'r': round(r_ref * R, 2), 'size': round((2 * tpad + 1) * R, 2)}, 'frames': {}}
dbg_rows = []
for k, name in NAMES.items():
    img, a = load(k)
    work = img.copy()
    entry = {'src': f'x/{name}.webp', 'eyes': []}
    if k in RIGGED:
        tiles = []
        for side, (gx, gy, gr) in zip('LR', ref_eyes):
            ov = OVERRIDE.get(f'{k}.{side}', {})
            if k == 'r1_00':
                cx, cy, r = gx, gy, gr; score = 1.0
            else:
                score, (cx, cy, r) = match_iris(img, tex, r_ref, (gx, gy))
            if 'iris' in ov:
                cx, cy, r = ov['iris']
            e = opening(img, a, cx, cy, r)
            if not e:
                print(f'  {k} {side}: no opening (score {score:.3f})'); continue
            for key in ('a', 'b', 't1', 't2', 'b1', 'b2'):
                if key in ov:
                    e[key] = np.array(ov[key], float)
            for key, dd in ov.get('shift', {}).items():
                e[key] = e[key] + np.array(dd, float)
            lid, lash, sc = fill_sclera(work, img, e, (cx, cy, r))
            top, bot = curves(e)
            w = abs(e['b'][0] - e['a'][0])
            entry['eyes'].append({
                'top': (top * R).round(1).tolist(), 'bottom': (bot * R).round(1).tolist(),
                'iris': [round(cx * R, 1), round(cy * R, 1), round(r * R, 2)],
                'range': [round(min(r * 0.85, max(2.0, w / 2 - r * 0.6)) * R, 1), round(r * 0.3 * R, 1)],
                'lid': hexc(lid), 'lash': hexc(lash),
            })
            print(f'  {k} {side}: match {score:.3f} iris ({cx:.1f},{cy:.1f}) r{r:.1f}  w{w:.0f}  corners {e["a"].round(1)} {e["b"].round(1)}')
            # debug: original with curves | erased
            X0, X1, Y0, Y1 = int(e['a'][0]) - 14, int(e['b'][0]) + 14, int(cy - r * 1.7), int(cy + r * 1.6)
            d1 = img[Y0:Y1, X0:X1].clip(0, 255).astype(np.uint8).copy()
            d2 = work[Y0:Y1, X0:X1].clip(0, 255).astype(np.uint8).copy()
            for d in (d1,):
                off = np.array([X0, Y0], float)
                tt, bb = curves(e, 40)
                cv2.polylines(d, [np.round((np.r_[tt, bb[::-1]] - off) * 4).astype(np.int32)], True, (0, 220, 0), 1, cv2.LINE_AA, shift=2)
                for q in np.r_[e['tops'], e['bots']]:
                    cv2.circle(d, (int(round((q[0] - X0) * 4)), int(round((q[1] - Y0) * 4))), 2, (255, 0, 255), -1, cv2.LINE_AA, shift=2)
                cv2.circle(d, (int(round((cx - X0) * 4)), int(round((cy - Y0) * 4))), int(round(r * 4)), (0, 0, 255), 1, cv2.LINE_AA, shift=2)
            z = lambda q: cv2.resize(q, None, fx=3, fy=3, interpolation=cv2.INTER_NEAREST)
            t = np.hstack([z(d1), z(d2)])
            cv2.putText(t, f'{k}.{side}', (4, 16), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255), 1)
            tiles.append(t)
        if tiles:
            h = max(t.shape[0] for t in tiles)
            dbg_rows.append(np.hstack([cv2.copyMakeBorder(t, 0, h - t.shape[0], 0, 8, cv2.BORDER_CONSTANT, value=(255, 255, 255)) for t in tiles]))
    if k == 'r1_00':
        ex = [e['iris'] for e in entry['eyes']]
        out['eyeMid'] = [round((ex[0][0] + ex[1][0]) / 2, 1), round((ex[0][1] + ex[1][1]) / 2, 1)]
    rgba = np.dstack([work.clip(0, 255), (a * 255).clip(0, 255)])
    small = cv2.resize(rgba, (round(CW * R), round(CH * R)), interpolation=cv2.INTER_AREA)
    os.makedirs(f'{OUT}/x', exist_ok=True)
    cv2.imwrite(f'{OUT}/x/{name}.webp', small.astype(np.uint8), [cv2.IMWRITE_WEBP_QUALITY, 90])
    out['frames'][name] = entry
if os.path.exists(f'{OUT}/iris.webp'):
    os.replace(f'{OUT}/iris.webp', f'{OUT}/x/iris.webp')
json.dump(out, open(f'{OUT}/frames.json', 'w'), indent=1)
if dbg_rows:
    w = max(r.shape[1] for r in dbg_rows)
    cv2.imwrite('v3/eyes_debug.png', np.vstack([cv2.copyMakeBorder(r, 0, 6, 0, w - r.shape[1], cv2.BORDER_CONSTANT, value=(255, 255, 255)) for r in dbg_rows]))
print('done')

# ---------------------------------------------------------------- small round faces (static, irises intact)
src, sa = load('r1_00')
x0, y0, sz = int(34 / R), int(150 / R), int(350 / R)
crop = np.dstack([src, sa * 255])[y0:y0 + sz, x0:x0 + sz]
face = cv2.resize(crop, (256, 256), interpolation=cv2.INTER_AREA)
cv2.imwrite(f'{OUT}/face.webp', face.clip(0, 255).astype(np.uint8), [cv2.IMWRITE_WEBP_QUALITY, 92])
al = face[..., 3:4] / 255
yy = np.linspace(0, 1, 256)[:, None, None]
bg = (np.array([251, 244, 234], np.float32) * (1 - yy) + np.array([246, 232, 214], np.float32) * yy) * np.ones((256, 256, 3), np.float32)
light = face[..., :3] * al + bg * (1 - al)
cv2.imwrite(f'{OUT}/face_light.webp', light.clip(0, 255).astype(np.uint8), [cv2.IMWRITE_WEBP_QUALITY, 92])
print('faces written')
