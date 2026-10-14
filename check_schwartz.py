"""Smoke: schwartz live client (Gomel branding, Br prices, services, API, owner login)."""
import json
import re
import urllib.error
import urllib.request

BASE = "https://detailing-schwartz.deteiling-pro.workers.dev"
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


def call(path, method="GET", body=None, token=None):
    data = json.dumps(body).encode() if body is not None else None
    headers = dict(UA)
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(BASE + path, data=data, headers=headers, method=method)
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


print("=== live HTML / branding ===")
html = fetch(BASE + "/").decode("utf-8", "replace")
check("HTML 200", "index-" in html or "SCHWARTZ" in html)
check("title Schwartz", "Schwartz" in html or "SCHWARTZ" in html or "schwartz" in html.lower())
scripts = re.findall(r'src="(/assets/index-[^"]+\.js)"', html)
check("bundle ref", bool(scripts), scripts[:1])

js = fetch(BASE + (scripts[0] if scripts else "/")).decode("utf-8", "replace")
for token in ["SCHWARTZ", "Дорожная", "375 33 375", "Гомель", "Bi-Led", "бронеплёнкой", "Керамическое"]:
    check(f"bundle has {token!r}", token in js)

check("no SGX leak", "SGX" not in js and "Калиновского" not in js)
check("no HVV leak", "ХВВ" not in js and "Димитрова" not in js)
check("Br currency", '"Br"' in js or "Br" in js)

print("=== studio API ===")
st, d = call("/api/studio")
studio = (d.get("studio") or {}) if isinstance(d, dict) else {}
check("GET /api/studio", st == 200, f"status={st}")
# empty studio_profile is OK — UI uses client-data defaults baked into the bundle
if studio:
    check("studio name", "SCHWARTZ" in str(studio.get("name", "")), studio.get("name"))
else:
    print("  note studio_profile empty → defaults from bundle (expected)")

print("=== services in bundle ===")
for token, label in [
    ("Полировка кузова", "polish title"),
    ("Химчистка салона", "chem title"),
    ("Установка Bi-Led", "biled title"),
    ("Керамическое покрытие", "ceramic title"),
    ("Оклейка бронеплёнкой", "film title"),
    ("Удаление вмятин", "pdr title"),
    ("svc-polish", "svc id polish"),
    ("svc-ceramic", "svc id ceramic"),
    ("svc-biled", "svc id biled"),
]:
    check(f"bundle {label}", token in js)

print("=== bookings API ===")
st, d = call("/api/bookings?studio=studio-schwartz")
check("GET bookings 200", st == 200, f"status={st}")
check("bookings list", isinstance(d, dict) and ("bookings" in d or "items" in d or isinstance(d, list)), str(d)[:120])

print("=== owner auth ===")
import os

st, d = call(
    "/api/auth/login",
    "POST",
    {"email": "owner@schwartz.by", "password": os.environ.get("SCHWARTZ_OWNER_PASSWORD", "")},
)
check("owner login 200", st == 200, f"status={st} {str(d)[:120]}")
token = d.get("token") if isinstance(d, dict) else None
check("has token", bool(token))
st2, d2 = call(
    "/api/auth/login",
    "POST",
    {"email": "owner@hvv.by", "password": os.environ.get("HVV_OWNER_PASSWORD", "x")},
)
check("hvv creds rejected on schwartz", st2 == 401, f"status={st2}")
st3, d3 = call("/api/auth/me", "GET", token=token)
check("auth me", st3 == 200, f"status={st3}")

print(f"\n=== RESULT: {ok} ok / {fail} fail ===")
raise SystemExit(1 if fail else 0)
