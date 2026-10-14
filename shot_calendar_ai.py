from playwright.sync_api import sync_playwright

base = "https://detailing-hvv.deteiling-pro.workers.dev"

with sync_playwright() as pw:
    b = pw.chromium.launch(channel="chrome", headless=True)
    p = b.new_page(viewport={"width": 390, "height": 844})

    # 1) Calendar on booking page
    p.goto(base + "/book/svc-protector", wait_until="networkidle")
    p.wait_for_timeout(600)
    p.screenshot(path="shots/hvv-calendar.png", full_page=True)
    print("calendar days", p.locator(".calendar-day").count())
    print("selected", p.locator(".calendar-day.is-selected").count())

    # 2) AI chat → booking CTA
    p.goto(base + "/assistant", wait_until="networkidle")
    p.fill('input[aria-label="Вопрос помощнику"]', "Мне нужна протектор-мойка, запишите на ближайшее окно")
    p.click('button[type="submit"]')
    # wait until bot stops typing (max 35s)
    for i in range(35):
        p.wait_for_timeout(1000)
        if "печатает" not in p.locator("body").inner_text():
            break
    body = p.locator("body").inner_text()
    print("has CTA", "Записаться" in body)
    print("tail:", body[-350:].replace("\n", " | "))
    p.screenshot(path="shots/hvv-ai-book.png", full_page=True)

    # click CTA if present
    btns = p.locator('button:has-text("Записаться")')
    if btns.count() > 0:
        btns.first.click()
        p.wait_for_timeout(800)
        print("url", p.url)
        p.screenshot(path="shots/hvv-book-prefilled.png", full_page=True)
    else:
        print("no CTA button")
    b.close()
print("done")
