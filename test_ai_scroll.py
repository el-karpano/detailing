from playwright.sync_api import sync_playwright
import json
import urllib.request

# 1) API: date-aware + ACTION
base = "https://detailing-hvv.deteiling-pro.workers.dev"
body = {
    "messages": [{"role": "user", "content": "Когда ближайшее окно для мойки?"}],
    "studio": {
        "name": "ХВВ Детейлинг",
        "currency": "Br",
        "services": [
            {"id": "svc-wash2", "title": "Двухфазная мойка", "price": 20, "durationMin": 40, "active": True, "description": "база"},
            {"id": "svc-quartz", "title": "Кварцевая мойка", "price": 60, "durationMin": 75, "active": True, "description": "гидрофоб"},
        ],
    },
    "freeSlots": [{"date": "2026-10-06", "times": ["10:00", "11:00"]}, {"date": "2026-10-07", "times": ["09:00"]}],
}
req = urllib.request.Request(
    base + "/api/chat",
    data=json.dumps(body).encode(),
    headers={"Content-Type": "application/json", "User-Agent": "Mozilla/5.0"},
    method="POST",
)
with urllib.request.urlopen(req, timeout=60) as r:
    d = json.loads(r.read().decode())
    print("API action:", d.get("action"))
    print("API reply:", d.get("reply", "")[:220])

# 2) UI: scroll resets to top on navigation
with sync_playwright() as pw:
    b = pw.chromium.launch(channel="chrome", headless=True)
    p = b.new_page(viewport={"width": 390, "height": 844})
    p.goto(base + "/", wait_until="networkidle")
    p.evaluate("window.scrollTo(0, 1200)")
    p.wait_for_timeout(300)
    print("scrolled y", p.evaluate("window.scrollY"))
    # go to services via bottom nav
    p.click('nav.bottom-nav a:has-text("Услуги")')
    p.wait_for_timeout(600)
    y = p.evaluate("window.scrollY")
    print("after nav scrollY", y, "OK" if y == 0 else "FAIL")

    # AI chat
    p.goto(base + "/assistant", wait_until="networkidle")
    p.fill('input[aria-label="Вопрос помощнику"]', "Нужна мойка кузова, что есть?")
    p.click('button[type="submit"]')
    for i in range(30):
        p.wait_for_timeout(1000)
        if "отвечает" not in p.locator("body").inner_text():
            break
    text = p.locator("body").inner_text()
    print("has CTA", "Записаться" in text)
    print("no markdown **", "**" not in text)
    print("tail:", text[-280:].replace("\n", " | "))
    p.screenshot(path="shots/hvv-ai-v2.png", full_page=False)
    b.close()
print("done")
