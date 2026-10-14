"""Probe 2GIS domain/URL variants for regional Belarus cities."""
import json
import subprocess
import sys

EXE = r"C:\Users\mrkar\AppData\Roaming\Python\Python314\Scripts\parser-2gis-new.exe"

candidates = [
    "https://2gis.ru/gomel/search/детейлинг",
    "https://2gis.by/gomel/search/детейлинг/tab/firms",
    "https://2gis.by/minsk/search/детейлинг/tab/firms",
    "https://2gis.by/search/детейлинг",
    "https://2gis.by/catalog/110301",
    "https://2gis.by/gomel/firm/70000001079855091",
]

for url in candidates:
    out = "leads/raw-probe.json"
    print("\n===", url)
    subprocess.run(
        [EXE, "-i", url, "-o", out, "-f", "json",
         "--chrome.headless", "yes",
         "--chrome.disable-images", "yes",
         "--parser.max-records", "5",
         "--writer.verbose", "no"],
        check=False,
    )
    try:
        with open(out, encoding="utf-8-sig") as f:
            data = json.load(f)
        print("n=", len(data))
        for r in data[:3]:
            print(" ", (r.get("org") or {}).get("primary"), "|", r.get("address_name"))
    except Exception as e:
        print("read err", e)
