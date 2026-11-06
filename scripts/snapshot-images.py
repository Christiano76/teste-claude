import json, base64, sys, os, urllib.request, concurrent.futures as cf, ssl
d = json.load(open("snapshot/data.json"))
combo_ids = {c["pc"] for c in d["combos"]} | {c["mon"] for c in d["combos"] if c["mon"]}
items = d["pcs"] + d["mons"] + d.get("kits", [])
top = {x["id"] for x in d["pcs"][:160]} | {x["id"] for x in d["mons"][:160]} | {x["id"] for x in d.get("kits", [])[:60]} | {x["id"] for x in d["pcs"] + d["mons"] + d.get("kits", []) if x.get("tier")} | combo_ids
proxy = urllib.request.ProxyHandler({"https": os.environ["HTTPS_PROXY"]})
ctx = ssl.create_default_context(cafile="/root/.ccr/ca-bundle.crt")
opener = urllib.request.build_opener(proxy, urllib.request.HTTPSHandler(context=ctx))
def get(x):
    if not x["img"]: return x["id"], None
    url = x["img"].replace("/xlarge/", "/medium/" if x["id"] in top else "/small/")
    try:
        r = opener.open(urllib.request.Request(url, headers={"User-Agent": "PCHunterBot/1.0"}), timeout=20)
        b = r.read(); ct = r.headers.get("Content-Type", "image/webp")
        return x["id"], f"data:{ct};base64," + base64.b64encode(b).decode()
    except Exception as e:
        return x["id"], None
out = {}
with cf.ThreadPoolExecutor(6) as ex:
    for i, v in ex.map(get, items):
        if v: out[i] = v
json.dump(out, open("snapshot/img.json", "w"))
print(len(items), "itens,", len(out), "imagens,", os.path.getsize("snapshot/img.json") // 1024, "KB")
