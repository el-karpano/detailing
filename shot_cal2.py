from playwright.sync_api import sync_playwright

base = "https://detailing-hvv.deteiling-pro.workers.dev"

with sync_playwright() as pw:
    b = pw.chromium.launch(channel="chrome", headless=True)
    p = b.new_page(viewport={"width": 390, "height": 844})
    p.goto(base + "/book/svc-protector", wait_until="networkidle")
    p.wait_for_timeout(500)
    p.screenshot(path="shots/hvv-calendar.png", full_page=True)
    # dump first row of day numbers to verify layout
    days = p.locator(".calendar-day").all_inner_texts()
    print("cells", len(days))
    print("texts", [t.strip().replace("\n", ".") for t in days[:14]])
    b.close()
print("done")
