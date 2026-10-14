"""Проверка: в ответе ИИ нет chain-of-thought, только финальный текст."""
import json
import re
import urllib.request

base = "https://detailing-hvv.deteiling-pro.workers.dev"
body = {
    "messages": [{"role": "user", "content": "у меня ауди а6 с7, нужна мойка кузова"}],
    "studio": {
        "name": "ХВВ Детейлинг",
        "currency": "Br",
        "services": [
            {"id": "svc-wash2", "title": "Двухфазная мойка", "price": 20, "durationMin": 40, "active": True, "description": "без сушки"},
            {"id": "svc-protector", "title": "Протектор-мойка", "price": 35, "durationMin": 60, "active": True, "description": "трёхфазная"},
            {"id": "svc-quartz", "title": "Кварцевая мойка", "price": 60, "durationMin": 75, "active": True, "description": "гидрофоб"},
        ],
    },
    "freeSlots": [{"date": "2026-10-05", "times": ["11:30", "14:00"]}],
}
req = urllib.request.Request(
    base + "/api/chat",
    data=json.dumps(body).encode(),
    headers={"Content-Type": "application/json", "User-Agent": "Mozilla/5.0"},
    method="POST",
)
with urllib.request.urlopen(req, timeout=60) as r:
    d = json.loads(r.read().decode())
reply = d.get("reply", "")
print("REPLY:\n---\n" + reply + "\n---")
print("ACTION:", d.get("action"))

bad = re.findall(r"(?im)^(let me|i should|i need|i'll |the user|actually|in summary|to summarize|hmm|wait,)\b", reply)
print("noise lines:", bad or "none")
print("has ACTION leaked:", "ACTION:" in reply)
print("RESULT:", "OK" if not bad and "ACTION:" not in reply else "FAIL")
