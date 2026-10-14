import urllib.request
import re

url = "https://studio-booking-theta.vercel.app/assets/index-Z36Sl5rC.js"
req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
with urllib.request.urlopen(req, timeout=30) as r:
    js = r.read().decode("utf-8", "replace")

print("js length", len(js))

# find install guides map - look for ios/android step titles from known desktop text
for needle in [
    "Откройте сайт в Chrome или Edge",
    "Откройте «Поделиться»",
    "На экран Домой",
    "beforeinstallprompt",
    "Установить приложение",
    "Добавить на главный экран",
    "install-step",
    "Скопировать ссылку",
]:
    i = js.find(needle)
    print(f"\n=== {needle!r} idx={i} ===")
    if i >= 0:
        start = max(0, i - 500)
        print(js[start : i + 1500])
