"""Smoke: sgx localized for BY (Br, Минск, +375, prices) + live bundle + bookings API."""
import json
import re
import urllib.error
import urllib.request

BASE = "https://detailing-main.deteiling-pro.workers.dev"
UA = {"User-Agent": "Mozilla/5.0", "Content-Type": "application/json", "Cache-Control": "no-cache"}
ok = 0
fail = 0


def check(name, cond, detail=""):
    global ok, fail
    if cond:
        ok += 1
        print(f"  OK  {name} {detail}")
    else:
        fail += 1
        print(f"  FAIL {name} {detail}")


def fetch(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=20) as r:
        return r.read()


def call(path, method="GET", body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, headers=UA, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            raw = r.read().decode()
            return r.status, (json.loads(raw) if raw else {})
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, {"raw": raw[:300]}
    except Exception as e:
        return 0, {"error": str(e)}


print("=== live HTML ===")
html = fetch(BASE + "/").decode("utf-8", "replace")
check("HTML 200", "SGX" in html or "index-" in html)
scripts = re.findall(r'src="(/assets/index-[^"]+\.js)"', html)
check("bundle ref", bool(scripts), scripts[:1])

print("=== bundle localization ===")
js = fetch(BASE + scripts[0]).decode("utf-8", "replace")
for s in [
    "Br",
    "Минск, ул. Калиновского, 12",
    "+375 29 123-45-67",
    "09:00–20:00",
    "Комплексная мойка",
    "Керамическое покрытие",
    "studio-sgx",
]:
    check(f"js has {s!r}", s in js)

# prices as numbers near service titles
for price in ["45", "250", "300", "550"]:
    check(f"price token {price}", f'"{price}"' in js or f":{price}" in js or f": {price}" in js)

check("no old MSK addr", "Примерная улица" not in js)
check("no RU +7 phone in studio", "+7 (999)" not in js)

print("=== bookings API ===")
bid = "smoke-sgx-by-1"
st, d = call(
    "/api/bookings",
    "POST",
    {
        "id": bid,
        "studioId": "studio-sgx",
        "serviceId": "svc-wash",
        "serviceName": "Комплексная мойка",
        "date": "2030-01-15",
        "time": "10:00",
        "name": "Смоук",
        "phone": "+375 29 000-00-01",
        "status": "pending",
    },
)
check("POST booking", st in (200, 201), f"status={st}")

st, d = call("/api/bookings?studio=studio-sgx")
check("GET bookings", st == 200, f"status={st}")
items = d if isinstance(d, list) else d.get("bookings", d.get("items", []))
check("created visible", any(x.get("id") == bid for x in items), f"n={len(items)}")

# DELETE requires owner Bearer (401 without) — cancel via public PATCH instead
st, d = call(f"/api/bookings/{bid}", "PATCH", {"status": "cancelled"})
check("PATCH cancel (public)", st in (200, 204), f"status={st}")

st, d = call(f"/api/bookings/{bid}", "DELETE")
check("DELETE without auth → 401", st == 401, f"status={st}")

st, d = call("/api/studio")
check("GET studio", st == 200)
studio = (d.get("studio") if isinstance(d, dict) else None) or {}
phone = str(studio.get("phone") or "")
addr = str(studio.get("address") or "")
check("no stale RU override", "+7" not in phone and "Москва" not in addr, f"phone={phone!r} addr={addr!r}")

print(f"\n=== {ok} OK / {fail} FAIL ===")
raise SystemExit(1 if fail else 0)
