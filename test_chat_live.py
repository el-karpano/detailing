"""Test live /api/chat on a deployed client."""
import json
import sys
import urllib.request

base = sys.argv[1] if len(sys.argv) > 1 else "https://detailing-hvv.deteiling-pro.workers.dev"
body = {
    "messages": [
        {"role": "user", "content": "Мне нужна мойка кузова, что посоветуете и сколько стоит?"}
    ],
    "studio": {
        "name": "ХВВ Детейлинг",
        "address": "Барановичи, ул. Димитрова, 15В",
        "phone": "+375 29 802-88-87",
        "workHours": "09:00–20:00",
        "currency": "Br",
        "services": [
            {"id": "svc-wash2", "title": "Двухфазная мойка", "price": 20, "durationMin": 40, "active": True, "description": "Без сушки"},
            {"id": "svc-protector", "title": "Протектор-мойка", "price": 35, "durationMin": 60, "active": True, "description": "Трёхфазная"},
            {"id": "svc-quartz", "title": "Кварцевая мойка", "price": 60, "durationMin": 75, "active": True, "description": "Гидрофобный шампунь"},
        ],
    },
    "freeSlots": [{"date": "2026-10-06", "times": ["10:00", "11:00", "14:00"]}],
}
req = urllib.request.Request(
    base.rstrip("/") + "/api/chat",
    data=json.dumps(body, ensure_ascii=False).encode("utf-8"),
    headers={"Content-Type": "application/json", "User-Agent": "Mozilla/5.0"},
    method="POST",
)
print("POST", req.full_url)
try:
    with urllib.request.urlopen(req, timeout=60) as r:
        data = json.loads(r.read().decode("utf-8"))
        print("STATUS", r.status)
        print("REPLY:", data.get("reply") or data)
except Exception as e:
    import urllib.error
    if isinstance(e, urllib.error.HTTPError):
        print("STATUS", e.code)
        print("BODY", e.read()[:800])
    raise
