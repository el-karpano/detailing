#!/usr/bin/env python3
"""Smoke: francev bundle + bookings API."""
import json
import re
import urllib.error
import urllib.request

UA = {"User-Agent": "Mozilla/5.0"}
BASE = "https://detailing-francev.deteiling-pro.workers.dev"

# 1) JS bundle contains client data
js_url = f"{BASE}/assets/index-B5k5dmaQ.js"
req = urllib.request.Request(js_url, headers=UA)
js = urllib.request.urlopen(req, timeout=60).read().decode("utf-8", errors="replace")
print("js len", len(js))
checks = [
    "FRANCEV DETAILING",
    "Солтыса",
    "668-66-61",
    "detailing-francev",
    "okleika.by",
    "francev_dtl",
    "svc-ceramic",
    "Антихром",
    "Шумоизоляция",
]
for s in checks:
    print(f"  {s!r:30} -> {s in js}")
print("  phone:", re.findall(r"\+375[^\"]{0,20}", js)[:5])
print("  address:", re.findall(r"Солтыса[^\"]{0,30}", js)[:3])

# 2) create booking
body = json.dumps(
    {
        "id": "smoke-francev-1",
        "studioId": "studio-francev",
        "serviceId": "svc-polish",
        "serviceName": "Полировка кузова",
        "clientName": "Smoke Test",
        "phone": "+375 29 000-00-00",
        "date": "2026-10-20",
        "time": "10:00",
        "durationMin": 480,
        "price": 400,
    }
).encode()
req = urllib.request.Request(
    f"{BASE}/api/bookings",
    data=body,
    headers={**UA, "Content-Type": "application/json"},
    method="POST",
)
try:
    r = urllib.request.urlopen(req, timeout=30)
    print("booking status", r.status)
    print("booking body", r.read().decode()[:500])
except urllib.error.HTTPError as e:
    print("booking ERR", e.code, e.read().decode()[:500])

# 3) list bookings
req = urllib.request.Request(
    f"{BASE}/api/bookings?studio=studio-francev", headers=UA
)
try:
    r = urllib.request.urlopen(req, timeout=30)
    data = json.loads(r.read().decode())
    items = data if isinstance(data, list) else data.get("bookings") or data.get("items") or []
    print("list status", r.status, "count", len(items))
except urllib.error.HTTPError as e:
    print("list ERR", e.code, e.read().decode()[:500])
