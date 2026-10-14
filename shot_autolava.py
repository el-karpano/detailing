#!/usr/bin/env python3
"""UI screenshots for live autolava PWA."""
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE = "https://detailing-autolava.deteiling-pro.workers.dev"
OUT = Path("shots/autolava")
OUT.mkdir(parents=True, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context(viewport={"width": 390, "height": 844}, locale="ru-RU")
    page = ctx.new_page()
    page.goto(BASE + "/", wait_until="networkidle", timeout=60000)
    page.evaluate(
        """async () => {
          await Promise.all((await caches.keys()).map(k => caches.delete(k)));
          await Promise.all((await navigator.serviceWorker.getRegistrations()).map(r => r.unregister()));
        }"""
    )
    page.reload(wait_until="networkidle", timeout=60000)
    page.wait_for_timeout(1200)
    page.screenshot(path=str(OUT / "home.png"), full_page=True)
    body = page.inner_text("body")
    for c in ["AutoLava", "Нововиленская", "623-44-94", "Запись", "услуг"]:
        print(f"  home {c!r}: {c in body or c.lower() in body.lower()}")
    page.goto(BASE + "/services", wait_until="networkidle", timeout=60000)
    page.wait_for_timeout(800)
    page.screenshot(path=str(OUT / "services.png"), full_page=True)
    sbody = page.inner_text("body")
    for c in ["Антигравий", "Керам", "Полировк", "Br"]:
        print(f"  services {c!r}: {c in sbody}")
    browser.close()
    print("shots →", OUT.resolve())
