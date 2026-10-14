"""Verify schwartz live logo + PWA icons match the brand mark."""
import hashlib
import urllib.request
from pathlib import Path

from PIL import Image

BASE = "https://detailing-schwartz.deteiling-pro.workers.dev"
UA = {"User-Agent": "Mozilla/5.0"}
ok = fail = 0


def check(name, cond, detail=""):
    global ok, fail
    if cond:
        ok += 1
        print(f"  OK  {name} {detail}")
    else:
        fail += 1
        print(f"  FAIL {name} {detail}")


def fetch(path):
    req = urllib.request.Request(BASE + path, headers=UA)
    with urllib.request.urlopen(req, timeout=20) as r:
        return r.read(), r.headers.get("Content-Type", "")


print("=== logo + icons live ===")
logo, ct = fetch("/assets/logo.jpg")
check("logo.jpg 200", len(logo) > 1000, f"{len(logo)} bytes {ct}")
check("logo is our file", hashlib.sha256(logo).hexdigest()[:12])
local_logo = Path("clients/schwartz/assets/logo.jpg").read_bytes()
check("logo matches client asset", logo == local_logo)

header, _ = fetch("/assets/logo-header.jpg")
check("logo-header matches", header == local_logo)

for path, min_size in [
    ("/icons/icon-180.png", 2000),
    ("/icons/icon-192.png", 2000),
    ("/icons/icon-512.png", 5000),
    ("/icons/maskable-512.png", 5000),
    ("/icons/startup-750x1334.png", 5000),
    ("/icons/startup-1170x2532.png", 5000),
    ("/icon-192.png", 2000),
    ("/icon-512.png", 5000),
    ("/favicon.svg", 200),
]:
    data, ct = fetch(path)
    check(f"{path} served", len(data) >= min_size, f"{len(data)} bytes {ct}")

# visual: icon should be mostly black with white text (brand mark)
import io

for path, size in [("/icons/icon-512.png", 512), ("/icons/maskable-512.png", 512)]:
    data, _ = fetch(path)
    im = Image.open(io.BytesIO(data)).convert("RGB")
    check(f"{path} size", im.size == (size, size), im.size)
    px = list(im.getdata())
    dark = sum(1 for r, g, b in px if r < 40 and g < 40 and b < 40)
    light = sum(1 for r, g, b in px if r > 180 and g > 180 and b > 180)
    ratio_dark = dark / len(px)
    ratio_light = light / len(px)
    check(f"{path} black bg", ratio_dark > 0.7, f"dark={ratio_dark:.2f}")
    check(f"{path} white logo text", ratio_light > 0.02, f"light={ratio_light:.2f}")

# manifest points at these icons
mf, _ = fetch("/manifest.webmanifest")
import json

m = json.loads(mf)
icons = {i.get("src") for i in m.get("icons", [])}
check("manifest name SCHWARTZ", "SCHWARTZ" in m.get("name", ""), m.get("name"))
check("manifest icons", "icons/icon-192.png" in icons and "icons/maskable-512.png" in icons, icons)

print(f"\n=== RESULT: {ok} ok / {fail} fail ===")
raise SystemExit(1 if fail else 0)
