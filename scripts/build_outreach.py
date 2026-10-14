"""Build outreach file: contacts (IG + phone) + personal first message per lead."""
import csv
import glob
import json
import re
from urllib.parse import unquote

OUT_MD = "leads/outreach-minsk-icp.md"
OUT_CSV = "leads/outreach-minsk-icp.csv"

FOCUS = [
    # score>=6 from scored.csv, will re-read raw for full contacts
]

def clean_url(u: str) -> str:
    if not u:
        return ""
    m = re.search(r"\?(https?://.+)$", u)
    if m:
        u = m.group(1)
    u = u.rstrip("/")
    return u


def extract_contacts(rec: dict) -> dict:
    phones, websites, igs, tgs, was, vibers = [], [], [], [], [], []
    for group in rec.get("contact_groups") or []:
        for c in group.get("contacts") or []:
            t = (c.get("type") or "").lower()
            val = c.get("value") or c.get("url") or c.get("text") or ""
            if t == "phone":
                v = c.get("value") or c.get("text") or ""
                if v:
                    phones.append(v)
            elif t == "website":
                websites.append(clean_url(val))
            elif t == "instagram":
                igs.append(clean_url(val))
            elif t == "telegram":
                tgs.append(clean_url(val))
            elif t == "whatsapp":
                # strip 2gis prefill text → wa.me/<digits>
                m = re.search(r"wa\.me/(\d+)", val or "")
                was.append(f"https://wa.me/{m.group(1)}" if m else clean_url(val))
            elif t == "viber":
                vibers.append(clean_url(val))
    return {
        "phones": list(dict.fromkeys(phones)),
        "websites": [w for w in dict.fromkeys(websites) if w and "2gis" not in w],
        "instagram": list(dict.fromkeys(igs)),
        "telegram": list(dict.fromkeys(tgs)),
        "whatsapp": list(dict.fromkeys(was)),
        "viber": list(dict.fromkeys(vibers)),
    }


def load_raw_index() -> dict:
    """name.lower() -> merged record with best contacts"""
    best = {}
    for path in glob.glob("leads/raw-*.json"):
        try:
            with open(path, encoding="utf-8-sig") as f:
                data = json.load(f)
        except Exception:
            continue
        if not isinstance(data, list):
            continue
        for rec in data:
            name = ((rec.get("org") or {}).get("primary") or rec.get("name") or "").strip()
            key = name.lower()
            if not key:
                continue
            contacts = extract_contacts(rec)
            rev = rec.get("reviews") or {}
            n_rev = int(rev.get("general_review_count") or rev.get("org_review_count") or 0)
            rating = float(rev.get("general_rating") or 0)
            rubrics = "; ".join(r.get("name") or "" for r in (rec.get("rubrics") or []))
            ext = (rec.get("org") or {}).get("extension") or ""
            city = ""
            for a in rec.get("adm_div") or []:
                if a.get("type") == "city":
                    city = a.get("name") or ""
            addr = rec.get("address_name") or ""
            prev = best.get(key)
            # keep record with more contacts / reviews
            score_prev = (
                len(prev["contacts"]["phones"]) + len(prev["contacts"]["instagram"]) + len(prev["contacts"]["telegram"]) + prev["reviews"]
                if prev else -1
            )
            score_new = len(contacts["phones"]) + len(contacts["instagram"]) + len(contacts["telegram"]) + n_rev
            if score_new >= score_prev:
                best[key] = {
                    "name": name,
                    "city": city,
                    "address": addr,
                    "contacts": contacts,
                    "reviews": n_rev,
                    "rating": rating,
                    "rubrics": rubrics,
                    "extension": ext,
                }
    return best


def service_hint(rubrics: str, extension: str, name: str) -> str:
    t = (rubrics + " " + extension + " " + name).lower()
    if "оклей" in t or "плёнк" in t or "пленк" in t or "vinyl" in t or "ppf" in t:
        return "оклейка/плёнка"
    if "полиров" in t:
        return "полировка"
    if "химчист" in t:
        return "химчистка"
    if "детейлинг" in t or "detail" in t or "detailing" in t:
        return "детейлинг"
    if "мойк" in t or "wash" in t:
        return "детейлинг/мойка"
    return "детейлинг"


def message_for(row: dict) -> str:
    """Коротко: кто я / что делаю / выгода. 3–4 фразы, разные углы под профиль."""
    name = row["name"]
    svc = row["service_hint"]
    reviews = row["reviews"]

    # КТО + ЧТО — сразу, без «меня зовут, я из компании»
    who = "Андрей, делаю онлайн-запись для детейлинг-студий."
    if svc == "оклейка/плёнка":
        who = "Андрей, делаю онлайн-запись для студий оклейки и детейлинга."

    # ВЫГОДА — разная под ситуацию студии
    if svc == "оклейка/плёнка":
        benefit = (
            "Под оклейку работа идёт на день-два — удобно, когда клиент сам занимает слот, "
            "а не переписывается о времени."
        )
    elif reviews >= 5:
        benefit = (
            "Клиент сам берёт услугу и время, заявка приходит к вам — без звонков, пока вы в работе."
        )
    else:
        benefit = (
            "Клиент сам берёт услугу и время, заявка приходит к вам — без звонков и переписки в директе."
        )

    # КРЮЧОК под студию
    if reviews >= 5:
        hook = f"{name}, видел вас на картах — хороший поток."
    elif row["instagram"]:
        hook = f"{name}, видел вас в Instagram."
    else:
        hook = f"{name}, нашёл на картах."

    cta = "Покажу демо на ваших услугах за минуту. Не нужно — напишите «нет»."

    return f"{hook} {who} {benefit} {cta}"


