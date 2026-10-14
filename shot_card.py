from playwright.sync_api import sync_playwright

base = "https://detailing-hvv.deteiling-pro.workers.dev"

with sync_playwright() as pw:
    b = pw.chromium.launch(channel="chrome", headless=True)
    p = b.new_page(viewport={"width": 390, "height": 844})
    p.goto(base + "/book/svc-protector", wait_until="networkidle")
    p.wait_for_timeout(600)
    # viewport-only screenshot (no full_page → no sticky header artifact)
    p.screenshot(path="shots/hvv-book-card.png", full_page=False)
    # also crop just the card
    card = p.locator(".booking-card")
    card.screenshot(path="shots/hvv-book-card-only.png")
    print("box", card.bounding_box())
    b.close()
print("done")
