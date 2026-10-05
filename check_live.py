import urllib.request
import re
import hashlib

def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=15) as r:
        return r.status, r.read()

for url in [
    "https://detailing-main.deteiling-pro.workers.dev/",
    "https://detailing-main.pages.dev/",
]:
    try:
        status, body = fetch(url)
        text = body.decode("utf-8", "replace")
        print(url, status, len(body), hashlib.md5(body).hexdigest()[:8])
        for m in re.finditer(r'src="([^"]+)"', text):
            print("  script", m.group(1))
        for m in re.finditer(r'href="([^"]+\.css[^"]*)"', text):
            print("  css", m.group(1))
    except Exception as e:
        print(url, "ERR", type(e).__name__, e)
    print()

# check services in deployed JS
for base in [
    "https://detailing-main.deteiling-pro.workers.dev",
    "https://detailing-main.pages.dev",
]:
    try:
        status, html = fetch(base + "/")
        text = html.decode("utf-8", "replace")
        scripts = re.findall(r'src="(/assets/index-[^"]+\.js)"', text)
        if not scripts:
            print(base, "no script found")
            continue
        js_url = base + scripts[0]
        status, js = fetch(js_url)
        js = js.decode("utf-8", "replace")
        print(base, scripts[0], "len", len(js))
        for s in [
            "Комплексная мойка",
            "Химчистка салона",
            "Полировка кузова",
            "Керамическое покрытие",
            "hero-car-blue",
            "car2.jpg",
            "SGX Detailing",
            "Мойка кузова",
            "Тонировка",
        ]:
            print(" ", s, "->", s in js)
    except Exception as e:
        print(base, "ERR", type(e).__name__, e)
    print()
