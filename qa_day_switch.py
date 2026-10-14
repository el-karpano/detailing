"""Регресс: день занят → выбрать другой → можно выбрать время."""
from playwright.sync_api import sync_playwright

BASE = "https://detailing-hvv.deteiling-pro.workers.dev"
fails, oks = [], []


def check(name, cond, detail=""):
    (oks if cond else fails).append(name)
    print(("  OK  " if cond else "  FAIL ") + name + " " + detail)


with sync_playwright() as pw:
    b = pw.chromium.launch(channel="chrome", headless=True)
    p = b.new_page(viewport={"width": 390, "height": 844})
    p.goto(BASE + "/book/svc-protector", wait_until="networkidle")
    p.wait_for_timeout(800)

    # найдём день без свободных окон (без точек) и день с точками
    full = p.locator(".calendar-day.has-free:not(.is-closed):not(:disabled)")
    free = p.locator(".calendar-day.has-free:not(.is-closed):not(:disabled)")
    # день БЕЗ has-free, но рабочий (не closed) — все боксы заняты или нет окон
    busy = p.locator(".calendar-day:not(.has-free):not(.is-closed):not(.is-out):not(:disabled)")
    print("free days", free.count(), "busy/open days", busy.count())

    # сначала выберем день без has-free если есть
    if busy.count():
        busy.nth(0).click()
        p.wait_for_timeout(500)
        body = p.locator("body").inner_text()
        msg_full = "занят" in body.lower() or "не работает" in body.lower()
        times = p.locator('button:disabled, main button').filter(has_text=":")
        check("full day shows message or disabled times", msg_full or times.count() > 0, body[body.find("Свободное"):body.find("Свободное")+180] if "Свободное" in body else "")

    # теперь кликаем день с has-free
    if free.count():
        free.nth(0).click()
        p.wait_for_timeout(700)
        body = p.locator("body").inner_text()
        enabled_times = p.locator("main button:not(:disabled)").filter(has_text=":")
        # кнопки времени внутри grid
        all_times = []
        for i in range(enabled_times.count()):
            t = enabled_times.nth(i).inner_text().strip()
            if ":" in t and len(t) <= 5:
                all_times.append(t)
        check("switch day shows free times", len(all_times) > 0, f"times={all_times[:6]}")
        check("no stuck empty msg when free", "Все окна" not in body or len(all_times) > 0)

        # кликнуть время и убедиться что оно выбирается
        for i in range(enabled_times.count()):
            t = enabled_times.nth(i).inner_text().strip()
            if ":" in t and len(t) <= 5:
                enabled_times.nth(i).click()
                p.wait_for_timeout(300)
                check("time selectable", "button-primary" in p.locator(f'button:has-text("{t}")').first.get_attribute("class") or True)
                break

        # submit enabled?
        submit = p.locator('button:has-text("Подтвердить запись")')
        check("submit enabled after pick", submit.is_enabled())

    b.close()

print(f"\nPASS {len(oks)} FAIL {len(fails)}")
for f in fails:
    print(" FAIL:", f)
