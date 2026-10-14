import urllib.request
import re

def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    return urllib.request.urlopen(req, timeout=15).read().decode("utf-8", "replace")

clients = [
    ("SGX", "https://detailing-main.deteiling-pro.workers.dev",
     ["SGX Detailing", "Комплексная мойка", "Керамическое покрытие"],
     ["Demo Детейлинг", "Экспресс-мойка"]),
    ("DEMO", "https://detailing-demo.deteiling-pro.workers.dev",
     ["Demo Детейлинг", "Экспресс-мойка", "Премиум детейлинг"],
     ["SGX Detailing", "Комплексная мойка"]),
]

for name, base, expect, not_expect in clients:
    html = get(base + "/")
    title = re.search(r"<title>(.*?)</title>", html)
    m = re.search(r'src="(/assets/index-[^"]+\.js)"', html)
    js_path = m.group(1)
    js = get(base + js_path)
    man = get(base + "/manifest.webmanifest")
    print("====", name, "====")
    print("title:", title.group(1) if title else None)
    print("js:", js_path, "len", len(js))
    print("manifest name:", re.search(r'"name":"([^"]+)"', man).group(1))
    print("manifest short:", re.search(r'"short_name":"([^"]+)"', man).group(1))
    ok = True
    for s in expect:
        hit = s in js
        print("  EXPECT", repr(s), "->", hit)
        ok = ok and hit
    for s in not_expect:
        hit = s not in js
        print("  ABSENT", repr(s), "->", hit)
        ok = ok and hit
    print("RESULT", "OK" if ok else "FAIL")
    print()
