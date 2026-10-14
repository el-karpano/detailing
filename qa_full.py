"""
Полный smoke-тест live UI: навигация, запись, ИИ, владелец, scroll-to-top.
"""
from playwright.sync_api import sync_playwright
import re

BASE = "https://detailing-hvv.deteiling-pro.workers.dev"
fails = []
oks = []


def check(name, cond, detail=""):
    if cond:
        oks.append(name)
        print(f"  OK  {name} {detail}")
    else:
        fails.append(f"{name} {detail}")
        print(f"  FAIL {name} {detail}")


with sync_playwright() as pw:
    b = pw.chromium.launch(channel="chrome", headless=True)
    p = b.new_page(viewport={"width": 390, "height": 844})
    errors = []
    p.on("pageerror", lambda e: errors.append(str(e)))
    p.on("console", lambda m: errors.append(f"console.{m.type}: {m.text}") if m.type == "error" else None)

    # --- HOME ---
    print("\n== HOME ==")
    p.goto(BASE + "/", wait_until="networkidle")
    p.wait_for_timeout(500)
    body = p.locator("body").inner_text()
    check("home title ХВВ", "ХВВ" in body)
    check("home services count", "услуг в прайсе" in body)
    check("home CTA install", "Добавить на экран" in body or "Студия всегда" in body)

    # --- SCROLL TO TOP ---
    print("\n== SCROLL ==")
    p.evaluate("window.scrollTo(0, 1500)")
    p.wait_for_timeout(200)
    p.click('nav.bottom-nav a:has-text("Услуги")')
    p.wait_for_timeout(500)
    check("scroll resets on nav", p.evaluate("window.scrollY") == 0, f"y={p.evaluate('window.scrollY')}")

    # --- SERVICES ---
    print("\n== SERVICES ==")
    body = p.locator("body").inner_text()
    check("services page", "Услуги и цены" in body)
    check("has prices Br", "Br" in body)
    check("has service rows", p.locator(".service-row, button").count() > 3)

    # click first service → booking
    rows = p.locator("button.service-row, main button").filter(has_not_text="Главная")
    if rows.count():
        rows.first.click()
        p.wait_for_timeout(600)
    else:
        # try direct
        p.goto(BASE + "/book/svc-protector", wait_until="networkidle")
        p.wait_for_timeout(400)

    # --- BOOKING ---
    print("\n== BOOKING ==")
    body = p.locator("body").inner_text()
    check("booking page", "Запись в студию" in body)
    check("calendar present", p.locator(".calendar-day").count() >= 20, f"days={p.locator('.calendar-day').count()}")
    check("calendar month label", re.search(r"[А-Яа-я]+ \d{4}", body) is not None)

    # select a free day (has-free and not disabled)
    free_days = p.locator(".calendar-day.has-free:not(.is-closed):not(:disabled)")
    check("has free days", free_days.count() > 0, f"n={free_days.count()}")
    if free_days.count():
        free_days.first.click()
        p.wait_for_timeout(400)

    # pick free time
    time_btns = p.locator("main button").filter(has_text=re.compile(r"^\d{2}:\d{2}$"))
    available = [i for i in range(time_btns.count()) if time_btns.nth(i).is_enabled()]
    check("has time slots", len(available) > 0, f"n={len(available)}")
    if available:
        time_btns.nth(available[-1]).click()  # крайний — меньше шанс конфликта от прошлых прогонов
        p.wait_for_timeout(200)

    # fill form
    p.fill("#name", "QA Тест")
    p.fill("#phone", "+375 29 111-22-33")
    p.fill("#car", "BMW X5")
    p.click('button:has-text("Подтвердить запись")')
    p.wait_for_timeout(2500)
    url = p.url
    body = p.locator("body").inner_text()
    booked = "/my" in url
    conflict = "занят" in body.lower() or "Выберите другой" in body
    check("booking flow ends correctly", booked or conflict, f"url={url} conflict={conflict}")
    if booked:
        check("my bookings shows QA", "QA Тест" in body)
        check("reminder note", "Напоминание" in body)
    else:
        check("conflict error visible", conflict)

    # server has the booking?
    # (checked separately in API test)

    # --- OWNER ---
    print("\n== OWNER ==")
    p.goto(BASE + "/owner", wait_until="networkidle")
    p.wait_for_timeout(400)
    p.fill("#email, input[type=email]", "owner@studio.local")
    p.fill("#password, input[type=password]", "owner123")
    p.click('button:has-text("Войти")')
    p.wait_for_timeout(800)
    body = p.locator("body").inner_text()
    check("owner login", "Кабинет" in body or "Записи" in body or "Получено" in body or "dashboard" in p.url, p.url)
    check("owner sees booking or stats", "QA" in body or "Протектор" in body or "получено" in body.lower() or "Br" in body)

    # --- AI ---
    print("\n== AI ==")
    p.goto(BASE + "/assistant", wait_until="networkidle")
    p.wait_for_timeout(300)
    p.fill('input[aria-label="Вопрос помощнику"]', "Сколько стоит полировка?")
    p.click('button[type="submit"]')
    for _ in range(35):
        p.wait_for_timeout(1000)
        if "отвечает" not in p.locator("body").inner_text():
            break
    body = p.locator("body").inner_text()
    check("ai replied", "Br" in body or "полиров" in body.lower())
    check("no raw markdown", "**" not in body)
    check("ai CTA or services link", "Записаться" in body or "Перейти к записи" in body)

    # --- INSTALL ---
    print("\n== INSTALL ==")
    p.goto(BASE + "/install", wait_until="networkidle")
    p.wait_for_timeout(400)
    body = p.locator("body").inner_text()
    check("install page", "главный экран" in body.lower() or "Установить" in body or "Как установить" in body)
    check("install tabs", "iPhone" in body and "Android" in body)

    # --- images ---
    print("\n== IMAGES ==")
    p.goto(BASE + "/", wait_until="networkidle")
    p.wait_for_timeout(400)
    p.evaluate("window.scrollTo(0, document.body.scrollHeight)")
    p.wait_for_timeout(1200)
    broken = p.locator("img").evaluate_all(
        "els => els.filter(e => !e.complete || e.naturalWidth === 0).map(e => e.src)"
    )
    check("no broken images (after scroll)", len(broken) == 0, str(broken[:5]))

    # --- CONSOLE ---
    print("\n== CONSOLE ==")
    # 409 от /api/bookings — ожидаемо при тесте конфликтов
    real_errors = [
        e for e in errors
        if "favicon" not in e.lower()
        and "404" not in e
        and "409" not in e  # конфликт слота — ожидаемое поведение API
    ]
    check("no page JS errors", len(real_errors) == 0, str(real_errors[:3]))

    p.screenshot(path="shots/qa-home.png", full_page=False)
    b.close()

print("\n======== SUMMARY ========")
print(f"PASS {len(oks)}  FAIL {len(fails)}")
for f in fails:
    print("  FAIL:", f)
