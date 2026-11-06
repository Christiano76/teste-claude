import json, base64, io, os
from PIL import Image
d = json.load(open("snapshot/data.json")); imgs = json.load(open("snapshot/img.json"))
combo_ids = {c["pc"] for c in d["combos"]} | {c["mon"] for c in d["combos"] if c["mon"]}
top = {x["id"] for x in d["pcs"][:160]} | {x["id"] for x in d["mons"][:160]} | combo_ids
out = {}
for k, v in imgs.items():
    raw = base64.b64decode(v.split(",", 1)[1])
    try:
        im = Image.open(io.BytesIO(raw)); im.load()
        if im.mode in ("RGBA", "LA", "P"):
            im = im.convert("RGBA"); bg = Image.new("RGB", im.size, (255, 255, 255)); bg.paste(im, mask=im.split()[-1]); im = bg
        else: im = im.convert("RGB")
        side = 220 if int(k) in top else 140
        im.thumbnail((side, side))
        buf = io.BytesIO(); im.save(buf, "WEBP", quality=62, method=6)
        out[k] = "data:image/webp;base64," + base64.b64encode(buf.getvalue()).decode()
    except Exception:
        pass
json.dump(out, open("snapshot/img.json", "w"))
print(len(out), os.path.getsize("snapshot/img.json") // 1024, "KB")
