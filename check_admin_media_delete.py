"""Live smoke: загрузка фото в админке + удаление записи (hvv)."""
import base64
from playwright.sync_api import sync_playwright

BASE = "https://detailing-hvv.deteiling-pro.workers.dev"
fails, oks = [], []

# 1x1 PNG
PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
)


def check(name, cond, detail=""):
    (oks if cond else fails).append(name)
    print(("  OK  " if cond else "  FAIL ") + name + " " + detail)


with sync_playwright() as pw:
    b = pw.chromium.launch(channel="chrome", headless=True)
    p = b.new_page(viewport={"width": 390, "height": 844})
    errors = []
    p.on("pageerror", lambda e: errors.append(str(e)))

    # --- login ---
    p.goto(BASE + "/owner", wait_until="networkidle")
    p.fill("#email, input[type=email]", "owner@studio.local")
    p.fill("#password, input[type=password]", "owner123")
    p.click('button:has-text("Войти")')
    p.wait_for_timeout(1500)
    check("login", "Кабинет" in p.locator("body").inner_text())

    # --- settings: upload photo ---
    p.goto(BASE + "/owner/settings", wait_until="networkidle")
    p.wait_for_timeout(800)
    body = p.locator("body").inner_text()
    check("settings open", "Настройки студии" in body)
    check("upload cta", "Добавить фото" in body)

    # file input inside photo section (last hidden file input for photos)
    file_inputs = p.locator('input[type="file"]')
    nfi = file_inputs.count()
    check("file inputs", nfi >= 2, f"count={nfi}")
    # hero=0, logo=1, photos=2
    photo_input = file_inputs.nth(nfi - 1)
    photo_input.set_input_files(
        {"name": "smoke.png", "mimeType": "image/png", "buffer": PNG}
    )
    p.wait_for_timeout(4000)
    body = p.locator("body").inner_text()
    check("upload ok / error shown", ("Загружаем" not in body) or ("ошибк" in body.lower()), body[:200])

    # на сайте есть /api/media/ в img
    srcs = p.eval_on_selector_all("img", "els => els.map(e => e.src)")
    has_api_media = any("/api/media/" in s for s in srcs)
    check("photo in settings preview", has_api_media, str(srcs[-3:]))
    check("no page errors during upload", not errors, "; ".join(errors[:2]))

    # --- delete booking ---
    p.goto(BASE + "/owner/bookings", wait_until="networkidle")
    p.wait_for_timeout(1500)
    body = p.locator("body").inner_text()
    check("bookings page", "Записи" in body)
    del_btns = p.locator('button:has-text("Удалить")')
    check("delete buttons", del_btns.count() > 0, f"count={del_btns.count()}")

    if del_btns.count():
        # создаём запись, потом удаляем именно её — чтобы не трогать чужие
        p.goto(BASE + "/owner/dashboard", wait_until="networkidle")
        p.wait_for_timeout(800)
        p.click('button:has-text("Добавить запись")')
        p.wait_for_timeout(400)
        p.fill('input[placeholder="Имя клиента"]', "Delete Smoke")
        p.fill('input[placeholder="Телефон"]', "+375 29 000-00-01")
        p.fill('input[placeholder="Автомобиль"]', "DelCar")
        p.evaluate(
            "() => {"
            "const d = new Date(); d.setDate(d.getDate() + 7);"
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
            p.wait_for_timeout(2500)

        p.goto(BASE + "/owner/bookings", wait_until="networkidle")
        p.wait_for_timeout(1500)
        p.fill('input[placeholder*="Поиск"]', "Delete Smoke")
        p.wait_for_timeout(600)
        body = p.locator("body").inner_text()
        created = "Delete Smoke" in body
        check("test booking visible", created)

        if created:
            p.once("dialog", lambda d: d.accept())
            row_del = p.locator('button:has-text("Удалить")').first
            row_del.click()
            p.wait_for_timeout(2500)
            body = p.locator("body").inner_text()
            check("booking deleted", "Delete Smoke" not in body)
        else:
            check("booking deleted", False, "could not create test booking")

    b.close()

print(f"\n{len(oks)} ok / {len(fails)} fail")
if fails:
    raise SystemExit(1)
