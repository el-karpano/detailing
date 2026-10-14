from playwright.sync_api import sync_playwright
import urllib.request

base = "https://detailing-hvv.deteiling-pro.workers.dev"

with sync_playwright() as pw:
    b = pw.chromium.launch(channel="chrome", headless=True)
    p = b.new_page(viewport={"width": 390, "height": 844})
    for name, path in [("home", "/"), ("services", "/services"), ("install", "/install")]:
        p.goto(base + path, wait_until="networkidle")
        p.wait_for_timeout(800)
        p.screenshot(path=f"shots/hvv-{name}.png", full_page=True)
        text = p.locator("body").inner_text()
        print(name, "ok", "Br" in text or "ХВВ" in text, "len", len(text))
    b.close()
print("done")
