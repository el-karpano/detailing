"""
Точный сценарий бага: занять ВСЕ окна дня → день без точек →
переключиться на свободный день → время выбирается.
"""
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


def api(path, method="GET", body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        BASE + path,
        data=data,
        headers={"User-Agent": "Mozilla/5.0", "Content-Type": "application/json"},
        method=method,
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            raw = r.read().decode()
            return r.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, {"raw": raw[:200]}


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


with sync_playwright() as pw:
    b = pw.chromium.launch(channel="chrome", headless=True)
    p = b.new_page(viewport={"width": 390, "height": 844})
    p.goto(BASE + "/book/svc-wash2", wait_until="networkidle")
    p.wait_for_timeout(1000)

    # услуга с длинной длительностью (480 мин) — 3 бокса = день полностью занят
    p.goto(BASE + "/book/svc-polish", wait_until="networkidle")
    p.wait_for_timeout(1500)

    free = p.locator(".calendar-day.has-free:not(.is-closed):not(:disabled)")
    check("free days exist", free.count() > 2, f"n={free.count()}")
    free.nth(0).click()
    p.wait_for_timeout(600)

    month_txt = p.locator(".calendar-month").inner_text()
    day_txt = p.locator(".calendar-day.is-selected span").first.inner_text().strip()
    months = ["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"]
    mi = months.index(month_txt.split()[0]) + 1
    year = int(month_txt.split()[1])
    iso = f"{year}-{mi:02d}-{int(day_txt):02d}"
    print("  iso", iso)

    booked = 0
    for bay in (1, 2, 3):
        st, d = api_book({
            "id": f"polish-full-{iso}-b{bay}",
            "studioId": "studio-hvv",
            "serviceId": "svc-polish",
            "serviceName": "Полировка",
            "clientName": f"Полный b{bay}",
            "phone": f"+375 29 111-00-0{bay}",
            "car": "Fill",
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
        print("  bay", bay, st, d.get("error", "ok"))
        if st == 200:
            booked += 1
    print("  filled", booked, "long bookings")
    check("filled 3 long bays", booked == 3)

    # перезагружаем страницу (подтянет с сервера)
    p.goto(BASE + "/book/svc-polish", wait_until="networkidle")
    p.wait_for_timeout(1500)

    # кликаем тот же день — должно показать «заняты» или серые слоты
    # найдем день по числу
    day_cells = p.locator(".calendar-day:not(.is-out):not(:disabled)")
    target = None
    for i in range(day_cells.count()):
        if day_cells.nth(i).locator("span").first.inner_text().strip() == day_txt:
            target = day_cells.nth(i)
            break
    if target:
        target.click()
        p.wait_for_timeout(800)
    body = p.locator("body").inner_text()
    enabled_times = p.locator('button:enabled').filter(has_text=re.compile(r"^\d{2}:\d{2}$"))
    busy_msg = "занят" in body.lower() or enabled_times.count() == 0
    check("full day detected", busy_msg, f"enabled_times={enabled_times.count()}")

    # ПЕРЕКЛЮЧАЕМСЯ на свободный день (с точкой)
    free2 = p.locator(".calendar-day.has-free:not(.is-closed):not(:disabled)")
    check("other free days still exist", free2.count() > 0, f"n={free2.count()}")
    if free2.count():
        free2.nth(0).click()
        p.wait_for_timeout(800)
        body = p.locator("body").inner_text()
        t2 = p.locator('button:enabled').filter(has_text=re.compile(r"^\d{2}:\d{2}$"))
        check("BUG FIXED: times appear on other day", t2.count() > 0, f"n={t2.count()}")
        check("BUG FIXED: no stuck message", "Все окна на эту дату заняты" not in body)
        # выбираем время
        if t2.count():
            t2.first.click()
            p.wait_for_timeout(300)
            sub = p.locator('button:has-text("Подтвердить запись")')
            check("submit available", sub.count() > 0 and sub.first.is_enabled())

    b.close()

print(f"\nPASS {len(oks)} FAIL {len(fails)}")
for f in fails:
    print(" FAIL:", f)
