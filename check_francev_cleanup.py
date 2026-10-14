#!/usr/bin/env python3
"""Cleanup smoke booking + owner login check for francev."""
import json
import os
import urllib.error
import urllib.request

UA = {"User-Agent": "Mozilla/5.0", "Content-Type": "application/json"}
BASE = "https://detailing-francev.deteiling-pro.workers.dev"

# login (пароль только из env; в git не класть)
body = json.dumps(
    {"email": "owner@francev.by", "password": os.environ.get("FRANCEV_OWNER_PASSWORD", "")}
).encode()
req = urllib.request.Request(f"{BASE}/api/auth/login", data=body, headers=UA, method="POST")
try:
    r = urllib.request.urlopen(req, timeout=30)
    data = json.loads(r.read().decode())
    print("login", r.status, list(data.keys()))
    token = data.get("token") or data.get("session") or data.get("sessionToken")
    print("token?", bool(token))
except urllib.error.HTTPError as e:
    print("login ERR", e.code, e.read().decode()[:400])
    token = None

if token:
    # delete smoke booking
    req = urllib.request.Request(
        f"{BASE}/api/bookings/smoke-francev-1",
        headers={**UA, "Authorization": f"Bearer {token}"},
        method="DELETE",
    )
    try:
        r = urllib.request.urlopen(req, timeout=30)
        print("delete", r.status, r.read().decode()[:300])
    except urllib.error.HTTPError as e:
        print("delete ERR", e.code, e.read().decode()[:300])

    # list after
    req = urllib.request.Request(f"{BASE}/api/bookings?studio=studio-francev", headers=UA)
    r = urllib.request.urlopen(req, timeout=30)
    data = json.loads(r.read().decode())
    print("list after count", len(data.get("bookings") or []))
