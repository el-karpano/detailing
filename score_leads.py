"""
Скоринг сырых выгрузок parser-2gis под ICP (leads/ICP.md).

Вход:  leads/raw-*.json (формат parser-2gis-new -f json)
Выход: leads/scored.csv, leads/scored.md  (только прошедшие ICP, по убыванию score)

Использование:
  python score_leads.py
"""
import csv
import glob
import json
import os
import re

OUT_DIR = "leads"

FOCUS_CITIES = {
    "минск", "гомель", "могилёв", "могилев", "витебск",
    "брест", "гродно", "бобруйск", "барановичи",
}

NICHE_OK = ("детейлинг", "полиров", "оклейк", "химчист", "тониров", "плёнк", "пленк", "антигравий", "detail")
NICHE_BAD = ("стоматолог", "мебель", "недвиж", "шиномонтаж.*шиномонтаж")

YCLIENTS_RE = re.compile(r"yclients|zapisi\.ru|zapis\.ru|1c-?zapis", re.I)

CONTACT_TYPES_WANTED = ("phone", "whatsapp", "telegram", "viber", "instagram", "vk_contact")


def load_raw() -> list[dict]:
    rows: list[dict] = []
    for path in sorted(glob.glob(os.path.join(OUT_DIR, "raw-*.json"))):
        try:
            with open(path, encoding="utf-8-sig") as f:
                data = json.load(f)
        except Exception as e:
            print("skip", path, e)
            continue
        if isinstance(data, list):
            rows.extend(data)
        print(f"  {os.path.basename(path)}: {len(data) if isinstance(data, list) else '?'}")
    return rows


def city_of(rec: dict) -> str:
    for a in rec.get("adm_div") or []:
        if a.get("type") == "city":
            return (a.get("name") or "").strip()
    return ""


def contacts_of(rec: dict) -> dict:
    out = {"phones": [], "websites": [], "socials": [], "emails": []}
    for group in rec.get("contact_groups") or []:
        for c in group.get("contacts") or []:
            t = c.get("type") or ""
            val = c.get("value") or c.get("url") or c.get("text") or ""
            if t == "phone":
                out["phones"].append(c.get("value") or c.get("text") or "")
            elif t == "website":
                out["websites"].append(val)
            elif t == "email":
                out["emails"].append(val)
            elif t in ("whatsapp", "telegram", "viber", "instagram", "vk_contact", "facebook", "youtube"):
                out["socials"].append(f"{t}:{val}")
    return out


def rubrics_of(rec: dict) -> str:
    return "; ".join(r.get("name") or "" for r in (rec.get("rubrics") or []))


