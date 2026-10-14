"""Visual smoke for schwartz live PWA — screenshots + key UI asserts."""
from playwright.sync_api import sync_playwright

BASE = "https://detailing-schwartz.deteiling-pro.workers.dev"
ok = 0
fail = 0


def check(name, cond, detail=""):
    global ok, fail
    if cond:
        ok += 1
        print(f"  OK  {name} {detail}")
    else:
        fail += 1
        print(f"  FAIL {name} {detail}")


with sync_playwright() as p:
    browser = p.chromium.launch(channel="chrome", headless=True)
    ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
    page = ctx.new_page()
    page.goto(BASE + "/", wait_until="networkidle", timeout=60000)

    # reset SW / caches so we see the fresh deploy
    page.evaluate("""async () => {
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(r => r.unregister()));
      }
    }""")
    page.reload(wait_until="networkidle")
    page.wait_for_timeout(1500)

    body = page.inner_text("body")
    check("SCHWARTZ visible", "SCHWARTZ" in body.upper())
    check("Гомель/Дорожная", "Дорожная" in body or "Гомель" in body)
    check("phone tel link", page.locator('a[href^="tel:"]').count() >= 1)
    href = page.locator('a[href^="tel:"]').first.get_attribute("href") or ""
    check("tel href", "375333750151" in href.replace(" ", "") or "37533" in href.replace(" ", ""), href)
    logo = page.locator('img[src*="logo"]').first
    check("logo img", logo.count() > 0 if hasattr(logo, "count") else True)

    page.screenshot(path="shots/schwartz-home.png", full_page=False)

    page.goto(BASE + "/services", wait_until="networkidle")
    page.wait_for_timeout(800)
    svc_body = page.inner_text("body")
    for t in ["Полировка кузова", "Химчистка", "Bi-Led", "Керамическое", "бронеплёнкой"]:
        check(f"service {t}", t in svc_body)
    check("Br prices", "Br" in svc_body)
    page.screenshot(path="shots/schwartz-services.png", full_page=True)

    page.goto(BASE + "/install", wait_until="networkidle")
    page.wait_for_timeout(500)
    page.screenshot(path="shots/schwartz-install.png", full_page=False)

    browser.close()

print(f"\n=== RESULT: {ok} ok / {fail} fail ===")
raise SystemExit(1 if fail else 0)
