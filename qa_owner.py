"""QA кабинета владельца."""
from playwright.sync_api import sync_playwright

BASE = "https://detailing-hvv.deteiling-pro.workers.dev"
fails, oks = [], []


def check(name, cond, detail=""):
    (oks if cond else fails).append(name)
    print(("  OK  " if cond else "  FAIL ") + name + " " + detail)


with sync_playwright() as pw:
    b = pw.chromium.launch(channel="chrome", headless=True)
    p = b.new_page(viewport={"width": 390, "height": 844})
    errors = []
    p.on("pageerror", lambda e: errors.append(str(e)))

    p.goto(BASE + "/owner", wait_until="networkidle")
    p.fill("#email, input[type=email]", "owner@studio.local")
    p.fill("#password, input[type=password]", "owner123")
    p.click('button:has-text("Войти")')
    p.wait_for_timeout(1500)
    body = p.locator("body").inner_text()
    check("login", "Кабинет" in body)
    check("today section", "Сегодня" in body)
    check("stats", "Получено" in body and "Новые" in body)
    check("add button", "Добавить запись" in body)

    # open add form
    p.click('button:has-text("Добавить запись")')
    p.wait_for_timeout(400)
    check("add form", p.locator('input[placeholder="Имя клиента"]').count() == 1)
    check("service select", p.locator("select").count() >= 1)
    check("time slots in form", p.locator('button:has-text(":")').count() > 0)

    # fill and submit (дата в будущем — меньше конфликтов от прошлых прогонов)
    p.fill('input[placeholder="Имя клиента"]', "Кабинет Тест")
    p.fill('input[placeholder="Телефон"]', "+375 29 222-33-44")
    p.fill('input[placeholder="Автомобиль"]', "Audi Q5")
    p.fill('input[type="date"]', "2026-10-26")
    p.wait_for_timeout(600)
    slots = p.locator('form button:has-text(":")')
    print("  slots", slots.count())
    if slots.count():
        slots.nth(slots.count() - 1).click()
        p.wait_for_timeout(200)
    btn = p.locator('button:has-text("Создать запись")')
    if btn.is_enabled():
        btn.click()
        p.wait_for_timeout(2500)
        body = p.locator("body").inner_text()
        created = "Кабинет Тест" in body
        conflict = "занят" in body.lower()
        check("booking created or conflict", created or conflict, f"created={created} conflict={conflict}")
        check("status actions", (created and ("Принять" in body or "Завершить" in body or "Принята" in body or "Новая" in body)) or conflict)
    else:
        check("booking created or conflict", False, "no free slots / disabled")

    # go to all bookings
    p.goto(BASE + "/owner/bookings", wait_until="networkidle")
    p.wait_for_timeout(1000)
    body = p.locator("body").inner_text()
    check("bookings page", "Записи и оплаты" in body)
    check("filters", "Предстоящие" in body and "Сегодня" in body and "Все" in body)
    check("search input", p.locator('input[placeholder*="Поиск"]').count() == 1)

    p.click('button:has-text("Все")')
    p.wait_for_timeout(400)
    p.fill('input[placeholder*="Поиск"]', "Кабинет")
    p.wait_for_timeout(400)
    body = p.locator("body").inner_text()
    check("search works", "Кабинет Тест" in body or "Ничего не найдено" in body)

    p.screenshot(path="shots/owner-cabinet.png", full_page=True)
    check("no js errors", len(errors) == 0, str(errors[:2]))
    b.close()

print(f"\nPASS {len(oks)} FAIL {len(fails)}")
for f in fails:
    print(" FAIL:", f)
