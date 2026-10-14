"""Smoke-test push API endpoints."""
import json
import urllib.error
import urllib.request

base = "https://detailing-hvv.deteiling-pro.workers.dev"
UA = {"User-Agent": "Mozilla/5.0", "Content-Type": "application/json"}

# 1. public key
req = urllib.request.Request(base + "/api/push/public-key", headers={"User-Agent": "Mozilla/5.0"})
with urllib.request.urlopen(req, timeout=20) as r:
    pk = json.loads(r.read().decode())
    print("public-key:", pk.get("publicKey", "")[:24] + "...", "len", len(pk.get("publicKey", "")))

# 2. save visit
body = {
    "id": "test-visit-1",
    "serviceName": "Протектор-мойка",
    "date": "2026-10-06",
    "time": "10:00",
    "clientName": "Тест",
    "remind": True,
    "subscription": {
        "endpoint": "https://fcm.googleapis.com/fcm/send/test-endpoint",
        "keys": {"p256dh": "test", "auth": "test"},
    },
}
req = urllib.request.Request(
    base + "/api/visits",
    data=json.dumps(body).encode(),
    headers=UA,
    method="POST",
)
with urllib.request.urlopen(req, timeout=20) as r:
    print("POST /api/visits:", r.status, r.read().decode())

# 3. delete visit
req = urllib.request.Request(
    base + "/api/visits/test-visit-1",
    headers={"User-Agent": "Mozilla/5.0"},
    method="DELETE",
)
with urllib.request.urlopen(req, timeout=20) as r:
    print("DELETE /api/visits:", r.status, r.read().decode())

print("OK")
