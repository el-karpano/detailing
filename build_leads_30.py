"""
Сборка файла лидов «30 детейлинг-студий Беларуси» для рассылки.
Данные из открытых источников (2GIS / Яндекс.Карты / сайты студий).
"""
import csv
import json
import os
import time

OUT = "leads"
os.makedirs(OUT, exist_ok=True)

LEADS = [
    # Минск
    {"name": "OLYMPIC DETAILING", "city": "Минск", "address": "Минск", "phone": "", "site": "olympic-detailing.by", "url_2gis": "", "note": "детейлинг-студия, партнёр Альфа-Банк"},
    {"name": "TEXX Detailing & Car Wash", "city": "Минск", "address": "Минск", "phone": "", "site": "texx.by", "url_2gis": "", "note": "детейлинг + мойка"},
    {"name": "ProLine Detailing", "city": "Минск", "address": "Минск", "phone": "", "site": "pro-line.by", "url_2gis": "", "note": "шумоизоляция, детейлинг"},
    {"name": "Detailing-Pro", "city": "Минск", "address": "Минск", "phone": "", "site": "detailing-pro.by", "url_2gis": "", "note": "полный спектр"},
    {"name": "VEACARS DETAILING", "city": "Минск", "address": "ул. Родниковая 33", "phone": "+375 25 910-34-92", "site": "veacarsdetailing.by", "url_2gis": "", "note": "Уручье/Степянка"},
    {"name": "Detaling Point", "city": "Минск", "address": "Минск", "phone": "+375 29 888-39-99", "site": "detailing-point.by", "url_2gis": "", "note": "запись Telegram"},
    {"name": "Madcar", "city": "Минск", "address": "пр. Независимости, 84а", "phone": "", "site": "", "url_2gis": "", "note": "детейлинг-студия"},
    {"name": "ДС Детейлинг", "city": "Минск", "address": "Минск", "phone": "", "site": "", "url_2gis": "", "note": "химчистка, есть на slivki.by"},
    {"name": "ACA Detailing", "city": "Минск", "address": "Минск", "phone": "", "site": "aca-detailing.clients.site", "url_2gis": "", "note": "тюнинг, оклейка"},

    # Барановичи
    {"name": "ХВВ Детейлинг", "city": "Барановичи", "address": "ул. Димитрова, 15В", "phone": "+375 29 802-88-87", "site": "n1954354.yclients.ru", "url_2gis": "https://yandex.by/maps/org/khvv/169144943582/", "note": "рейтинг 4.7, есть yclients"},

    # Брест
    {"name": "Remarket.Detailing", "city": "Брест", "address": "ул. Карьерная, 8/1", "phone": "+375 29 721-05-34", "site": "remarket.by", "url_2gis": "", "note": "с 2023, 10:00–22:00"},
    {"name": "BUG Detailing", "city": "Брест", "address": "ул. Лейтенанта Рябцева, 2А", "phone": "+375 33 381-72-15", "site": "detailing-brest.by", "url_2gis": "", "note": "полировка, оклейка"},
    {"name": "Auto Detailing Brest", "city": "Брест", "address": "Брест", "phone": "+375 33 674-78-80", "site": "autodetailing-brest.by", "url_2gis": "", "note": ""},
    {"name": "Zona Detailing", "city": "Брест", "address": "Брест", "phone": "", "site": "zonedetailing.by", "url_2gis": "", "note": "полировка, детейлинг-мойка"},
    {"name": "zbruja", "city": "Брест", "address": "ул. Янки Купалы, 19а-2", "phone": "+375 33 316-73-33", "site": "zbruja.by", "url_2gis": "", "note": "Viber/Telegram"},
    {"name": "Детейлинг Брест (Вулька)", "city": "Брест", "address": "Брест, Вулька", "phone": "+375 29 826-33-70", "site": "onlinebrest.by/katalog/detailing", "url_2gis": "", "note": "химчистка, керамика"},

    # Гродно
    {"name": "DEPO Detailing", "city": "Гродно", "address": "Гродно", "phone": "+375 29 582-60-50", "site": "depodtl.by", "url_2gis": "", "note": ""},
    {"name": "AutoMakeUp.by", "city": "Гродно", "address": "Гродно", "phone": "", "site": "automakeup.by", "url_2gis": "", "note": "оклейка, один из первых"},
    {"name": "AutoBogov", "city": "Гродно", "address": "Гродно", "phone": "+375 29 547-44-77", "site": "autobogov.by", "url_2gis": "", "note": "крупный автоцентр"},

    # Гомель
    {"name": "Schwartz", "city": "Гомель", "address": "ул. Дорожная, 8", "phone": "+375 33 375-01-51", "site": "", "url_2gis": "https://yandex.by/maps/org/schwartz/56173986703/", "note": "189 оценок"},
    {"name": "AUTOPEDANT", "city": "Гомель", "address": "Гомель", "phone": "", "site": "", "url_2gis": "", "note": "мойка, оклейка, тонировка"},
    {"name": "СТО Галактика Авто", "city": "Гомель", "address": "ул. Черниговская, 25а", "phone": "", "site": "", "url_2gis": "", "note": "полировка, защита"},
    {"name": "Rline.by / ИП Радьков", "city": "Гомель", "address": "ул. Дорожная, 26", "phone": "", "site": "rline.by", "url_2gis": "", "note": "покраска + полировка"},
    {"name": "Автоцентр Фрегат", "city": "Гомель", "address": "п. Победа, ул. Центральная, 74", "phone": "", "site": "", "url_2gis": "", "note": "полировка ЛКП"},

    # Витебск
    {"name": "Банзай Детейлинг", "city": "Витебск", "address": "ул. Туловская, 22", "phone": "+375 33 376-70-70", "site": "banzai-detail.by", "url_2gis": "https://yandex.by/maps/org/banzay_deteyling/167929838377/", "note": "39 отзывов, 294 фото"},
    {"name": "ArtDetailing", "city": "Витебск", "address": "ул. 2-я Набережная, 16", "phone": "+375 29 260-08-88", "site": "artdetailing.by", "url_2gis": "", "note": "WhatsApp/Telegram"},
    {"name": "Nikauto", "city": "Витебск", "address": "ул. Пороховая, 9к1", "phone": "", "site": "", "url_2gis": "", "note": "yolk.by"},
    {"name": "Ambadetail", "city": "Витебск", "address": "ул. П. Бровки, 6А", "phone": "", "site": "ambadetail.by", "url_2gis": "", "note": "оклейка"},
    {"name": "Vanderauto", "city": "Витебск", "address": "Витебск", "phone": "+375 29 514-89-53", "site": "vanderauto.by", "url_2gis": "", "note": "химчистка"},

    # Могилёв
    {"name": "Автореспект", "city": "Могилёв", "address": "Могилёв", "phone": "", "site": "avtorespect.by", "url_2gis": "", "note": "с 2003 года"},
    {"name": "CRYSTAL STUDIO", "city": "Могилёв", "address": "Могилёв", "phone": "", "site": "crystal-studio.by", "url_2gis": "", "note": "тонировка, оклейка, керамика"},
]