def score_rec(rec: dict) -> dict | None:
    name = ((rec.get("org") or {}).get("primary") or rec.get("name") or "").strip()
    city = city_of(rec)
    reviews = rec.get("reviews") or {}
    rating = float(reviews.get("general_rating") or 0)
    rev_count = int(reviews.get("general_review_count") or reviews.get("org_review_count") or 0)
    contacts = contacts_of(rec)
    rubrics = rubrics_of(rec)
    branch_count = int((rec.get("org") or {}).get("branch_count") or 1)
    websites = contacts["websites"]
    all_links = " ".join(websites) + " " + json.dumps(rec.get("links") or {}, ensure_ascii=False)

    rubrics_l = rubrics.lower()
    name_l = name.lower()

    # Только явный мусор. Мойка/шиномонтаж/СТО не режут, если есть детейлинг-услуги.
    if any(b in rubrics_l or b in name_l for b in ("стоматолог", "мебель", "недвиж")):
        return None
    has_niche = any(n in rubrics_l or n in name_l for n in NICHE_OK)
    if not has_niche:
        return None

    score = 0
    reasons = []

    # Город фокуса
    if city.lower() in FOCUS_CITIES:
        score += 1
        reasons.append(f"город:{city}")
    else:
        return None  # вне фокуса не берём

    # Контакты
    if contacts["phones"]:
        score += 2
        reasons.append("телефон")
    else:
        return None
    digital = [s for s in contacts["socials"]] + [
        w for w in websites
    ]
    if contacts["socials"] or any("wa.me" in w or "whatsapp" in w.lower() for w in websites):
        score += 2
        reasons.append("мессенджер/social")
    elif websites:
        score += 1
        reasons.append("сайт")

    # Поток. На 2gis.by отзывы редкие (макс ~10), штрафов нет — иначе вырезаем живых студий.
    if rev_count >= 10:
        score += 3
        reasons.append(f"поток:отзывы{rev_count}")
    elif rev_count >= 5:
        score += 2
        reasons.append(f"поток:отзывы{rev_count}")
    elif rev_count >= 2:
        score += 1
        reasons.append(f"отзывы:{rev_count}")
    else:
        reasons.append(f"отзывы:{rev_count}")

    # Качество
    if rating >= 4.5 and rev_count >= 2:
        score += 1
        reasons.append(f"рейтинг:{rating}")
    if rating and rating < 3.5 and rev_count >= 2:
        score -= 2
        reasons.append(f"низкий рейтинг:{rating}")

    # Цифровой след = косвенный признак потока и готовности к digital
    n_digital = len(contacts["socials"]) + (1 if websites else 0)
    if n_digital >= 3:
        score += 1
        reasons.append("сильный digital-след")

    # Сеть / франшиза
    if branch_count > 1:
        score -= 3
        reasons.append(f"филиалы:{branch_count}")

    # Yclients — анти-ЦА
    if YCLIENTS_RE.search(all_links):
        score -= 3
        reasons.append("Yclients/Zapisi")

    # Нет сайта = запись через DM/звонок (наш кейс)
    if not websites:
        score += 1
        reasons.append("без сайта")
    else:
        # сайт, но нет явной онлайн-записи — ок
        if not YCLIENTS_RE.search(all_links):
            reasons.append("сайт без yclients")

    # Чистый URL сайта (2gis link-redirect → финальный)
    clean_sites = []
    for w in websites:
        m = re.search(r"\?(https?://.+)$", w)
        clean_sites.append(m.group(1) if m else w)

    phone_str = "; ".join(dict.fromkeys(contacts["phones"]))
    site_str = "; ".join(dict.fromkeys(clean_sites))
    social_str = "; ".join(dict.fromkeys(contacts["socials"]))

    return {
        "name": name,
        "city": city,
        "address": rec.get("address_name") or "",
        "phone": phone_str,
        "website": site_str,
        "socials": social_str,
        "rubrics": rubrics,
        "rating": rating,
        "reviews": rev_count,
        "branch_count": branch_count,
        "score": score,
        "reasons": ", ".join(reasons),
        "extension": (rec.get("org") or {}).get("extension") or "",
    }


def main():
    print("Загрузка raw-*.json …")
    raw = load_raw()
    print(f"Всего записей: {len(raw)}")

    # дедуп по имени+городу
    seen = set()
    scored = []
    for rec in raw:
        s = score_rec(rec)
        if not s:
            continue
        key = (s["name"].lower(), s["city"].lower())
        if key in seen:
            continue
        seen.add(key)
        scored.append(s)

    scored.sort(key=lambda x: (-x["score"], -x["reviews"]))
    # в работу: score >= 6
    work = [s for s in scored if s["score"] >= 6]
    print(f"Прошло ICP (score>=6): {len(work)} из {len(scored)} уникальных")

    csv_path = os.path.join(OUT_DIR, "scored.csv")
    fields = ["score", "name", "city", "address", "phone", "website", "socials",
              "rubrics", "rating", "reviews", "branch_count", "extension", "reasons"]
    with open(csv_path, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(work)
    print("CSV:", csv_path)

    md_path = os.path.join(OUT_DIR, "scored.md")
    with open(md_path, "w", encoding="utf-8") as f:
        f.write("# Лиды, прошедшие ICP (score ≥ 6)\n\n")
        f.write("Дата: 2026-10-09 · Источник: parser-2gis-new · ICP: `leads/ICP.md`\n\n")
        f.write("| # | Score | Студия | Город | Телефон | Отзывы | Рейтинг | Сайт | Соцсети | Почему |\n")
        f.write("|---|------:|--------|-------|---------|-------:|--------:|------|---------|--------|\n")
        for i, s in enumerate(work, 1):
            site = s["website"] or "—"
            soc = s["socials"] or "—"
            f.write(
                f"| {i} | {s['score']} | **{s['name']}** | {s['city']} | {s['phone'] or '—'} | "
                f"{s['reviews']} | {s['rating']} | {site} | {soc} | {s['reasons']} |\n"
            )
        f.write(f"\nВсего: {len(work)}\n")
    print("MD:", md_path)


if __name__ == "__main__":
    main()
