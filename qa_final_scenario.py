"""Финальный сценарий: день полностью занят → другой день → время доступно."""
from playwright.sync_api import sync_playwright
import json
import urllib.request
import urllib.error
import re

BASE = "https://detailing-hvv.deteiling-pro.workers.dev"
fails, oks = [], []


def check(name, cond, detail=""):
    (oks if cond else fails).append(name)
    print(("  OK  " if cond else "  FAIL ") + name + (" " + detail if detail else ""))


def api_book(booking):
    req = urllib.request.Request(
        BASE + "/api/bookings",
        data=json.dumps(booking).encode(),
        headers={"User-Agent": "Mozilla/5.0", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return r.status, json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode() or "{}")


# 1) займём 2026-11-10 (вт) полировкой на все 3 бокса
iso = "2026-11-10"
booked = 0
for bay in (1, 2, 3):
    st, d = api_book({
        "id": f"final-{iso}-b{bay}",
        "studioId": "studio-hvv",
        "serviceId": "svc-polish",
        "serviceName": "Полировка",
        "clientName": f"Занявший {bay}",
        "phone": f"+375 29 777-00-0{bay}",
        "car": "BMW",
        "date": iso,
        "time": "09:00",
        "bay": bay,
        "status": "accepted",
        "price": 300,
        "paid": 0,
        "createdAt": "2026-10-05T12:00:00.000Z",
        "reminderEnabled": False,
        "durationMin": 480,
    })
    print("  fill bay", bay, st, d.get("error", "ok"))
    if st == 200:
        booked += 1
check("day filled on server", booked == 3, f"booked={booked}")

with sync_playwright() as pw:
    b = pw.chromium.launch(channel="chrome", headless=True)
    p = b.new_page(viewport={"width": 390, "height": 844})

    # полировка — там день должен быть занят
    p.goto(BASE + "/book/svc-polish", wait_until="networkidle")
    p.wait_for_timeout(1500)

    # найти 10 ноября в календаре (может быть в ноябре — листаем)
    for _ in range(3):
        cells = p.locator(".calendar-day:not(.is-out)")
        found = False
        for i in range(cells.count()):
            cell = cells.nth(i)
            if cell.locator("span").first.inner_text().strip() == "10":
                # проверим месяц
                if "Ноябрь" in p.locator(".calendar-month").inner_text():
                    if not cell.is_disabled():
                        cell.click()
                        found = True
                        break
        if found:
            break
        nxt = p.locator('button[aria-label="Следующий месяц"]')
        if nxt.count() and nxt.first.is_enabled():
            nxt.first.click()
            p.wait_for_timeout(400)

    p.wait_for_timeout(800)
    body = p.locator("body").inner_text()
    en = p.locator('button:enabled').filter(has_text=re.compile(r"^\d{2}:\d{2}$"))
    full = "занят" in body.lower() or en.count() == 0
    check("10 nov full for polish", full, f"enabled={en.count()}")

    # переключаемся на любой день с точкой
    free = p.locator(".calendar-day.has-free:not(.is-closed):not(:disabled)")
    check("other days with free slots", free.count() > 0, f"n={free.count()}")
    if free.count():
        free.nth(0).click()
        p.wait_for_timeout(800)
        body = p.locator("body").inner_text()
        en2 = p.locator('button:enabled').filter(has_text=re.compile(r"^\d{2}:\d{2}$"))
        check("FIX: times on another day", en2.count() > 0, f"n={en2.count()}")
        check("FIX: no stuck full message", "Все окна" not in body)
        if en2.count():
            en2.first.click()
            p.wait_for_timeout(200)
            sub = p.locator('button:has-text("Подтвердить запись")')
            check("FIX: can submit", sub.count() and sub.first.is_enabled())

    b.close()

print(f"\nPASS {len(oks)} FAIL {len(fails)}")
for f in fails:
    print(" FAIL:", f)
