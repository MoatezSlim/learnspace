import sys, torch, numpy as np, cv2
from huggingface_hub import hf_hub_download
from spandrel import ModelLoader
torch.set_num_threads(8)
p = hf_hub_download('lllyasviel/Annotators', 'RealESRGAN_x4plus.pth')
model = ModelLoader().load_from_file(p).eval()
def upscale(img_bgr, tile=256, pad=16):
    img = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB).astype(np.float32)/255.
    h, w = img.shape[:2]; s = model.scale
    out = np.zeros((h*s, w*s, 3), np.float32)
    t = torch.from_numpy(img).permute(2,0,1)[None]
    with torch.no_grad():
        for y in range(0, h, tile):
            for x in range(0, w, tile):
                y0, x0 = max(0, y-pad), max(0, x-pad); y1, x1 = min(h, y+tile+pad), min(w, x+tile+pad)
                o = model(t[:, :, y0:y1, x0:x1])[0].permute(1,2,0).clamp(0,1).numpy()
                oy, ox = (y-y0)*s, (x-x0)*s; th, tw = min(tile, h-y)*s, min(tile, w-x)*s
                out[y*s:y*s+th, x*s:x*s+tw] = o[oy:oy+th, ox:ox+tw]
    return cv2.cvtColor((out*255+.5).astype(np.uint8), cv2.COLOR_RGB2BGR)
if __name__ == '__main__':
    src, dst = sys.argv[1], sys.argv[2]
    box = [int(v) for v in sys.argv[3].split(',')] if len(sys.argv) > 3 else None
    im = cv2.imread(src)
    if box: im = im[box[1]:box[3], box[0]:box[2]]
    cv2.imwrite(dst, upscale(im)); print('ok', im.shape)
