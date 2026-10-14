"""Smoke-test Xiaomi MiMo chat completion with the key from .env."""
import json
import re
import urllib.request
from pathlib import Path

env_text = Path(".env").read_text(encoding="utf-8")
key = re.search(r"^MIMO_API_KEY=(.+)$", env_text, re.M).group(1).strip()
base = re.search(r"^MIMO_BASE_URL=(.+)$", env_text, re.M).group(1).strip().rstrip("/")
model = re.search(r"^MIMO_MODEL=(.+)$", env_text, re.M).group(1).strip()

body = {
    "model": model,
    "messages": [
        {"role": "system", "content": "Ты помощник детейлинг-студии. Отвечай коротко по-русски."},
        {"role": "user", "content": "Нужна мойка кузова, что посоветуешь?"},
    ],
    "max_tokens": 200,
    "temperature": 0.6,
}

req = urllib.request.Request(
    base + "/chat/completions",
    data=json.dumps(body, ensure_ascii=False).encode("utf-8"),
    headers={
        "Content-Type": "application/json",
        "Authorization": "Bearer " + key,
    },
    method="POST",
)
print(f"model={model} base={base}")
try:
    with urllib.request.urlopen(req, timeout=45) as r:
        data = json.loads(r.read().decode("utf-8"))
        print("STATUS", r.status)
        print("REPLY", data["choices"][0]["message"]["content"][:500])
except Exception as e:
    import traceback
    traceback.print_exc()
    print("ERR", e)
    raise
