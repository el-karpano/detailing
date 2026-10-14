"""Отладка: что реально есть в выдаче 2GIS."""
from playwright.sync_api import sync_playwright

with sync_playwright() as pw:
    b = pw.chromium.launch(channel="chrome", headless=True)
    p = b.new_page(viewport={"width": 1280, "height": 900})
    p.goto("https://2gis.by/minsk/search/Детейлинг", wait_until="networkidle", timeout=90000)
    p.wait_for_timeout(4000)
    for _ in range(5):
        p.mouse.wheel(0, 800)
        p.wait_for_timeout(500)

    info = p.evaluate(
        """() => {
      const text = document.body.innerText.slice(0, 4000);
      const links = [...document.querySelectorAll('a')].map(a => ({
        href: a.getAttribute('href') || '',
        text: (a.innerText || '').trim().slice(0, 80)
      })).filter(x => x.text || x.href.includes('firm') || x.href.includes('search')).slice(0, 40);
      const classes = [...new Set([...document.querySelectorAll('*')].map(e => e.className && e.className.toString()).filter(c => c && c.length < 60))].slice(0, 60);
      return {title: document.title, text, links, classes};
    }"""
    )
    print("TITLE:", info["title"])
    print("TEXT:\n", info["text"][:1500])
    print("\nLINKS:")
    for l in info["links"]:
        print(" ", l["href"][:80], "|", l["text"][:50])
    print("\nCLASSES sample:", info["classes"][:25])
    p.screenshot(path="shots/2gis-debug.png", full_page=False)
    b.close()
