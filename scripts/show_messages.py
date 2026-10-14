import csv

with open("leads/outreach-minsk-icp.csv", encoding="utf-8-sig") as f:
    rows = list(csv.DictReader(f))

for i, r in enumerate(rows, 1):
    print(f"--- {i}. {r['name']} ({r['service_hint']}) score={r['score']}")
    print(f"    TG: {r['telegram'] or '—'}")
    print(f"    IG: {r['instagram'] or '—'}")
    print(f"    тел: {r['phone']}")
    print(f"    msg: {r['message']}")
    print()
