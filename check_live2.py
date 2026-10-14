import urllib.request
import re

url = "https://detailing-main.deteiling-pro.workers.dev/assets/index-dBlVaUu_.js"
req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
t = urllib.request.urlopen(req, timeout=15).read().decode("utf-8", "replace")

# minified: title:"Комплексная мойка",description:"..."
for label, pat in [
    ("titles", r'title:\s*"([^"]+)"'),
    ("images", r'/assets/[A-Za-z0-9._-]+\.(?:jpg|jpeg|png|svg|webp)'),
    ("hero", r'hero[^"]{0,20}:\s*"([^"]+)"'),
]:
    print("==", label, "==")
    seen = []
    for m in re.findall(pat, t):
        if m not in seen:
            seen.append(m)
    for m in seen[:30]:
        print(" ", m)
    print()

# show a slice around DEFAULT_STUDIO / svc-
i = t.find("svc-wash")
print("svc-wash at", i)
if i > 0:
    print(t[i - 100 : i + 600])
