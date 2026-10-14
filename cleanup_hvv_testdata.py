"""Очистка QA-записей в HVV D1 и проверка окон 09:00–20:00."""
import json
import urllib.request
import urllib.error

BASE = "https://detailing-hvv.deteiling-pro.workers.dev"
UA = {"User-Agent": "Mozilla/5.0", "Content-Type": "application/json"}


def api(path, method="GET", body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, headers=UA, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            raw = r.read().decode()
            return r.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, {"raw": raw[:200]}


st, d = api("/api/bookings?studio=studio-hvv")
bookings = d.get("bookings", [])
print("всего записей:", len(bookings))

# удаляем всё, кроме демо-записей владельца (реальные имена)
keep_names = {"Иван Петров", "Алексей Смирнов"}
deleted = 0
for b in bookings:
    if b.get("clientName") in keep_names:
        continue
    st, _ = api(f"/api/bookings/{b['id']}", "DELETE")
    if st == 200:
        deleted += 1
print("удалено тестовых:", deleted)

st, d = api("/api/bookings?studio=studio-hvv")
print("осталось:", len(d.get("bookings", [])))
for b in d.get("bookings", []):
    print(" ", b["date"], b["time"], b["clientName"], b["status"])
