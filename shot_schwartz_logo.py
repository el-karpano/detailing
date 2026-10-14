"""Quick visual: schwartz home with new logo."""
from playwright.sync_api import sync_playwright

BASE = "https://detailing-schwartz.deteiling-pro.workers.dev"

with sync_playwright() as p:
    browser = p.chromium.launch(channel="chrome", headless=True)
    ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
    page = ctx.new_page()
    page.goto(BASE + "/", wait_until="networkidle", timeout=60000)
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
    page.wait_for_timeout(1200)
    page.screenshot(path="shots/schwartz-home-logo.png", full_page=False)
    # crop topbar area too
    page.screenshot(path="shots/schwartz-topbar-logo.png", clip={"x": 0, "y": 0, "width": 390, "height": 120})
    browser.close()
print("screenshots saved")
