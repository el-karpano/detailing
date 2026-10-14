#!/usr/bin/env python3
"""Debug: save a visit then dump GET /api/visits ids."""
import json
import os
import time
import urllib.request

BASE = "https://detailing-francev.deteiling-pro.workers.dev"
UA = {"User-Agent": "Mozilla/5.0", "Content-Type": "application/json"}


def api(path, body=None, method="GET", token=None):
    h = dict(UA)
    if token:
        h["Authorization"] = f"Bearer {token}"
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, headers=h, method=method)
    r = urllib.request.urlopen(req, timeout=30)
    return r.status, json.loads(r.read().decode() or "{}")


ts = int(time.time())
vid = f"dbg-{ts}"
st, data = api(
    "/api/visits",
    {
        "id": vid,
        "serviceName": "DBG",
        "date": "2027-02-01",
        "time": "10:00",
        "subscription": {"endpoint": "https://example.com/p", "keys": {"p256dh": "a", "auth": "b"}},
    },
    method="POST",
)
print("save", st, data)

pw = os.environ.get("FRANCEV_OWNER_PASSWORD", "")
st, data = api("/api/auth/login", {"email": "owner@francev.by", "password": pw}, method="POST")
print("login", st)
tok = data.get("token")

for i in range(5):
    st, data = api("/api/visits", token=tok)
    ids = [v.get("id") for v in data.get("visits") or []]
    print(f"list[{i}]", st, "count", len(ids), "has", vid in ids, "ids", ids)
    if vid in ids:
        break
    time.sleep(1)
