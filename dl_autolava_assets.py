#!/usr/bin/env python3
"""Download AutoLava assets from Yandex Maps."""
import os
import urllib.request

os.makedirs("clients/autolava/assets", exist_ok=True)
UA = {"User-Agent": "Mozilla/5.0"}
urls = {
    "logo.jpg": "https://avatars.mds.yandex.net/get-altay/16137047/2a00000198255169735d21fcf11be93dc878/L",
    "logo-header.jpg": "https://avatars.mds.yandex.net/get-altay/16137047/2a00000198255169735d21fcf11be93dc878/L",
    "hero-car-blue.jpg": "https://avatars.mds.yandex.net/get-altay/16390227/2a00000198254fafced9c24c38d01a0f3194/XXL_height",
    "car2.jpg": "https://avatars.mds.yandex.net/get-altay/16415892/2a0000019b31d0a575a00382085dd71f4d24/XXL_height",
    "car3.jpg": "https://avatars.mds.yandex.net/get-altay/16309447/2a0000019b31d0ed466f5cc3b686b1acf581/L",
    "car4.jpg": "https://avatars.mds.yandex.net/get-altay/16483787/2a0000019b31d04f81dcc224856ca8f87c2d/L",
}
for name, url in urls.items():
    try:
        r = urllib.request.Request(url, headers=UA)
        path = f"clients/autolava/assets/{name}"
        open(path, "wb").write(urllib.request.urlopen(r, timeout=30).read())
        print(name, os.path.getsize(path))
    except Exception as e:
        print(name, "ERR", e)

for n in ("logo.svg", "logo-header.svg"):
    p = f"clients/autolava/assets/{n}"
    if os.path.exists(p):
        os.remove(p)
        print("removed", n)
