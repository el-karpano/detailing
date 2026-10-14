"""Download ХВВ photos from Yandex Maps for the demo client."""
import urllib.request
from pathlib import Path

out = Path("clients/hvv/assets")
out.mkdir(parents=True, exist_ok=True)

images = {
    # hero — главное фото организации
    "hero.jpg": "https://avatars.mds.yandex.net/get-altay/14076755/2a00000196b6cfb60c31eed8aeb4e1f1bc56/L",
    # логотип
    "logo.png": "https://avatars.mds.yandex.net/get-altay/16494614/2a0000019a31850f13e4b18c3511a2c9feba/L",
    "logo-header.png": "https://avatars.mds.yandex.net/get-altay/16494614/2a0000019a31850f13e4b18c3511a2c9feba/S",
    # фото из отзывов / галереи
    "work-1.jpg": "https://avatars.mds.yandex.net/get-altay/17765342/2a0000019f77355b4c2dc7f36a727e02c2b3/L",
    "work-2.jpg": "https://avatars.mds.yandex.net/get-altay/20781119/2a0000019f7734f5af945d5685f3175168d4/L",
}

for name, url in images.items():
    dest = out / name
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=30) as r:
            data = r.read()
        dest.write_bytes(data)
        print(f"OK  {name:20s} {len(data):8d} bytes  {r.headers.get('Content-Type')}")
    except Exception as e:
        print(f"ERR {name:20s} {e}")
