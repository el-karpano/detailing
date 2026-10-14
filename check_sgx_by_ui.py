"""Playwright live UI: sgx BY localization (Br / Минск / +375) после ship."""
from playwright.sync_api import sync_playwright

BASE = "https://detailing-main.deteiling-pro.workers.dev"
fails, oks = [], []


def check(name, cond, detail=""):
    (oks if cond else fails).append(name)
    print(("  OK  " if cond else "  FAIL ") + name + " " + detail)


with sync_playwright() as pw:
    b = pw.chromium.launch(channel="chrome", headless=True)
    p = b.new_page(viewport={"width": 390, "height": 844})
    p.goto(BASE + "/", wait_until="networkidle")
    # сброс SW/кэша — иначе Playwright видит старый бандл
    p.evaluate(
        """async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }"""
    )
    p.reload(wait_until="networkidle")
    p.wait_for_timeout(800)

    body = p.locator("body").inner_text()
    check("home has Br", "Br" in body, "currency")
    check("home has Минск", "Минск" in body, "address")
    prices = p.locator(".service-row-price").all_inner_texts()
    check(
        "service prices in Br",
        all("Br" in t for t in prices) and any("45" in t for t in prices),
        str(prices),
    )
    tel = p.locator('a[href^="tel:"]').first.get_attribute("href") or ""
    check("home tel +375", tel.startswith("tel:+375"), tel)
    check("no old MSK", "Москва" not in body)
    check("no RU +7 studio phone", "+7 (999)" not in body)

    p.screenshot(path="shots/by-home.png", full_page=True)

    p.goto(BASE + "/services", wait_until="networkidle")
    p.wait_for_timeout(500)
    sbody = p.locator("body").inner_text()
    check("services has Br prices", "Br" in sbody and ("от 250" in sbody or "250" in sbody), sbody[sbody.find("Химчистка"):sbody.find("Химчистка")+80] if "Химчистка" in sbody else "")
    check("services no MSK", "Москва" not in sbody)
    p.screenshot(path="shots/by-services.png", full_page=True)

    p.goto(BASE + "/book/svc-wash", wait_until="networkidle")
    p.wait_for_timeout(600)
    bbody = p.locator("body").inner_text()
    check("booking page loads", "Комплексная" in bbody or "запис" in bbody.lower())
    # edge: календарь отрисован
    days = p.locator(".calendar-day")
    check("calendar days present", days.count() > 10, f"days={days.count()}")
    p.screenshot(path="shots/by-book.png", full_page=True)

    b.close()

print(f"\n=== {len(oks)} OK / {len(fails)} FAIL ===")
raise SystemExit(1 if fails else 0)
