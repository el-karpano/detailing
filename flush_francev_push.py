#!/usr/bin/env python3
"""Inspect visits + flush push reminders for francev."""
import json
import urllib.request

BASE = "https://detailing-francev.deteiling-pro.workers.dev"
UA = {"User-Agent": "Mozilla/5.0", "Content-Type": "application/json"}


def api(path, body=None, method="GET"):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, headers=UA, method=method)
    r = urllib.request.urlopen(req, timeout=30)
    return r.status, json.loads(r.read().decode() or "{}")


status, body = api("/api/visits")
print("visits status", status)
print(json.dumps(body, ensure_ascii=False, indent=2))

status, body = api("/api/push/flush", {}, method="POST")
print("flush", status, body)

status, body = api("/api/visits")
print("visits after flush:")
print(json.dumps(body, ensure_ascii=False, indent=2))