def main():
    raw = load_raw_index()

    with open("leads/scored.csv", encoding="utf-8-sig") as f:
        scored = list(csv.DictReader(f))

    rows = []
    for s in scored:
        key = s["name"].strip().lower()
        rec = raw.get(key)
        if not rec:
            # try fuzzy
            for k, v in raw.items():
                if s["name"].strip().lower() in k or k in s["name"].strip().lower():
                    rec = v
                    break
        if not rec:
            continue
        c = rec["contacts"]
        # prefer telegram link that is not just number
        tgs = [t for t in c["telegram"] if "t.me/+" not in t and t]
        if not tgs:
            tgs = c["telegram"]
        row = {
            "name": rec["name"],
            "city": rec["city"] or s.get("city", ""),
            "address": rec["address"],
            "phone": c["phones"][0] if c["phones"] else (s.get("phone", "").split(";")[0].strip()),
            "phones_all": "; ".join(c["phones"]) if c["phones"] else s.get("phone", ""),
            "instagram": c["instagram"][0] if c["instagram"] else "",
            "telegram": tgs[0] if tgs else "",
            "whatsapp": c["whatsapp"][0] if c["whatsapp"] else "",
            "website": c["websites"][0] if c["websites"] else (s.get("website", "").split(";")[0].strip() if "2gis" not in s.get("website", "") else ""),
            "reviews": rec["reviews"] or int(s.get("reviews") or 0),
            "rating": rec["rating"] or float(s.get("rating") or 0),
            "rubrics": rec["rubrics"],
            "score": s["score"],
            "service_hint": service_hint(rec["rubrics"], rec["extension"], rec["name"]),
        }
        row["message"] = message_for(row)
        rows.append(row)

    # sort by score desc
    rows.sort(key=lambda x: (-int(x["score"]), -int(x["reviews"])))

    # CSV
    fields = ["score", "name", "city", "address", "phone", "phones_all", "instagram",
              "telegram", "whatsapp", "website", "reviews", "rating", "service_hint",
              "rubrics", "message"]
    with open(OUT_CSV, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(rows)

    # MD
    with open(OUT_MD, "w", encoding="utf-8") as f:
        f.write("# Outreach Минск по ICP — контакты + первое сообщение\n\n")
        f.write("Дата: 2026-10-09 · Источник: parser-2gis-new · ICP: `leads/ICP.md`\n\n")
        f.write("**Канал:** Telegram (основной), запасной — WhatsApp/звонок.\n\n")
        f.write("**Структура сообщения (3–4 фразы):** крючок под студию → кто я + что делаю → выгода → CTA с opt-out.\n\n")
        f.write("**Правила:** без ссылок в первом сообщении · пауза 3–5 мин · opt-out «нет» · лимит ~15 новых диалогов/день\n")
        f.write("Профиль ТГ: фото + «Андрей» + строка «приложения для бизнеса».\n\n")
        f.write("---\n\n")
        for i, r in enumerate(rows, 1):
            f.write(f"## {i}. {r['name']} · {r['city']}\n\n")
            f.write(f"| | |\n|---|---|\n")
            f.write(f"| **Score** | {r['score']} |\n")
            f.write(f"| **Телефон** | {r['phones_all'] or '—'} |\n")
            f.write(f"| **Instagram** | {r['instagram'] or '—'} |\n")
            f.write(f"| **Telegram** | {r['telegram'] or '—'} |\n")
            f.write(f"| **WhatsApp** | {r['whatsapp'] or '—'} |\n")
            f.write(f"| **Сайт** | {r['website'] or 'нет'} |\n")
            f.write(f"| **Адрес** | {r['address'] or '—'} |\n")
            f.write(f"| **Отзывы / рейтинг** | {r['reviews']} / {r['rating']} |\n")
            f.write(f"| **Профиль** | {r['service_hint']} |\n\n")
            f.write("**Первое сообщение:**\n\n")
            f.write(f"> {r['message']}\n\n")
            f.write("---\n\n")
        f.write(f"\nВсего: {len(rows)}\n")

    print(f"rows: {len(rows)}")
    print("MD:", OUT_MD)
    print("CSV:", OUT_CSV)
    for r in rows:
        ig = r["instagram"] or "—"
        print(f"  {r['score']:>2} {r['name'][:24]:<24} | {r['phone'][:18]:<18} | {ig[:40]}")


if __name__ == "__main__":
    main()
