"""Smoke: в кабинете владельца телефон клиента виден и кликабелен (tel:)."""
from playwright.sync_api import sync_playwright

BASE = "http://localhost:4173"
PHONE = "+375 29 111-22-33"
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
    check("login", "Кабинет" in p.locator("body").inner_text())

    # создаём запись с известным телефоном
    p.click('button:has-text("Добавить запись")')
    p.wait_for_timeout(400)
    p.fill('input[placeholder="Имя клиента"]', "Телефон Тест")
    p.fill('input[placeholder="Телефон"]', PHONE)
    p.fill('input[placeholder="Автомобиль"]', "TestCar")
    # дата +3 дня — в «Ближайших»
    p.evaluate(
        """() => {
      const d = new Date(); d.setDate(d.getDate() + 3);
      const iso = d.toISOString().slice(0, 10);
      const input = document.querySelector('input[type=date]');
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(input, iso);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }"""
    )
    p.wait_for_timeout(800)
    slots = p.locator('form button:has-text(":")')
    print("  slots", slots.count())
    if slots.count():
        slots.nth(slots.count() - 1).click()
        p.wait_for_timeout(200)
    btn = p.locator('button:has-text("Создать запись")')
    if not btn.is_enabled():
        check("create booking", False, "submit disabled")
    else:
        btn.click()
        p.wait_for_timeout(2500)

    body = p.locator("body").inner_text()
    check("booking visible", "Телефон Тест" in body)

    # tel: именно на номер клиента, а не только на студию
    client_tels = p.locator(f'a[href^="tel:"]:has-text("111")')
    n = client_tels.count()
    check("client tel link", n > 0, f"count={n}")
    if n:
        href = client_tels.first.get_attribute("href") or ""
        text = client_tels.first.inner_text().strip()
        label = client_tels.first.get_attribute("aria-label") or ""
        check("tel href", href.replace("tel:", "").lstrip("+").startswith("375"), href)
        check("phone text", "111" in text, text)
        check("aria call", "Позвонить" in label, label)

    # на странице «Записи и оплаты» тоже
    p.goto(BASE + "/owner/bookings", wait_until="networkidle")
    p.wait_for_timeout(1000)
    p.fill('input[placeholder*="Поиск"]', "111")
    p.wait_for_timeout(500)
    body2 = p.locator("body").inner_text()
    check("search by phone", "Телефон Тест" in body2 or "111" in body2)
    n2 = p.locator('a[href^="tel:"]:has-text("111")').count()
    check("client tel on bookings page", n2 > 0, f"count={n2}")

    check("no page errors", not errors, "; ".join(errors[:3]))
    b.close()

print(f"\n{len(oks)} ok / {len(fails)} fail")
if fails:
    raise SystemExit(1)
