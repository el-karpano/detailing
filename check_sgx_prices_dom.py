from playwright.sync_api import sync_playwright

BASE = "https://detailing-main.deteiling-pro.workers.dev"
with sync_playwright() as pw:
    b = pw.chromium.launch(channel="chrome", headless=True)
    p = b.new_page(viewport={"width": 390, "height": 844})
    p.goto(BASE + "/", wait_until="networkidle")
    p.evaluate(
        """async () => {
      const keys = await caches.keys(); await Promise.all(keys.map(k => caches.delete(k)));
      const regs = await navigator.serviceWorker.getRegistrations(); await Promise.all(regs.map(r => r.unregister()));
    }"""
    )
    p.reload(wait_until="networkidle")
    p.wait_for_timeout(600)
    prices = p.locator(".service-row-price").all_inner_texts()
    print("prices:", prices)
    tel = p.locator('a[href^="tel:"]').get_attribute("href")
    aria = p.locator('a[href^="tel:"]').get_attribute("aria-label")
    print("tel:", tel)
    print("aria:", aria)
    body = p.locator("body").inner_text()
    print("has 375 in body:", "375" in body)
    print("has Минск:", "Минск" in body, "Калиновского" in body)
    b.close()
