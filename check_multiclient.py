#!/usr/bin/env python3
"""Multi-client isolation + timezone smoke.

1. Bookings created on client A never appear on client B (separate D1).
2. Owner token from A does not work on B (studio_id isolation).
3. visitAt is studio-local (Europe/Minsk), not UTC — push window is correct.

Usage: python check_multiclient.py
"""
import json
import os
import time
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone

FRANCEV = "https://detailing-francev.deteiling-pro.workers.dev"
HVV = "https://detailing-hvv.deteiling-pro.workers.dev"
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


def api(base, path, body=None, method="GET", token=None):
    h = dict(UA)
    if token:
        h["Authorization"] = f"Bearer {token}"
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(base + path, data=data, headers=h, method=method)
    try:
        r = urllib.request.urlopen(req, timeout=30)
        return r.status, json.loads(r.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        raw = e.read().decode() or "{}"
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, {"error": raw[:200]}


def main():
    ts = int(time.time())
    print(f"=== multi-client + timezone smoke ===")

    # --- isolation: create on A, ensure absent on B ---
    payload = {
        "id": f"iso-{ts}",
        "studioId": "studio-francev",
        "serviceId": "svc-polish",
        "serviceName": "Полировка",
        "clientName": "Iso Test",
        "phone": "+375 29 000-00-02",
        "date": "2026-12-20",
        "time": "11:00",
        "bay": 1,
        "durationMin": 60,
        "reminderEnabled": False,
    }
    st, data = api(FRANCEV, "/api/bookings", payload, method="POST")
    check("create on francev", st == 200 and data.get("ok"), f"status={st}")
    tok = data.get("clientToken") or ""

    st, data = api(HVV, "/api/bookings?studio=studio-francev")
    ids = [b.get("id") for b in (data.get("bookings") or [])]
    check("hvv does not see francev booking", "iso-%s" % ts not in ids, f"ids={ids[:5]}")

    st, data = api(HVV, "/api/bookings?studio=studio-hvv")
    ids = [b.get("id") for b in (data.get("bookings") or [])]
    check("hvv has own namespace", "iso-%s" % ts not in ids)

    # owner token A must not work on B (login with A creds on B → 401 or wrong studio)
    pw = os.environ.get("FRANCEV_OWNER_PASSWORD", "")
    if pw:
        st, data = api(FRANCEV, "/api/auth/login", {"email": "owner@francev.by", "password": pw}, method="POST")
        token_a = data.get("token")
        check("login A", st == 200 and token_a, f"status={st}")
        if token_a:
            st, data = api(HVV, "/api/visits", token=token_a)
            check("token A rejected on hvv visits", st == 401, f"status={st}")
            st, data = api(HVV, "/api/bookings", {"status": "cancelled"}, method="PATCH", token=token_a)
            # PATCH path /api/bookings without id → method; with foreign id → 401
            st2, _ = api(HVV, f"/api/bookings/iso-{ts}", {"status": "cancelled"}, method="PATCH", token=token_a)
            check("token A cannot patch hvv booking", st2 in (401, 404), f"status={st2}")
    else:
        print("  SKIP owner cross-login (FRANCEV_OWNER_PASSWORD)")

    # --- timezone: visitAt must be Minsk wall-clock → UTC ---
    # Book for a far future date at 09:00 Minsk (UTC+3) → visitAt should be 06:00 UTC
    date_s = "2027-01-10"
    time_s = "09:00"
    st, data = api(
        FRANCEV,
        "/api/visits",
        {
            "id": f"tz-{ts}",
            "serviceName": "TZ Check",
            "date": date_s,
            "time": time_s,
            "subscription": {
                "endpoint": "https://example.com/push/tz",
                "keys": {"p256dh": "x", "auth": "y"},
            },
            "remind": True,
        },
        method="POST",
    )
    check("save visit", st == 200 and data.get("ok"), f"status={st}")

    # owner list visits to read visitAt (KV list can lag a moment)
    if pw:
        st, data = api(FRANCEV, "/api/auth/login", {"email": "owner@francev.by", "password": pw}, method="POST")
        token_a = data.get("token")
        v = None
        for i in range(8):
            st, data = api(FRANCEV, "/api/visits", token=token_a)
            visits = {x["id"]: x for x in (data.get("visits") or [])}
            v = visits.get(f"tz-{ts}")
            if v:
                break
            time.sleep(1)
        check("visit listed", bool(v), f"tries={i+1} all={[x.get('id') for x in (data.get('visits') or [])]}")
        if v:
            visit_at = v.get("visitAt")
            expected = datetime(2027, 1, 10, 6, 0, tzinfo=timezone.utc).timestamp() * 1000
            # allow 0 ms — Minsk has no DST, fixed +3
            drift = abs((visit_at or 0) - expected)
            check(
                "visitAt = Minsk 09:00 → 06:00 UTC",
                drift < 60_000,
                f"visitAt={visit_at} expected={expected} drift_min={drift/60000:.1f}",
            )
            # push due = visitAt - 24h = 2027-01-09 06:00 UTC = 09:00 Minsk previous day
            notify_at = (visit_at or 0) - 24 * 3600 * 1000
            expected_notify = datetime(2027, 1, 9, 6, 0, tzinfo=timezone.utc).timestamp() * 1000
            check(
                "notify 24h before in Minsk wall-clock",
                abs(notify_at - expected_notify) < 60_000,
                f"notify_at={notify_at}",
            )
        api(FRANCEV, f"/api/visits/tz-{ts}?token=x", method="DELETE", token=token_a)
    else:
        # without owner we can still verify create accepted a Minsk-bound slot (not rejected as past)
        print("  SKIP visitAt assert (need owner token)")

    # cleanup booking
    if pw:
        st, data = api(FRANCEV, "/api/auth/login", {"email": "owner@francev.by", "password": pw}, method="POST")
        api(FRANCEV, f"/api/bookings/iso-{ts}", method="DELETE", token=data.get("token"))

    print(f"\n=== RESULT: {ok} ok / {fail} fail ===")
    return 1 if fail else 0


if __name__ == "__main__":
    raise SystemExit(main())
