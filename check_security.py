#!/usr/bin/env python3
"""Security regression smoke for detailing workers.

Checks (against a live base URL):
  1. GET /api/bookings public → no clientName/phone/car/paid PII
  2. PATCH without auth → 401
  3. PATCH cancel without clientToken → 401
  4. POST booking with past date → 400
  5. POST booking missing phone → 400
  6. POST same slot twice (different ids) → second gets 409
  7. POST same id twice → deduped, not a second row
  8. GET /api/visits without auth → 401
  9. POST /api/push/flush without auth → 401
 10. Client cancel with wrong token → 401
 11. Client cancel with correct token → ok

Usage: python check_security.py [base_url]
"""
import json
import os
import sys
import time
import urllib.error
import urllib.request

BASE = (sys.argv[1] if len(sys.argv) > 1 else os.environ.get(
    "SECURITY_BASE", "https://detailing-francev.deteiling-pro.workers.dev"
)).rstrip("/")
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


def api(path, body=None, method="GET", token=None, headers=None):
    h = dict(UA)
    if token:
        h["Authorization"] = f"Bearer {token}"
    if headers:
        h.update(headers)
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, headers=h, method=method)
    try:
        r = urllib.request.urlopen(req, timeout=30)
        raw = r.read().decode() or "{}"
        return r.status, json.loads(raw)
    except urllib.error.HTTPError as e:
        raw = e.read().decode() or "{}"
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, {"error": raw[:200]}


def main():
    ts = int(time.time())
    studio = "studio-francev"
    slot_date = "2026-12-15"
    owner_pw = os.environ.get("FRANCEV_OWNER_PASSWORD", "")

    print(f"=== security smoke @ {BASE} ===")

    # 1) public GET — no PII
    st, data = api(f"/api/bookings?studio={studio}")
    check("GET public 200", st == 200, f"status={st}")
    bookings = data.get("bookings") or []
    leaked = [
        b for b in bookings
        if (b.get("phone") or b.get("clientName") or b.get("car") or b.get("paid"))
    ]
    check("GET public no PII", not leaked, f"leaked={leaked[:1]} count={len(bookings)}")

    # 2) PATCH without auth
    st, data = api("/api/bookings/nope", {"status": "cancelled"}, method="PATCH")
    check("PATCH unauth 401/404", st in (401, 404), f"status={st} {data}")

    # 3-7) create bookings
    base_b = {
        "studioId": studio,
        "serviceId": "svc-polish",
        "serviceName": "Полировка кузова",
        "clientName": "Security Test",
        "phone": "+375 29 000-00-01",
        "car": "Test",
        "date": slot_date,
        "time": "10:00",
        "bay": 1,
        "durationMin": 60,
        "reminderEnabled": False,
    }

    st, data = api("/api/bookings", {**base_b, "id": f"sec-past-{ts}", "date": "2020-01-01"}, method="POST")
    check("POST past date 400", st == 400, f"status={st}")

    st, data = api("/api/bookings", {**base_b, "id": f"sec-nophone-{ts}", "phone": ""}, method="POST")
    check("POST no phone 400", st == 400, f"status={st}")

    id1 = f"sec-a-{ts}"
    id2 = f"sec-b-{ts}"
    st, data = api("/api/bookings", {**base_b, "id": id1}, method="POST")
    check("POST first 200", st == 200 and data.get("ok"), f"status={st} {str(data)[:120]}")
    token1 = data.get("clientToken") or ""
    check("POST returns clientToken", bool(token1))

    st, data = api("/api/bookings", {**base_b, "id": id1, "time": "11:00"}, method="POST")
    check("POST same id deduped", st == 200 and data.get("deduped") is True, f"status={st} {str(data)[:120]}")

    st, data = api("/api/bookings", {**base_b, "id": id2, "time": "10:30"}, method="POST")
    check("POST overlap 409", st == 409, f"status={st} {data}")

    st, data = api("/api/bookings", {**base_b, "id": id2, "time": "13:00"}, method="POST")
    check("POST free slot 200", st == 200 and data.get("ok"), f"status={st}")
    token2 = data.get("clientToken") or ""

    # 8-9) visits / flush need auth
    st, data = api("/api/visits")
    check("GET visits unauth 401", st == 401, f"status={st}")

    st, data = api("/api/push/flush", {}, method="POST")
    check("flush unauth 401", st == 401, f"status={st}")

    # 10-11) client cancel
    st, data = api(f"/api/bookings/{id2}", {"status": "cancelled", "clientToken": "WRONG"}, method="PATCH")
    check("cancel wrong token 401", st == 401, f"status={st}")

    st, data = api(f"/api/bookings/{id2}", {"status": "cancelled", "clientToken": token2}, method="PATCH")
    check("cancel own token 200", st == 200 and data.get("ok"), f"status={st} {data}")

    # client cannot edit other fields
    st, data = api(f"/api/bookings/{id1}", {"phone": "+375 29 999-99-99", "clientToken": token1}, method="PATCH")
    check("client cannot edit phone 401", st == 401, f"status={st}")

    # owner can edit if password provided
    if owner_pw:
        st, data = api("/api/auth/login", {"email": "owner@francev.by", "password": owner_pw}, method="POST")
        check("owner login 200", st == 200 and data.get("token"), f"status={st}")
        tok = data.get("token")
        st, data = api("/api/bookings?studio=studio-francev", token=tok)
        full = [b for b in (data.get("bookings") or []) if b.get("phone")]
        check("GET with owner returns PII", bool(full), f"full={len(full)}")

        st, data = api(f"/api/bookings/{id1}", {"status": "cancelled"}, method="PATCH", token=tok)
        check("owner can cancel 200", st == 200, f"status={st}")

        st, data = api("/api/visits", token=tok)
        check("owner can list visits 200", st == 200, f"status={st}")

        st, data = api("/api/push/flush", {}, method="POST", token=tok)
        check("owner can flush 200", st == 200, f"status={st}")

        # cleanup
        for bid in (id1, id2):
            api(f"/api/bookings/{bid}", method="DELETE", token=tok)
    else:
        print("  SKIP owner checks (set FRANCEV_OWNER_PASSWORD)")

    print(f"\n=== RESULT: {ok} ok / {fail} fail ===")
    return 1 if fail else 0


if __name__ == "__main__":
    raise SystemExit(main())
