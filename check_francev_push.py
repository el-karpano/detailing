#!/usr/bin/env python3
"""E2E: Web Push delivery for francev.

Proves the full chain:
  browser Notification permission → PushManager.subscribe → POST /api/visits
  → POST /api/push/flush (cron path) → SW showNotification.

Usage: python check_francev_push.py
"""
import json
import time
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE = "https://detailing-francev.deteiling-pro.workers.dev"
UA = {"User-Agent": "Mozilla/5.0", "Content-Type": "application/json"}
OUT = Path("shots/francev")
OUT.mkdir(parents=True, exist_ok=True)
VISIT_ID = f"push-e2e-{int(time.time())}"


def api(path, body=None, method="GET"):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, headers=UA, method=method)
    try:
        r = urllib.request.urlopen(req, timeout=30)
        return r.status, json.loads(r.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode() or "{}")


def main():
    # 0) VAPID public key
    status, pk = api("/api/push/public-key")
    public_key = pk.get("publicKey") or ""
    print(f"[1] public-key status={status} len={len(public_key)}")
    assert status == 200 and public_key, "no VAPID public key"

    with sync_playwright() as p:
        # headless Chromium often hard-denies Notification; try headed Chrome first
        launch_opts = [
            {"channel": "chrome", "headless": False},
            {"channel": "chrome", "headless": True},
            {"headless": False},
            {"headless": True},
        ]
        browser = None
        ctx = None
        page = None
        for opts in launch_opts:
            try:
                print(f"[1a] try launch {opts}")
                browser = p.chromium.launch(**opts)
                ctx = browser.new_context(
                    viewport={"width": 390, "height": 844},
                    locale="ru-RU",
                    user_agent=(
                        "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 "
                        "(KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36"
                    ),
                )
                ctx.grant_permissions(["notifications"], origin=BASE)
                page = ctx.new_page()
                page.goto(BASE + "/", wait_until="networkidle", timeout=60000)
                perm = page.evaluate("() => Notification.permission")
                print(f"[1b] Notification.permission={perm} with {opts}")
                if perm == "granted":
                    break
                browser.close()
                browser = None
            except Exception as e:
                print(f"[1a] failed {opts}: {e}")
                if browser:
                    browser.close()
                    browser = None
        assert browser and page, "could not launch browser with notifications"
        assert page.evaluate("() => Notification.permission") == "granted"

        # SW must control the page before PushManager.subscribe
        page.evaluate(
            """async () => {
              const reg = await navigator.serviceWorker.register('/sw.js');
              await navigator.serviceWorker.ready;
              // ensure this page is controlled
              if (!navigator.serviceWorker.controller) {
                await new Promise((r) => {
                  navigator.serviceWorker.addEventListener('controllerchange', r, { once: true });
                  setTimeout(r, 3000);
                });
              }
              window.__swReady = !!(await navigator.serviceWorker.ready);
            }"""
        )

        # subscribe like reminders.ts
        page.evaluate(
            """async (publicKey) => {
              const urlBase64ToUint8Array = (base64String) => {
                const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
                const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
                const raw = atob(base64);
                const output = new Uint8Array(raw.length);
                for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
                return output;
              };
              const reg = await navigator.serviceWorker.ready;
              let sub = await reg.pushManager.getSubscription();
              if (!sub) {
                sub = await reg.pushManager.subscribe({
                  userVisibleOnly: true,
                  applicationServerKey: urlBase64ToUint8Array(publicKey),
                });
              }
              window.__pushSub = sub.toJSON();
              console.log('subscribed', !!sub, sub.endpoint);
            }""",
            public_key,
        )

        # wrap showNotification inside the active service worker
        page.evaluate(
            """async () => {
              const reg = await navigator.serviceWorker.ready;
              const sw = reg.active;
              if (!sw) throw new Error('no active SW');
              await new Promise((resolve, reject) => {
                const ch = new MessageChannel();
                ch.port1.onmessage = (e) => resolve(e.data);
                // Use postMessage to ask SW to wrap — SW has no custom handler,
                // so instead we rely on notification API polling below.
                resolve('skip-wrap');
              });
            }"""
        )

        # Poll Notification via SW clients is unreliable; use a page-side push event probe:
        # Chromium delivers push to SW only. We therefore also register a second
        # listener by fetching a generated script — simpler: poll registration.getNotifications
        # after flush, and also watch for a page-side 'push' isn't available.
        #
        # Robust approach: override Notification constructor is page-only.
        # We'll ask the SW to run code via clients — not possible.
        # Fallback: after flush, call reg.getNotifications() from the page
        # (shows notifications created by SW via registration.showNotification).

        sub = page.evaluate("() => window.__pushSub")
        print("[2] push subscription endpoint:", (sub or {}).get("endpoint", "")[:80], "...")
        assert sub and sub.get("endpoint"), "no push subscription"

        # visit ~24h from now → notifyAt is due immediately for cron/flush
        visit_at = datetime.now(timezone.utc) + timedelta(hours=24, minutes=2)
        # worker does new Date(`${date}T${time}:00`) — local-ish ISO without Z is OK if we use UTC-naive
        # Use the browser's local interpretation: pass date/time in UTC wall clock.
        date_s = visit_at.strftime("%Y-%m-%d")
        time_s = visit_at.strftime("%H:%M")

        status, body = api(
            "/api/visits",
            {
                "id": VISIT_ID,
                "serviceName": "Полировка кузова",
                "date": date_s,
                "time": time_s,
                "clientName": "Push E2E",
                "subscription": sub,
                "remind": True,
            },
            method="POST",
        )
        print(f"[3] POST /api/visits status={status} body={body}")
        assert status == 200 and body.get("ok"), "visit not saved"

        # snapshot notifications before
        before = page.evaluate(
            "async () => (await navigator.serviceWorker.ready).getNotifications().then(n => n.length)"
        )
        print(f"[4] notifications before flush: {before}")

        # flush = cron path
        status, body = api("/api/push/flush", {}, method="POST")
        print(f"[5] POST /api/push/flush status={status} body={body}")
        assert status == 200, "flush failed"

        # wait for push to land (FCM can take a few seconds)
        got = []
        for i in range(30):
            time.sleep(1)
            notes = page.evaluate(
                """async () => {
                  const reg = await navigator.serviceWorker.ready;
                  const list = await reg.getNotifications();
                  return list.map(n => ({ title: n.title, body: n.body, tag: n.tag }));
                }"""
            )
            if notes:
                got = notes
                print(f"[6] notifications after flush ({i+1}s):", notes)
                break
            if i in (0, 5, 15, 29):
                print(f"    ... waiting push ({i+1}s)")

        # screenshot with notification may not show in headless; still save home
        page.screenshot(path=str(OUT / "push-e2e.png"), full_page=False)

        # cleanup visit regardless
        try:
            req = urllib.request.Request(
                f"{BASE}/api/visits/{VISIT_ID}", headers=UA, method="DELETE"
            )
            urllib.request.urlopen(req, timeout=15).read()
            print("[7] visit deleted")
        except Exception as e:
            print("[7] delete warn:", e)

        browser.close()

        if got:
            print("PUSH OK — уведомление доставлено и показано в SW")
            for n in got:
                print("   title:", n.get("title"), "| body:", n.get("body"))
            return 0
        print("PUSH FAIL — flush отработал, но уведомление не появилось")
        print("  Возможные причины: FCM endpoint, VAPID mismatch, SW не активен")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
