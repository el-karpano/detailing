"""Inspect /api/chat response body and headers."""
import json
import urllib.error
import urllib.request

url = "https://detailing-hvv.deteiling-pro.workers.dev/api/chat"
body = {"messages": [{"role": "user", "content": "привет"}], "studio": {"name": "ХВВ"}, "freeSlots": []}

req = urllib.request.Request(
    url,
    data=json.dumps(body).encode(),
    headers={"Content-Type": "application/json", "User-Agent": "Mozilla/5.0"},
    method="POST",
)
try:
    with urllib.request.urlopen(req, timeout=30) as r:
        print("STATUS", r.status)
        print("HEADERS", dict(r.headers))
        print("BODY", r.read()[:800])
except urllib.error.HTTPError as e:
    print("STATUS", e.code)
    print("HEADERS", dict(e.headers))
    print("BODY", e.read()[:1500])
except Exception as e:
    print("ERR", e)
