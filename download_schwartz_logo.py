"""Download Schwartz logo from public sources for the schwartz client."""
import urllib.request
from pathlib import Path

out = Path("clients/schwartz/assets")
out.mkdir(parents=True, exist_ok=True)

candidates = {
    # og:image / main org avatar from Yandex Maps
    "logo-yandex-L.jpg": "https://avatars.mds.yandex.net/get-altay/15502563/2a00000196442cf11492b7a784cee4c0c147/L",
    "logo-yandex-S.jpg": "https://avatars.mds.yandex.net/get-altay/15502563/2a00000196442cf11492b7a784cee4c0c147/S",
    "logo-auto2.jpg": "https://go.auto2.info/images/catalog/0f/91/337211.jpg",
}

for name, url in candidates.items():
    dest = out / name
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=30) as r:
            data = r.read()
            ctype = r.headers.get("Content-Type", "")
        dest.write_bytes(data)
        print(f"OK  {name:24s} {len(data):8d} bytes  {ctype}")
    except Exception as e:
        print(f"ERR {name:24s} {e}")
