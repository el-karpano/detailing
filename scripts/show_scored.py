import csv

with open("leads/scored.csv", encoding="utf-8-sig") as f:
    rows = list(csv.DictReader(f))

print(f"{'#':>2} {'sc':>2} | {'name':<28} | {'rev':>3} | {'phone':<20} | {'tg/site':<32} | reasons")
print("-" * 120)
for i, r in enumerate(rows, 1):
    tg = r["socials"].split("telegram:")[-1][:30] if "telegram:" in r["socials"] else (r["website"][:30] if r["website"] else "—")
    print(f"{i:2} {r['score']:>2} | {r['name'][:28]:<28} | {r['reviews']:>3} | {r['phone'].split(';')[0][:20]:<20} | {tg:<32} | {r['reasons'][:50]}")
