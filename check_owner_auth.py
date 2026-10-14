"""Live smoke: вход по паролю из D1 + защита API."""
import os

from playwright.sync_api import sync_playwright

BASE = "https://detailing-hvv.deteiling-pro.workers.dev"
EMAIL = "owner@hvv.by"
PASSWORD = os.environ.get("HVV_OWNER_PASSWORD", "")
fails, oks = [], []


def check(name, cond, detail=""):
    (oks if cond else fails).append(name)
    print(("  OK  " if cond else "  FAIL ") + name + " " + str(detail)[:120])


# --- API checks via playwright request (same network) ---
with sync_playwright() as pw:
    api = pw.request.new_context(base_url=BASE)

    r = api.post("/api/auth/login", data={"email": EMAIL, "password": "wrong-pass"})
    check("bad password rejected", r.status == 401, r.status)

    r = api.post("/api/auth/login", data={"email": "nobody@x.by", "password": "nope"})
    check("unknown email rejected", r.status == 401, r.status)

    r = api.post("/api/auth/login", data={"email": EMAIL, "password": PASSWORD})
    check("good password accepted", r.status == 200, r.status)
    token = ""
    if r.status == 200:
        body = r.json()
        token = body.get("token") or ""
        check("token issued", len(token) > 20, len(token))
        check("studioId", body.get("studioId") == "studio-hvv", body.get("studioId"))

    # media upload without token → 401
    r = api.post("/api/media", data=b"\x89PNG", headers={"Content-Type": "image/png"})
    check("media upload without token", r.status == 401, r.status)

    # studio PUT without token → 401
    r = api.put("/api/studio", data={"studio": {"id": "studio-hvv"}}, headers={"Content-Type": "application/json"})
    check("studio put without token", r.status == 401, r.status)

    # with token → media upload OK
    if token:
        r = api.post(
            "/api/media",
            data=bytes.fromhex(
                "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c6300010000050001"
            ),
            headers={"Content-Type": "image/png", "Authorization": f"Bearer {token}"},
        )
        check("media upload with token", r.status == 200, r.status)

        r = api.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        check("me endpoint", r.status == 200 and r.json().get("email") == EMAIL, r.status)

        r = api.post("/api/auth/logout", headers={"Authorization": f"Bearer {token}"})
        check("logout", r.status == 200, r.status)

        r = api.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        check("token dead after logout", r.status == 401, r.status)

    api.dispose()

    # --- UI login ---
    b = pw.chromium.launch(channel="chrome", headless=True)
    p = b.new_page(viewport={"width": 390, "height": 844})
    p.goto(BASE + "/owner", wait_until="networkidle")
    p.fill("#email", EMAIL)
    p.fill("#password", "wrong")
    p.click('button:has-text("Войти")')
    p.wait_for_timeout(1500)
    check("ui bad password", "Неверная" in p.locator("body").inner_text())

    p.fill("#password", PASSWORD)
    p.click('button:has-text("Войти")')
    p.wait_for_timeout(2000)
    body = p.locator("body").inner_text()
    check("ui login ok", "Кабинет" in body)
    check("no demo hint", "owner@studio.local" not in body)

    p.goto(BASE + "/owner/settings", wait_until="networkidle")
    p.wait_for_timeout(1000)
    check("settings after login", "Настройки студии" in p.locator("body").inner_text())
    b.close()

print(f"\n{len(oks)} ok / {len(fails)} fail")
if fails:
    raise SystemExit(1)
