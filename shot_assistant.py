from playwright.sync_api import sync_playwright

base = "https://detailing-hvv.deteiling-pro.workers.dev"

with sync_playwright() as pw:
    b = pw.chromium.launch(channel="chrome", headless=True)
    p = b.new_page(viewport={"width": 390, "height": 844})
    p.goto(base + "/assistant", wait_until="networkidle")
    p.wait_for_timeout(500)
    p.screenshot(path="shots/hvv-assistant.png", full_page=True)
    # send a message
    p.fill('input[aria-label="Вопрос помощнику"]', "Мне нужна мойка кузова")
    p.click('button[type="submit"]')
    p.wait_for_timeout(8000)
    text = p.locator("body").inner_text()
    print("has reply markers:", "Br" in text or "мойк" in text.lower())
    print(text[:600])
    p.screenshot(path="shots/hvv-assistant-chat.png", full_page=True)
    b.close()
print("done")
