"""Why so few? Funnel + rejected leads diagnosis."""
import glob
import json
import re
import sys
sys.path.insert(0, ".")
from score_leads import score_rec, load_raw, city_of, contacts_of, rubrics_of

raw = load_raw()
print("raw rows:", len(raw))

seen = set()
uniq = []
for rec in raw:
    name = ((rec.get("org") or {}).get("primary") or rec.get("name") or "").strip()
    key = name.lower()
    if not key or key in seen:
        continue
    seen.add(key)
    uniq.append(rec)
print("unique:", len(uniq))

passed = []
rejected = []
for rec in uniq:
    s = score_rec(rec)
    if s is None:
        # why?
        name = ((rec.get("org") or {}).get("primary") or rec.get("name") or "").strip()
        city = city_of(rec)
        rub = rubrics_of(rec)
        c = contacts_of(rec)
        rejected.append((name, city, rub, len(c["phones"]), "filtered_out(score_rec=None)"))
    else:
        passed.append(s)

print(f"\nscore_rec returned row: {len(passed)}")
print(f"score_rec filtered out: {len(rejected)}")

# of passed, how many score>=6
work = [p for p in passed if p["score"] >= 6]
low = [p for p in passed if p["score"] < 6]
print(f"  score>=6: {len(work)}")
print(f"  score<6: {len(low)}")

print("\n--- REJECTED (score_rec=None) ---")
for r in rejected[:30]:
    print(f"  {r[0][:28]:<28} | {r[1][:12]:<12} | phones={r[3]} | {r[2][:40]}")

print("\n--- LOW SCORE (<6) ---")
for p in sorted(low, key=lambda x: -x["score"]):
    print(f"  {p['score']:>2} | {p['name'][:28]:<28} | rev={p['reviews']:>2} | {p['reasons'][:55]}")