assert len(LEADS) >= 30, f"нужно 30, есть {len(LEADS)}"
LEADS = LEADS[:30]

# CSV
csv_path = os.path.join(OUT, "by-detailing-30.csv")
fields = ["name", "city", "address", "phone", "site", "url_2gis", "note"]
with open(csv_path, "w", encoding="utf-8-sig", newline="") as f:
    w = csv.DictWriter(f, fieldnames=fields)
    w.writeheader()
    for r in LEADS:
        w.writerow(r)

# JSON
json_path = os.path.join(OUT, "by-detailing-30.json")
with open(json_path, "w", encoding="utf-8") as f:
    json.dump(LEADS, f, ensure_ascii=False, indent=2)

# MD
md_path = os.path.join(OUT, "by-detailing-30.md")
lines = [
    "# 30 детейлинг-студий Беларуси — база для рассылки",
    "",
    f"Дата сбора: {time.strftime('%d.%m.%Y')} · Источники: 2GIS, Яндекс.Карты, сайты студий",
    "",
    "| # | Студия | Город | Адрес | Телефон | Сайт | Заметка |",
    "|---|--------|-------|-------|---------|------|---------|",
]
for i, r in enumerate(LEADS, 1):
    phone = f"[{r['phone']}](tel:{r['phone'].replace(' ', '')})" if r.get("phone") else "—"
    site = f"[{r['site']}]({r['site'] if r['site'].startswith('http') else 'https://' + r['site']})" if r.get("site") else "—"
    lines.append(
        f"| {i} | **{r['name']}** | {r['city']} | {r.get('address') or '—'} | {phone} | {site} | {r.get('note') or ''} |"
    )

lines += [
    "",
    "## Как пользоваться",
    "",
    "1. Открываешь студию (сайт / 2GIS / ВК)",
    "2. Собираешь `client.json` на неё (`npm run new-client -- slug`)",
    "3. Кидаешь демо-ссылку + первое сообщение (ниже)",
    "",
    "## Шаблон первого сообщения",
    "",
    "> Добрый день! Сделал для **{Название}** демо-приложение для записи — с вашими услугами и ценами.",
    "> Клиент за 30 секунд выбирает услугу и время. Если зайдёт — покажу, как подключить за 1 день.",
    "> Если нет — просто напишите «нет», дальше не побеспокою.",
    "",
    "## Парсинг 2GIS (расширение базы)",
    "",
    "```bash",
    "python parse_by_detailing.py          # URL по городам РБ",
    "python parse_by_detailing.py --run    # спарсить через parser-2gis",
    "# или веб: parser-2gis-new → вставить URL из leads/by-detailing-2gis-urls.txt",
    "```",
]
with open(md_path, "w", encoding="utf-8") as f:
    f.write("\n".join(lines))

print("OK", len(LEADS), "лидов")
print(" ", csv_path)
print(" ", json_path)
print(" ", md_path)
