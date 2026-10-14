from playwright.sync_api import sync_playwright
import subprocess, time, os

os.makedirs("shots", exist_ok=True)
proc = subprocess.Popen(
    ["node", "node_modules/vite/bin/vite.js", "preview", "--host", "127.0.0.1", "--port", "4173"],
    stdout=subprocess.DEVNULL,
    stderr=subprocess.DEVNULL,
)
time.sleep(3)
try:
    with sync_playwright() as pw:
        b = pw.chromium.launch(channel="chrome", headless=True)
        p = b.new_page(viewport={"width": 390, "height": 844})
        for name, path in [
            ("home", "/"),
            ("services", "/services"),
            ("booking", "/book/svc-wash"),
            ("account", "/account"),
            ("install", "/install"),
        ]:
            p.goto(f"http://127.0.0.1:4173{path}", wait_until="networkidle")
            p.wait_for_timeout(600)
            p.screenshot(path=f"shots/v2-{name}.png", full_page=True)
            print(name, "ok", len(p.locator("body").inner_text()))
        b.close()
finally:
    proc.terminate()
print("done")
