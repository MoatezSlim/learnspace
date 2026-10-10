import sys, torch, numpy as np, cv2
from transformers import AutoModelForImageSegmentation
torch.set_num_threads(8)
model = AutoModelForImageSegmentation.from_pretrained('ZhengPeng7/BiRefNet', trust_remote_code=True).eval().float()
def matte(img_bgr, size=1024):
    h, w = img_bgr.shape[:2]
    rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
    x = cv2.resize(rgb, (size, size), interpolation=cv2.INTER_AREA).astype(np.float32) / 255.
    x = (x - [0.485, 0.456, 0.406]) / [0.229, 0.224, 0.225]
    t = torch.from_numpy(x.transpose(2, 0, 1)).float()[None]
    with torch.no_grad():
        pred = model(t)[-1].sigmoid()[0, 0].numpy()
    return cv2.resize(pred, (w, h), interpolation=cv2.INTER_CUBIC).clip(0, 1)
if __name__ == '__main__':
    im = cv2.imread(sys.argv[1])
    a = matte(im)
    cv2.imwrite(sys.argv[2], (a * 255).astype(np.uint8)); print('ok', im.shape)
