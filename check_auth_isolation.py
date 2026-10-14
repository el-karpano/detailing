"""Auth isolation: чужие креды не должны логинить между клиентами."""
import json
import os
import urllib.error
import urllib.request

# пароли только через env; в git не класть
CREDS = {
    "hvv": ("owner@hvv.by", os.environ.get("HVV_OWNER_PASSWORD", "")),
    "sgx": ("owner@sgx.by", os.environ.get("SGX_OWNER_PASSWORD", "")),
}
URLS = {
    "hvv": "https://detailing-hvv.deteiling-pro.workers.dev",
    "sgx": "https://detailing-main.deteiling-pro.workers.dev",
}
UA = {"User-Agent": "Mozilla/5.0", "Content-Type": "application/json"}
ok = fail = 0


def check(name, cond, detail=""):
    global ok, fail
    if cond:
        ok += 1
        print(f"  OK  {name} {detail}")
    else:
        fail += 1
        print(f"  FAIL {name} {detail}")


def login(base, email, password):
    req = urllib.request.Request(
        base + "/api/auth/login",
        data=json.dumps({"email": email, "password": password}).encode(),
        headers=UA,
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return r.status, json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, {"raw": raw[:200]}


for site, (email, password) in CREDS.items():
    st, d = login(URLS[site], email, password)
    check(f"{site} own login", st == 200 and d.get("token"), f"status={st}")
    check(f"{site} studioId", d.get("studioId") == f"studio-{site}", str(d.get("studioId")))

# кросс-логин: hvv креды на sgx и наоборот
st, d = login(URLS["sgx"], *CREDS["hvv"])
check("hvv creds on sgx → 401", st == 401, f"status={st} {d}")
st, d = login(URLS["hvv"], *CREDS["sgx"])
check("sgx creds on hvv → 401", st == 401, f"status={st} {d}")

# неверный пароль
st, d = login(URLS["sgx"], CREDS["sgx"][0], "wrong-password")
check("bad password → 401", st == 401, f"status={st}")

print(f"\n=== {ok} OK / {fail} FAIL ===")
raise SystemExit(1 if fail else 0)
