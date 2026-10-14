"""Smoke-test bookings API on D1."""
import json
import urllib.request

base = "https://detailing-hvv.deteiling-pro.workers.dev"
UA = {"User-Agent": "Mozilla/5.0", "Content-Type": "application/json"}


def call(path, method="GET", body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        base + path, data=data, headers=UA, method=method
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            raw = r.read().decode()
            return r.status, (json.loads(raw) if raw else {})
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        print("HTTP", e.code, raw[:500])
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, {"raw": raw[:500]}
    except Exception as e:
        print("ERR", e)
        return 0, {"error": str(e)}


import urllib.error

# create
st, d = call(
    "/api/bookings",
    "POST",
    {
        "id": "test-d1-1",
        "studioId": "default",
        "serviceId": "svc-protector",
        "serviceName": "Протектор-мойка",
        "clientName": "Тест Клиент",
        "phone": "+375 29 000-00-00",
        "car": "Test BMW",
        "date": "2026-10-08",
        "time": "10:00",
        "bay": 1,
        "status": "pending",
        "price": 35,
        "paid": 0,
        "createdAt": "2026-10-05T12:00:00.000Z",
        "reminderEnabled": True,
    },
)
print("POST", st, d)

# list
st, d = call("/api/bookings?studio=default")
print("GET", st, "count", len(d.get("bookings", [])))
if d.get("bookings"):
    print("  first:", d["bookings"][0].get("clientName"), d["bookings"][0].get("date"), d["bookings"][0].get("time"))

# patch
st, d = call("/api/bookings/test-d1-1", "PATCH", {"status": "accepted", "paid": 10})
print("PATCH", st, d)

# verify
st, d = call("/api/bookings?studio=default")
b = next((x for x in d.get("bookings", []) if x["id"] == "test-d1-1"), None)
print("after patch status/paid:", b and (b.get("status"), b.get("paid")))

# delete
st, d = call("/api/bookings/test-d1-1", "DELETE")
print("DELETE", st, d)

st, d = call("/api/bookings?studio=default")
print("after delete count", len(d.get("bookings", [])))
