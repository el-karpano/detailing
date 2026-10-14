import urllib.request
import re

def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    return urllib.request.urlopen(req, timeout=15).read().decode("utf-8", "replace")

base = "https://detailing-hvv.deteiling-pro.workers.dev"
html = get(base + "/")
title = re.search(r"<title>(.*?)</title>", html)
js = get(base + re.search(r'src="(/assets/index-[^"]+\.js)"', html).group(1))
man = get(base + "/manifest.webmanifest")

print("title:", title.group(1) if title else None)
print("manifest:", re.search(r'"name":"([^"]+)"', man).group(1), "/", re.search(r'"short_name":"([^"]+)"', man).group(1))
checks = [
    "ХВВ Детейлинг",
    "Димитрова",
    "802-88-87",
    "Двухфазная мойка",
    "Протектор-мойка",
    "Кварцевая мойка",
    "Антихром",
    "Сухой туман",
    "Br",
    "350",
]
for s in checks:
    print(f"  {s!r:30s} -> {s in js}")
absent = ["SGX Detailing", "Комплексная мойка", "₽"]
for s in absent:
    print(f"  ABSENT {s!r:24s} -> {s not in js}")
