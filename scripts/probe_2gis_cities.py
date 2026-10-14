import re
import urllib.request

req = urllib.request.Request("https://2gis.by/", headers={"User-Agent": "Mozilla/5.0"})
html = urllib.request.urlopen(req, timeout=30).read().decode("utf-8", "replace")

links = sorted(set(re.findall(r'https?://2gis\.by/[a-zA-Z0-9%-]+', html)))
print("absolute city links:")
for l in links:
    print(l)

hrefs = sorted(set(re.findall(r'href="(/[a-zA-Z0-9%-]+)"', html)))
print("\nroot hrefs:")
for h in hrefs[:100]:
    print(h)

# also look for gomel/homel mentions
for m in re.finditer(r'.{40}(gomel|homel|Гомель|brest|Брест|vitebsk).{40}', html, re.I):
    print("ctx:", m.group(0).replace("\n", " ")[:120])
