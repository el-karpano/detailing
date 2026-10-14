"""Generate PWA icons for a white-label client from its brand logo.

Usage: python scripts/gen_pwa_icons.py <slug>
Reads clients/<slug>/assets/logo.jpg (or .png/.svg fallback), writes clients/<slug>/icons/.
"""
import sys
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent


def load_logo(assets: Path) -> Image.Image:
    for name in ("logo.png", "logo.jpg", "logo.jpeg", "logo.webp", "logo-header.jpg", "logo-header.png"):
        p = assets / name
        if p.exists():
            im = Image.open(p).convert("RGBA")
            print(f"  source logo: {p.name} {im.size}")
            return im
    raise SystemExit(f"no logo found in {assets}")


def fit_square(im: Image.Image, size: int, pad_ratio: float = 0.0) -> Image.Image:
    """Center logo on black square. pad_ratio=0 → fill; >0 → leave safe-zone margin."""
    bg = Image.new("RGBA", (size, size), (0, 0, 0, 255))
    inner = int(size * (1 - pad_ratio * 2))
    logo = im.copy()
    logo.thumbnail((inner, inner), Image.Resampling.LANCZOS)
    x = (size - logo.width) // 2
    y = (size - logo.height) // 2
    bg.paste(logo, (x, y), logo if logo.mode == "RGBA" else None)
    return bg


def make_startup(logo: Image.Image, w: int, h: int, out: Path) -> None:
    bg = Image.new("RGBA", (w, h), (0, 0, 0, 255))
    target = min(w, h) // 3
    lg = logo.copy()
    lg.thumbnail((target, target), Image.Resampling.LANCZOS)
    x = (w - lg.width) // 2
    y = (h - lg.height) // 2
    bg.paste(lg, (x, y), lg if lg.mode == "RGBA" else None)
    bg.convert("RGB").save(out, "PNG", optimize=True)
    print(f"  wrote {out.relative_to(ROOT)} {w}x{h}")


def make_favicon_svg(logo: Image.Image, out: Path) -> None:
    """SVG favicon: black square + embedded logo (keeps type=image/svg+xml link working)."""
    import base64
    import io

    sq = fit_square(logo, 64, pad_ratio=0.08)
    buf = io.BytesIO()
    sq.convert("RGB").save(buf, format="PNG", optimize=True)
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    out.write_text(
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">'
        f'<rect width="64" height="64" fill="#000"/>'
        f'<image width="64" height="64" href="data:image/png;base64,{b64}"/>'
        f"</svg>\n",
        encoding="utf-8",
    )
    print(f"  wrote {out.relative_to(ROOT)}")


def main() -> None:
    slug = sys.argv[1] if len(sys.argv) > 1 else Path(ROOT / "clients" / ".current").read_text().strip()
    client = ROOT / "clients" / slug
    assets = client / "assets"
    icons = client / "icons"
    icons.mkdir(parents=True, exist_ok=True)

    print(f"gen_pwa_icons: {slug}")
    logo = load_logo(assets)

    # any-purpose icons: logo fills the square (already black bg)
    for size, name in (
        (180, "icon-180.png"),
        (192, "icon-192.png"),
        (512, "icon-512.png"),
    ):
        fit_square(logo, size, pad_ratio=0.0).convert("RGB").save(icons / name, "PNG", optimize=True)
        print(f"  wrote icons/{name}")

    # maskable: keep content in ~80% safe zone
    fit_square(logo, 512, pad_ratio=0.12).convert("RGB").save(icons / "maskable-512.png", "PNG", optimize=True)
    print("  wrote icons/maskable-512.png")

    make_favicon_svg(logo, icons / "favicon.svg")

    # iOS splash (portrait only — matches index.html)
    make_startup(logo, 1170, 2532, icons / "startup-1170x2532.png")
    make_startup(logo, 750, 1334, icons / "startup-750x1334.png")

    print("done →", icons)


if __name__ == "__main__":
    main()
