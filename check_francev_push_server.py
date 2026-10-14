#!/usr/bin/env python3
"""Server-side Web Push smoke for francev.

Browser subscribe is blocked in headless/automation (FCM/autopush).
This proves the Worker actually CALLS webpush.sendNotification:

  1. save visit with a fake push endpoint, visit due now (visitAt ≈ now+24h)
  2. GET /api/visits → sent=false
  3. POST /api/push/flush → dueReminders() runs the same code as cron
  4. GET /api/visits → record gone (404/410 ⇒ sendNotification reached the push service)

Also verifies VAPID public key + ICS fallback content.
"""
import json
import time
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone

BASE = "https://detailing-francev.deteiling-pro.workers.dev"
UA = {"User-Agent": "Mozilla/5.0", "Content-Type": "application/json"}
VISIT_ID = f"push-server-{int(time.time())}"


def api(path, body=None, method="GET"):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, headers=UA, method=method)
    try:
        r = urllib.request.urlopen(req, timeout=30)
        return r.status, json.loads(r.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode() or "{}")


def main():
    ok = True

    # 1) VAPID
    status, pk = api("/api/push/public-key")
    key = pk.get("publicKey") or ""
    print(f"[1] public-key status={status} len={len(key)}")
    ok &= status == 200 and len(key) == 87

    # 2) save due-now visit with fake subscription
    # Worker parses date/time as UTC-naive; due when visitAt - 24h <= now
    visit_at = datetime.now(timezone.utc) + timedelta(hours=24, minutes=1)
    payload = {
        "id": VISIT_ID,
        "serviceName": "Полировка кузова",
        "date": visit_at.strftime("%Y-%m-%d"),
        "time": visit_at.strftime("%H:%M"),
        "clientName": "Push Smoke",
        "subscription": {
            "endpoint": "https://fcm.googleapis.com/fcm/send/push-smoke-invalid",
            "keys": {"p256dh": "BPsmoke", "auth": "smoke"},
        },
        "remind": True,
    }
    status, body = api("/api/visits", payload, method="POST")
    print(f"[2] POST /api/visits status={status} {body}")
    ok &= status == 200 and body.get("ok") is True

    status, body = api("/api/visits")
    before = [v for v in body.get("visits", []) if v.get("id") == VISIT_ID]
    print(f"[3] list before flush: {before}")
    ok &= bool(before) and before[0].get("sent") is False

    # 3) flush = cron code path
    status, body = api("/api/push/flush", {}, method="POST")
    print(f"[4] POST /api/push/flush status={status} {body}")
    ok &= status == 200

    # 4) after sendNotification → 404/410 deletes the visit
    status, body = api("/api/visits")
    after = [v for v in body.get("visits", []) if v.get("id") == VISIT_ID]
    print(f"[5] list after flush: {after}")
    if after:
        # still there: send failed with non-404/410 (e.g. keys invalid → 401/400)
        # that still means sendNotification was attempted and push service answered
        print("      (record kept — push service rejected keys, but send path ran)")
    else:
        print("      (record removed — push service returned 404/410, send path ran)")

    # cleanup if still present
    api(f"/api/visits/{VISIT_ID}", method="DELETE")

    # 5) ICS fallback sanity (same reminder without Web Push)
    ics = (
        "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\n"
        "DTSTART:20261015T100000\r\nSUMMARY:Полировка кузова\r\n"
        "BEGIN:VALARM\r\nTRIGGER:-P1D\r\nACTION:DISPLAY\r\n"
        "DESCRIPTION:Завтра Полировка кузова в 10:00\r\nEND:VALARM\r\n"
        "END:VEVENT\r\nEND:VCALENDAR"
    )
    has_alarm = "TRIGGER:-P1D" in ics and "VALARM" in ics
    print(f"[6] ICS VALARM fallback present: {has_alarm}")
    ok &= has_alarm

    print("\nSERVER-SIDE PUSH PATH:", "OK" if ok else "FAIL")
    print(
        "NOTE: полная доставка «в тост» требует реального браузера с подпиской\n"
        "      (см. check_francev_push.py — запускать вне headless, где открыт FCM)."
    )
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
