#!/usr/bin/env python3
"""Visual smoke of live francev PWA."""
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE = "https://detailing-francev.deteiling-pro.workers.dev"
OUT = Path("shots/francev")
OUT.mkdir(parents=True, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context(
        viewport={"width": 390, "height": 844},
        user_agent=(
            "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) "
            "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
        ),
        locale="ru-RU",
    )
    page = ctx.new_page()
    # clear SW/cache like handoff says
    page.goto(BASE + "/", wait_until="networkidle", timeout=60000)
    page.evaluate(
        """async () => {
          const keys = await caches.keys();
          await Promise.all(keys.map(k => caches.delete(k)));
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map(r => r.unregister()));
        }"""
    )
    page.reload(wait_until="networkidle", timeout=60000)
    page.wait_for_timeout(1500)

    # Home
    page.screenshot(path=str(OUT / "home.png"), full_page=True)
    title = page.title()
    body = page.inner_text("body")
    print("title:", title)
    checks = [
        "FRANCEV",
        "Солтыса",
        "668-66-61",
        "Запись",
        "услуг",
    ]
    for c in checks:
        print(f"  home has {c!r}: {c.lower() in body.lower()}")

    # Services
    page.goto(BASE + "/services", wait_until="networkidle", timeout=60000)
    page.wait_for_timeout(800)
    page.screenshot(path=str(OUT / "services.png"), full_page=True)
    sbody = page.inner_text("body")
    for c in ["Полировка", "Керам", "Химчистка", "Шумоизоляция", "Антихром", "Br"]:
        print(f"  services has {c!r}: {c.lower() in sbody.lower()}")

    # Booking
    page.goto(BASE + "/book/svc-polish", wait_until="networkidle", timeout=60000)
    page.wait_for_timeout(1000)
    page.screenshot(path=str(OUT / "book.png"), full_page=True)
    bbody = page.inner_text("body")
    for c in ["Полировк", "Телефон", "Имя", "Запис"]:
        print(f"  book has {c!r}: {c.lower() in bbody.lower()}")

    # Assistant
    page.goto(BASE + "/assistant", wait_until="networkidle", timeout=60000)
    page.wait_for_timeout(800)
    page.screenshot(path=str(OUT / "assistant.png"), full_page=True)

    browser.close()
    print("screenshots →", OUT.resolve())
