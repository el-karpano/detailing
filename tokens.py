from pathlib import Path
import re

css = Path("ref/css/home.css").read_text(encoding="utf-8")
html = Path("ref/html/home.html").read_text(encoding="utf-8")

print("=== THEME TOKENS ===")
for name in [
    "--raised",
    "--stroke",
    "--surface",
    "--overlay",
    "--ink",
    "--secondary",
    "--radius",
    "--line",
    "--s1",
    "--s2",
    "--s3",
    "--s4",
    "--s5",
    "--s6",
    "--s8",
    "--s10",
    "--s12",
    "--touch",
    "--label-size",
    "--small-size",
    "--title-size",
    "--section-size",
    "--motion",
    "--color-accent",
    "--color-on-accent",
]:
    m = re.search(re.escape(name) + r"\s*:\s*([^;}]+)", css)
    if m:
        print(f"{name}: {m.group(1).strip()}")

print("\n=== SERVICE ROW HTML SNIPPET ===")
m = re.search(r'<button class="service-row"[\s\S]{0,800}?</button>', html)
if m:
    print(m.group(0)[:800])

print("\n=== HERO STATS SNIPPET ===")
m = re.search(r'hero-stats[\s\S]{0,1200}?hero-stat[\s\S]{0,600}', html)
if m:
    print(m.group(0)[:1000])

print("\n=== BOOKING SECTION ===")
m = re.search(r'booking-section-title[\s\S]{0,1500}', html)
if m:
    print(m.group(0)[:1200])
