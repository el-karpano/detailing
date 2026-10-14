from playwright.sync_api import sync_playwright
import os, json, re

base = "https://studio-booking-theta.vercel.app"
root = "ref"
os.makedirs(f"{root}/html", exist_ok=True)
os.makedirs(f"{root}/css", exist_ok=True)
os.makedirs(f"{root}/js", exist_ok=True)

pages = {
    "home": "/s/graphite/",
    "services": "/s/graphite/services",
    "booking": "/s/graphite/booking",
    "account": "/s/graphite/account/",
    "install": "/s/graphite/install",
}

with sync_playwright() as pw:
    b = pw.chromium.launch(channel="chrome", headless=True)
    ctx = b.new_context(viewport={"width": 390, "height": 844}, locale="ru-RU")
    p = ctx.new_page()

    for name, path in pages.items():
        p.goto(base + path, wait_until="networkidle", timeout=60000)
        p.wait_for_timeout(1500)
        html = p.content()
        open(f"{root}/html/{name}.html", "w", encoding="utf-8").write(html)
        # computed styles of body and key elements
        styles = p.evaluate("""() => {
          const pick = (el) => {
            if (!el) return null;
            const s = getComputedStyle(el);
            return {
              tag: el.tagName,
              cls: el.className && el.className.toString().slice(0, 120),
              font: s.fontFamily,
              size: s.fontSize,
              weight: s.fontWeight,
              lh: s.lineHeight,
              color: s.color,
              bg: s.backgroundColor,
              radius: s.borderRadius,
              padding: s.padding,
              margin: s.margin,
              gap: s.gap,
              border: s.border,
              display: s.display,
            };
          };
          const out = {body: pick(document.body)};
          out.h1 = pick(document.querySelector('h1'));
          out.h2 = pick(document.querySelector('h2'));
          out.nav = pick(document.querySelector('nav'));
          out.main = pick(document.querySelector('main'));
          out.buttons = [...document.querySelectorAll('button, a.btn, [class*=btn]')].slice(0, 8).map(pick);
          out.cards = [...document.querySelectorAll('[class*=card], article, section > div')].slice(0, 8).map(pick);
          out.imgs = [...document.images].map(i => ({src: i.currentSrc, w: i.naturalWidth, h: i.naturalHeight, alt: i.alt}));
          out.links = [...document.querySelectorAll('a')].map(a => ({href: a.getAttribute('href'), text: a.innerText.trim().slice(0,40)}));
          return out;
        }""")
        open(f"{root}/html/{name}.styles.json", "w", encoding="utf-8").write(
            json.dumps(styles, ensure_ascii=False, indent=2)
        )
        # full stylesheet text from cssom
        css_text = p.evaluate("""() => {
          let s = '';
          for (const sheet of document.styleSheets) {
            try {
              for (const rule of sheet.cssRules) s += rule.cssText + '\\n';
            } catch(e) {}
          }
          return s;
        }""")
        open(f"{root}/css/{name}.css", "w", encoding="utf-8").write(css_text)
        p.screenshot(path=f"{root}/{name}.png", full_page=True)
        print(name, "html", len(html), "css", len(css_text))

    # try booking flow elements
    p.goto(base + "/s/graphite/services", wait_until="networkidle")
    p.wait_for_timeout(800)
    # click first service choose
    btns = p.locator("text=Выбрать")
    print("choose buttons", btns.count())
    if btns.count():
        btns.first.click()
        p.wait_for_timeout(1500)
        print("after choose url", p.url)
        print(p.locator("body").inner_text()[:1200])
        p.screenshot(path=f"{root}/book-flow.png", full_page=True)
        open(f"{root}/html/book-flow.html", "w", encoding="utf-8").write(p.content())

    b.close()
print("done")
