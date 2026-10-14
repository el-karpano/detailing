#!/usr/bin/env python3
"""Diagnose why push subscribe fails + try Firefox."""
import base64
import json
import urllib.request

from playwright.sync_api import sync_playwright

BASE = "https://detailing-francev.deteiling-pro.workers.dev"

req = urllib.request.Request(BASE + "/api/push/public-key", headers={"User-Agent": "Mozilla/5.0"})
pk = json.loads(urllib.request.urlopen(req, timeout=20).read().decode())["publicKey"]
print("publicKey len", len(pk), "sample", pk[:20], "...", pk[-10:])
# VAPID uncompressed P-256 is 65 bytes → 87 base64url chars
raw = base64.urlsafe_b64decode(pk + "=" * (-len(pk) % 4))
print("decoded bytes", len(raw), "first", raw[0], "(should be 4 for uncompressed P-256)")

with sync_playwright() as p:
    for name, launcher, opts in [
        ("chrome-headed", p.chromium, {"channel": "chrome", "headless": False}),
        ("firefox", p.firefox, {"headless": True}),
    ]:
        try:
            browser = launcher.launch(**opts)
            ctx = browser.new_context(locale="ru-RU")
            ctx.grant_permissions(["notifications"], origin=BASE)
            page = ctx.new_page()
            page.goto(BASE + "/", wait_until="networkidle", timeout=60000)
            info = page.evaluate(
                """async (publicKey) => {
                  const out = {
                    permission: Notification.permission,
                    hasSW: 'serviceWorker' in navigator,
                    hasPush: 'PushManager' in window,
                    controller: !!navigator.serviceWorker.controller,
                  };
                  try {
                    const reg = await navigator.serviceWorker.register('/sw.js');
                    await navigator.serviceWorker.ready;
                    out.swActive = !!reg.active;
                    out.scope = reg.scope;
                    if (!navigator.serviceWorker.controller) {
                      // reload-free takeover for PWA
                      await new Promise((resolve) => {
                        navigator.serviceWorker.addEventListener(
                          'controllerchange',
                          () => resolve(),
                          { once: true },
                        );
                        setTimeout(resolve, 2000);
                      });
                    }
                    out.controller = !!navigator.serviceWorker.controller;
                  } catch (e) {
                    out.swError = String(e);
                    return out;
                  }
                  try {
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
                    out.endpoint = (sub && sub.endpoint || '').slice(0, 90);
                    out.subscribed = !!sub;
                  } catch (e) {
                    out.pushError = String(e);
                    out.pushName = e && e.name;
                  }
                  return out;
                }""",
                pk,
            )
            print(name, "→", json.dumps(info, ensure_ascii=False))
            browser.close()
        except Exception as e:
            print(name, "LAUNCH FAIL", e)
