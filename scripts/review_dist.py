"""Distribution of flow signals in raw 2GIS dumps."""
import glob
import json

rows = []
for p in glob.glob("leads/raw-*.json"):
    with open(p, encoding="utf-8-sig") as f:
        data = json.load(f)
    if isinstance(data, list):
        rows.extend(data)

seen = set()
uniq = []
for r in rows:
    name = ((r.get("org") or {}).get("primary") or r.get("name") or "").strip().lower()
    if name in seen:
        continue
    seen.add(name)
    uniq.append(r)

print("unique:", len(uniq))
pairs = []
for r in uniq:
    rev = r.get("reviews") or {}
    n = int(rev.get("general_review_count") or rev.get("org_review_count") or 0)
    rating = float(rev.get("general_rating") or 0)
    promoted = bool(r.get("is_promoted") or r.get("has_ads_model"))
    name = ((r.get("org") or {}).get("primary") or r.get("name") or "").strip()
    pairs.append((n, rating, promoted, name))

pairs.sort(reverse=True)
print("\nreviews | rating | promoted | name")
for n, rating, promoted, name in pairs[:40]:
    print(f"{n:5} | {rating:4} | {str(promoted):5} | {name}")

buckets = {
    "0": 0,
    "1-4": 0,
    "5-9": 0,
    "10-19": 0,
    "20-49": 0,
    "50+": 0,
}
for n, *_ in pairs:
    if n == 0:
        buckets["0"] += 1
    elif n < 5:
        buckets["1-4"] += 1
    elif n < 10:
        buckets["5-9"] += 1
    elif n < 20:
        buckets["10-19"] += 1
    elif n < 50:
        buckets["20-49"] += 1
    else:
        buckets["50+"] += 1
print("\nbuckets:", buckets)
