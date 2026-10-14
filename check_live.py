import urllib.request
import re
import hashlib

def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0", "Cache-Control": "no-cache"})
    with urllib.request.urlopen(req, timeout=15) as r:
        return r.status, dict(r.headers), r.read()

print("=== workers.dev ===")
status, headers, body = fetch("https://detailing-main.deteiling-pro.workers.dev/")
text = body.decode("utf-8", "replace")
print("status", status, "len", len(body), "md5", hashlib.md5(body).hexdigest()[:8])
print("cf-cache", headers.get("cf-cache-status"), "age", headers.get("age"))
scripts = re.findall(r'src="(/assets/index-[^"]+\.js)"', text)
css = re.findall(r'href="(/assets/index-[^"]+\.css)"', text)
print("script", scripts)
print("css", css)

js_url = "https://detailing-main.deteiling-pro.workers.dev" + scripts[0]
_, _, js = fetch(js_url)
js = js.decode("utf-8", "replace")
print("js len", len(js), "md5", hashlib.md5(js.encode("utf-8")).hexdigest()[:8])
checks = [
    "Комплексная мойка",
    "Химчистка салона",
    "Полировка кузова",
    "Керамическое покрытие",
    "hero-car-blue",
    "car2.jpg",
    "car3.jpg",
    "car4.jpg",
    "DEFAULTS_REV",
    "defaultsRev",
    "Мойка",
    "Тонировка",
    "Полир",
]
for s in checks:
    print(" ", s, "->", s in js)

print("\n=== assets listing via HTML refs ===")
for s in ["hero-car-blue", "car2", "car3", "car4", "logo"]:
    pass

# fetch sw.js revision hint
_, _, sw = fetch("https://detailing-main.deteiling-pro.workers.dev/sw.js")
sw_t = sw.decode("utf-8", "replace")
print("\nsw.js len", len(sw))
print("has StaleWhileRevalidate", "StaleWhileRevalidate" in sw_t)
print("has CacheFirst images", "CacheFirst" in sw_t)
m = re.search(r'index-([A-Za-z0-9_-]+)\.js', sw_t)
print("sw precache js", m.group(0) if m else None)
