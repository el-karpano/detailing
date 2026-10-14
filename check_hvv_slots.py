"""Проверка: слоты HVV идут с 9:00 до вечера (часы студии 09–20)."""
from playwright.sync_api import sync_playwright
import re

BASE = "https://detailing-hvv.deteiling-pro.workers.dev"

with sync_playwright() as pw:
    b = pw.chromium.launch(channel="chrome", headless=True)
    p = b.new_page(viewport={"width": 390, "height": 844})
    # чистый localStorage, чтобы не тянулись старые 17:00
    p.goto(BASE + "/")
    p.evaluate("() => localStorage.clear()")
    p.goto(BASE + "/book/svc-wash2", wait_until="networkidle")
    p.wait_for_timeout(1500)

    times = []
    els = p.locator('button:enabled').filter(has_text=re.compile(r"^\d{2}:\d{2}$"))
    for i in range(els.count()):
        t = els.nth(i).inner_text().strip()
        if re.match(r"^\d{2}:\d{2}$", t):
            times.append(t)
    print("free times:", times)
    print("count", len(times))
    if times:
        print("first", times[0], "last", times[-1])
    body = p.locator("body").inner_text()
    # часы из календаря-расписания недоступны; смотрим текст
    print("has 20:00 or late:", any(t >= "16:00" for t in times))
    b.close()
