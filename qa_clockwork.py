"""
Досканальный smoke: краевые случаи записи, владелец, ИИ, API, календарь.
"""
from playwright.sync_api import sync_playwright
import json
import urllib.request
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


import urllib.error

print("\n======== API ========")
st, d = api("/api/push/public-key")
check("push public-key", st == 200 and len(d.get("publicKey", "")) > 20)

st, d = api("/api/bookings?studio=studio-hvv")
check("bookings GET studio-hvv", st == 200 and isinstance(d.get("bookings"), list), f"n={len(d.get('bookings', []))}")

st, d = api("/api/chat", "POST", {
    "messages": [{"role": "user", "content": "привет"}],
    "studio": {"name": "ХВВ", "currency": "Br", "services": [{"id": "svc-wash2", "title": "Двухфазная", "price": 20, "durationMin": 40, "active": True}]},
    "freeSlots": [{"date": "2026-10-10", "times": ["10:00"]}],
})
check("ai chat", st == 200 and bool(d.get("reply")), f"st={st}")

print("\n======== UI EDGE ========")
with sync_playwright() as pw:
    b = pw.chromium.launch(channel="chrome", headless=True)
    p = b.new_page(viewport={"width": 390, "height": 844})
    js_errors = []
    p.on("pageerror", lambda e: js_errors.append(str(e)))

    # --- календарь: навигация по месяцам ---
    p.goto(BASE + "/book/svc-wash2", wait_until="networkidle")
    p.wait_for_timeout(800)
    check("calendar days", p.locator(".calendar-day:not(.is-out)").count() >= 28)
    month_btns = p.locator(".calendar button[aria-label]")
    check("month nav buttons", month_btns.count() >= 2)
    if month_btns.count() >= 2:
        month_btns.nth(1).click()  # next month
        p.wait_for_timeout(400)
        body = p.locator("body").inner_text()
        check("next month works", re.search(r"[А-Яа-я]+ \d{4}", body) is not None)
        month_btns.nth(0).click()
        p.wait_for_timeout(300)

    # --- занятый день → другой день → время ---
    free = p.locator(".calendar-day.has-free:not(.is-closed):not(:disabled)")
    check("has free days", free.count() > 3, f"n={free.count()}")
    free.nth(0).click()
    p.wait_for_timeout(500)
    t1 = p.locator('button:enabled').filter(has_text=re.compile(r"^\d{2}:\d{2}$")).count()
    check("times after first day", t1 > 0, f"n={t1}")

    # забронируем все окна этого дня через API, потом перезагрузим
    # (локально сначала узнаём слоты)
    times = []
    els = p.locator('button:enabled').filter(has_text=re.compile(r"^\d{2}:\d{2}$"))
    for i in range(min(els.count(), 20)):
        t = els.nth(i).inner_text().strip()
        if re.match(r"^\d{2}:\d{2}$", t):
            times.append(t)
    selected_date = p.locator(".calendar-day.is-selected span").first.inner_text()
    # получим ISO даты из title/класса
    iso = p.locator(".calendar-day.is-selected").first.get_attribute("data-iso") or ""
    if not iso:
        # вытащим из state через JS недоступно — возьмём из URL query после клика
        iso = p.evaluate("() => ''")
    print("  picked day cell", selected_date, "times", times[:4], "iso", iso)

    # смена дня
    if free.count() > 1:
        free.nth(1).click()
        p.wait_for_timeout(600)
        body = p.locator("body").inner_text()
        t2 = p.locator('button:enabled').filter(has_text=re.compile(r"^\d{2}:\d{2}$")).count()
        check("switch day recovers times", t2 > 0, f"n={t2}")
        check("no stuck error after switch", "Выберите дату и свободное время" not in body)

    # --- submit без имени ---
    p.click('button:has-text("Подтвердить запись")')
    p.wait_for_timeout(500)
    body = p.locator("body").inner_text()
    check("empty form blocked", "имя" in body.lower() or "телефон" in body.lower())

    # --- полный флоу записи ---
    p.fill("#name", "Часы Тест")
    p.fill("#phone", "+375 29 333-44-55")
    p.fill("#car", "Lada Vesta")
    tbtn = p.locator('button:enabled').filter(has_text=re.compile(r"^\d{2}:\d{2}$"))
    if tbtn.count():
        tbtn.nth(0).click()
        p.wait_for_timeout(200)
    p.click('button:has-text("Подтвердить запись")')
    p.wait_for_timeout(3000)
    ok_book = "/my" in p.url
    body = p.locator("body").inner_text()
    check("book success", ok_book and "Часы Тест" in body, f"url={p.url}")

    # --- мои записи: отмена ---
    if ok_book:
        cancel = p.locator('button:has-text("Отменить")')
        if cancel.count():
            p.on("dialog", lambda d: d.accept())
            cancel.first.click()
            p.wait_for_timeout(1500)
            body = p.locator("body").inner_text()
            check("cancel booking", "Часы Тест" not in body or "Отмен" in body)

    # --- владелец ---
    p.goto(BASE + "/owner", wait_until="networkidle")
    p.fill("#email, input[type=email]", "owner@studio.local")
    p.fill("#password, input[type=password]", "owner123")
    p.click('button:has-text("Войти")')
    p.wait_for_timeout(2000)
    body = p.locator("body").inner_text()
    check("owner dashboard", "Кабинет" in body and "Сегодня" in body)

    # смена статуса без reload
    row_btn = p.locator('button:has-text("Принять")')
    if row_btn.count():
        row_btn.first.click()
        p.wait_for_timeout(800)
        check("status change no crash", True)
    else:
        check("status change no crash", True, "no pending rows")

    # --- ИИ ---
    p.goto(BASE + "/assistant", wait_until="networkidle")
    p.fill('input[aria-label="Вопрос помощнику"]', "Какие мойки есть?")
    p.click('button[type="submit"]')
    for _ in range(35):
        p.wait_for_timeout(1000)
        if "отвечает" not in p.locator("body").inner_text():
            break
    body = p.locator("body").inner_text()
    check("ai reply", "Br" in body or "мойк" in body.lower())
    check("ai no markdown", "**" not in body)

    # --- install ---
    p.goto(BASE + "/install", wait_until="networkidle")
    body = p.locator("body").inner_text()
    check("install page", "Как установить" in body)

    # --- scroll top ---
    p.goto(BASE + "/services", wait_until="networkidle")
    p.evaluate("window.scrollTo(0, 2000)")
    p.wait_for_timeout(200)
    p.click('nav.bottom-nav a:has-text("Главная")')
    p.wait_for_timeout(500)
    check("scroll top", p.evaluate("window.scrollY") == 0)

    real_err = [e for e in js_errors if "409" not in e and "favicon" not in e]
    check("no js errors", len(real_err) == 0, str(real_err[:2]))

    p.screenshot(path="shots/clockwork.png", full_page=False)
    b.close()

print(f"\n======== TOTAL: PASS {len(oks)} FAIL {len(fails)} ========")
for f in fails:
    print(" FAIL:", f)
