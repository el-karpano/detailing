"""
Сбор лидов детейлинг-студий РБ через parser-2gis-new под ICP (leads/ICP.md).

Критерии ICP:
  - города фокуса (Минск + областные)
  - телефоны + WhatsApp/соцсети
  - отзывы >= MIN_REVIEWS (прокси «поток есть»)
  - рейтинг >= MIN_RATING
  - без франшиз (1 точка)

Запуск:
  python parse_by_detailing.py --urls          # показать/сохранить URL
  python parse_by_detailing.py --pilot         # 1 URL (Минск, «Детейлинг») — тест
  python parse_by_detailing.py --run           # все города × рубрики
"""
import argparse
import os
import sys

OUT_DIR = "leads"
os.makedirs(OUT_DIR, exist_ok=True)

# Рубрики ниши (чистый детейлинг, не «только мойка»)
QUERIES = [
    "Детейлинг",
    "Детейлинг-студия",
    "Полировка кузова",
    "Оклейка авто плёнкой",
    "Химчистка салона авто",
    "Керамическое покрытие авто",
    "Тонировка авто",
    "Антигравийная плёнка",
]

# Фокус: Минск + областные 100к+
CITIES = {
    "minsk": "Минск",
    "gomel": "Гомель",
    "mogilev": "Могилёв",
    "vitebsk": "Витебск",
    "brest": "Брест",
    "grodno": "Гродно",
    "bobruisk": "Бобруйск",
    "baranovichi": "Барановичи",
}

# ICP-пороги
MIN_REVIEWS = 30
MIN_RATING = 4.2


def build_urls() -> list[str]:
    urls = []
    for city in CITIES:
        for q in QUERIES:
            urls.append(f"https://2gis.by/{city}/search/{q}")
    return urls


def save_urls(urls):
    path = os.path.join(OUT_DIR, "by-detailing-2gis-urls.txt")
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(urls))
    print(f"URL сохранены: {path} ({len(urls)} шт.)")
    return path


def parser_cli_args(url: str, out: str) -> list[str]:
    exe = os.path.join(
        os.environ.get("APPDATA", ""),
        "Python",
        "Python314",
        "Scripts",
        "parser-2gis-new.exe",
    )
    if not os.path.exists(exe):
        # fallback: через python -c entry point
        return [
            sys.executable,
            "-c",
            "from parser_2gis import main; main()",
            "-i",
            url,
            "-o",
            out,
            "-f",
            "json",
        ]
    return [
        exe,
        "-i",
        url,
        "-o",
        out,
        "-f",
        "json",
        "--chrome.headless",
        "yes",
        "--chrome.disable-images",
        "yes",
        "--writer.csv.clean",
        "yes",
        # Без жёстких фильтров — скоринг в score_leads.py
        "--filters.dedup-franchises",
        "yes",
        "--filters.dedup-across-niches",
        "yes",
        "--parser.max-records",
        "300",
        "--parser.delay_between_clicks",
        "40",
    ]


def run_parse(urls: list[str], tag: str = "part"):
    import subprocess

    os.makedirs(OUT_DIR, exist_ok=True)
    for i, url in enumerate(urls, 1):
        out = os.path.join(OUT_DIR, f"raw-{tag}-{i:02d}.json")
        print(f"\n[{i}/{len(urls)}] {url}\n  -> {out}")
        cmd = parser_cli_args(url, out)
        try:
            subprocess.run(cmd, check=False)
        except Exception as e:
            print("  parse error:", e)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--urls", action="store_true", help="только показать URL")
    ap.add_argument("--pilot", action="store_true", help="пилот: 1 URL Минск")
    ap.add_argument("--run", action="store_true", help="полный прогон")
    args = ap.parse_args()

    urls = build_urls()
    save_urls(urls)

    if args.pilot:
        print("\nПИЛОТ:", urls[0])
        run_parse(urls[:1], tag="pilot")
    elif args.run:
        print(f"\nПОЛНЫЙ ПРОГОН: {len(urls)} URL")
        run_parse(urls, tag="run")
    else:
        print("\nКоманды:")
        print("  python parse_by_detailing.py --pilot")
        print("  python parse_by_detailing.py --run")
        print("\nICP-фильтры парсера:")
        print(f"  телефон обязателен, отзывы >= {MIN_REVIEWS}, рейтинг >= {MIN_RATING}, без франшиз")


if __name__ == "__main__":
    main()
