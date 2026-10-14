"""Live smoke: после ship — в owner-кабинете hvv есть кликабельный tel:."""
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
    p.wait_for_timeout(2000)
    check("login", "Кабинет" in p.locator("body").inner_text())

    n = p.locator('a[href^="tel:"]').count()
    check("tel links", n >= 1, f"count={n}")

    p.click('button:has-text("Добавить запись")')
    p.wait_for_timeout(400)
    p.fill('input[placeholder="Имя клиента"]', "Smoke Phone")
    p.fill('input[placeholder="Телефон"]', "+375 29 777-88-99")
    p.fill('input[placeholder="Автомобиль"]', "SmokeCar")
    p.evaluate(
        "() => {"
        "const d = new Date(); d.setDate(d.getDate() + 5);"
        "const iso = d.toISOString().slice(0, 10);"
        "const input = document.querySelector('input[type=date]');"
        "const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;"
        "setter.call(input, iso);"
        "input.dispatchEvent(new Event('input', { bubbles: true }));"
        "input.dispatchEvent(new Event('change', { bubbles: true }));"
        "}"
    )
    p.wait_for_timeout(1000)
    slots = p.locator('form button:has-text(":")')
    if slots.count():
        slots.nth(slots.count() - 1).click()
    btn = p.locator('button:has-text("Создать запись")')
    if btn.is_enabled():
        btn.click()
        p.wait_for_timeout(3000)
    body = p.locator("body").inner_text()
    check("booking created", "Smoke Phone" in body)
    link = p.locator('a[aria-label^="Позвонить клиенту"]')
    check("client PhoneLink", link.count() > 0, f"count={link.count()}")
    if link.count():
        href = link.first.get_attribute("href") or ""
        check("tel href", "375297778899" in href.replace(" ", ""), href)

    check("no page errors", not errors, "; ".join(errors[:2]))
    b.close()

print(f"\n{len(oks)} ok / {len(fails)} fail")
if fails:
    raise SystemExit(1)
