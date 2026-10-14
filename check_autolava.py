#!/usr/bin/env python3
"""Smoke: autolava bundle + public API."""
import json
import re
import urllib.error
import urllib.request

UA = {"User-Agent": "Mozilla/5.0"}
BASE = "https://detailing-autolava.deteiling-pro.workers.dev"

# homepage shell
req = urllib.request.Request(BASE + "/", headers=UA)
html = urllib.request.urlopen(req, timeout=30).read().decode("utf-8", errors="replace")
print("home status 200, len", len(html), "AUTOLAVA" in html or "AutoLava" in html)

# JS bundle
# find main script
m = re.search(r'/assets/index-[^"]+\.js', html)
js_path = m.group(0) if m else "/assets/index-CyODGQdo.js"
print("js", js_path)
js = urllib.request.urlopen(urllib.request.Request(BASE + js_path, headers=UA), timeout=60).read().decode(
    "utf-8", errors="replace"
)
print("js len", len(js))
for s in [
    "AutoLava",
    "Нововиленская",
    "623-44-94",
    "autolava.by",
    "Антигравий",
    "Керамич",
    "studio-autolava",
]:
    print(f"  {s!r:30} -> {s in js}")

# public bookings — no PII
req = urllib.request.Request(f"{BASE}/api/bookings?studio=studio-autolava", headers=UA)
data = json.loads(urllib.request.urlopen(req, timeout=30).read().decode())
bookings = data.get("bookings") or []
leaked = [b for b in bookings if b.get("phone") or b.get("clientName")]
print("public bookings", len(bookings), "pii leaked", len(leaked))

# visits locked
try:
    urllib.request.urlopen(urllib.request.Request(f"{BASE}/api/visits", headers=UA), timeout=20)
    print("visits GET unexpectedly open")
except urllib.error.HTTPError as e:
    print("visits GET", e.code)

print("OK")
