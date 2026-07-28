#!/usr/bin/env python3
"""
generate_icons.py — Rasterize the Guard Hero shield SVG to required PNG sizes.

Requirements (one of):
  pip install cairosvg            # recommended — pure Python
  brew install librsvg            # macOS — uses rsvg-convert
  sudo apt install librsvg2-bin   # Linux — uses rsvg-convert

Usage:
  python3 build/generate_icons.py
  python3 build/generate_icons.py --sizes 16,32,48,128
  python3 build/generate_icons.py --output resources/guardhero/icons/

Output files:
  icon-16.png   — Favicons, small UI
  icon-32.png   — Standard UI, Windows taskbar
  icon-48.png   — Chrome toolbar, extension icon (MVP minimum)
  icon-64.png   — Medium UI
  icon-128.png  — Chrome Web Store, about page (MVP minimum)
  icon-256.png  — macOS Retina
  app.icns      — macOS app bundle (requires iconutil or sips)
  app.ico       — Windows installer icon
"""

import argparse
import shutil
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SVG_SOURCE = REPO_ROOT / "resources" / "guardhero" / "icons" / "shield.svg"
ICONS_DIR  = REPO_ROOT / "resources" / "guardhero" / "icons"

# Required sizes: (size, filename)
SIZES = [
    (16,  "icon-16.png"),
    (32,  "icon-32.png"),
    (48,  "icon-48.png"),
    (64,  "icon-64.png"),
    (128, "icon-128.png"),
    (256, "icon-256.png"),
]

GREEN  = "\033[92m"
RED    = "\033[91m"
YELLOW = "\033[93m"
RESET  = "\033[0m"
BOLD   = "\033[1m"


def rasterize_cairosvg(svg: Path, output: Path, size: int) -> bool:
    """Use cairosvg Python library."""
    try:
        import cairosvg
        cairosvg.svg2png(
            url=str(svg),
            write_to=str(output),
            output_width=size,
            output_height=size,
        )
        return True
    except ImportError:
        return False
    except Exception as exc:
        print(f"  {RED}cairosvg error: {exc}{RESET}")
        return False


def rasterize_rsvg(svg: Path, output: Path, size: int) -> bool:
    """Use rsvg-convert CLI tool."""
    if not shutil.which("rsvg-convert"):
        return False
    result = subprocess.run(
        ["rsvg-convert", "-w", str(size), "-h", str(size), "-o", str(output), str(svg)],
        capture_output=True,
    )
    return result.returncode == 0


def rasterize_inkscape(svg: Path, output: Path, size: int) -> bool:
    """Use Inkscape CLI."""
    if not shutil.which("inkscape"):
        return False
    result = subprocess.run(
        ["inkscape", str(svg), f"--export-png={output}",
         f"--export-width={size}", f"--export-height={size}"],
        capture_output=True,
    )
    return result.returncode == 0


def rasterize(svg: Path, output: Path, size: int) -> bool:
    """Try each rasterizer in order of preference."""
    for fn in [rasterize_cairosvg, rasterize_rsvg, rasterize_inkscape]:
        if fn(svg, output, size):
            return True
    return False


def make_icns(icons_dir: Path, sizes: list[tuple[int, str]]) -> bool:
    """Build macOS .icns from PNGs using iconutil."""
    if not shutil.which("iconutil"):
        return False  # macOS only
    iconset_dir = icons_dir / "app.iconset"
    iconset_dir.mkdir(exist_ok=True)

    # iconutil naming convention
    iconutil_sizes = [
        (16,  "icon_16x16.png"),
        (32,  "icon_16x16@2x.png"),
        (32,  "icon_32x32.png"),
        (64,  "icon_32x32@2x.png"),
        (128, "icon_128x128.png"),
        (256, "icon_128x128@2x.png"),
        (256, "icon_256x256.png"),
    ]
    size_map = {size: icons_dir / fname for size, fname in sizes}
    for size, iconutil_name in iconutil_sizes:
        src = size_map.get(size)
        if src and src.exists():
            dst = iconset_dir / iconutil_name
            import shutil as sh
            sh.copy2(src, dst)

    result = subprocess.run(
        ["iconutil", "-c", "icns", str(iconset_dir), "-o", str(icons_dir / "app.icns")],
        capture_output=True,
    )
    return result.returncode == 0


def make_ico(icons_dir: Path) -> bool:
    """Build Windows .ico from PNGs using Pillow."""
    try:
        from PIL import Image
        images = []
        for size in [16, 32, 48, 64, 128, 256]:
            p = icons_dir / f"icon-{size}.png"
            if p.exists():
                images.append(Image.open(p))
        if not images:
            return False
        images[0].save(
            str(icons_dir / "app.ico"),
            format="ICO",
            sizes=[(img.width, img.height) for img in images],
            append_images=images[1:],
        )
        return True
    except ImportError:
        return False


def main():
    parser = argparse.ArgumentParser(description="Generate Guard Hero icon set from SVG")
    parser.add_argument("--svg", default=str(SVG_SOURCE), help="Source SVG file")
    parser.add_argument("--output", default=str(ICONS_DIR), help="Output directory")
    parser.add_argument(
        "--sizes", default=None,
        help="Comma-separated sizes, e.g. 48,128 (default: all)"
    )
    args = parser.parse_args()

    svg = Path(args.svg)
    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)

    if not svg.exists():
        print(f"{RED}SVG not found: {svg}{RESET}")
        sys.exit(1)

    target_sizes = SIZES
    if args.sizes:
        requested = {int(s) for s in args.sizes.split(",")}
        target_sizes = [(s, f) for s, f in SIZES if s in requested]

    print(f"\n{BOLD}Guard Hero — Icon Generator{RESET}")
    print(f"  Source : {svg}")
    print(f"  Output : {output_dir}\n")

    generated = []
    failed = []

    for size, filename in target_sizes:
        output = output_dir / filename
        print(f"  {size}×{size}px → {filename} ...", end=" ", flush=True)
        ok = rasterize(svg, output, size)
        if ok:
            print(f"{GREEN}OK{RESET}")
            generated.append(filename)
        else:
            print(f"{YELLOW}SKIPPED{RESET} (no rasterizer available)")
            failed.append(filename)

    # Platform bundles
    if generated:
        print()
        print(f"  Building app.icns (macOS) ...", end=" ", flush=True)
        ok = make_icns(output_dir, target_sizes)
        print(f"{GREEN}OK{RESET}" if ok else f"{YELLOW}SKIPPED{RESET} (iconutil not available)")

        print(f"  Building app.ico (Windows)  ...", end=" ", flush=True)
        ok = make_ico(output_dir)
        print(f"{GREEN}OK{RESET}" if ok else f"{YELLOW}SKIPPED{RESET} (Pillow not installed)")

    print(f"\n{BOLD}Summary{RESET}")
    print(f"  Generated : {GREEN}{len(generated)}{RESET}")
    print(f"  Skipped   : {YELLOW}{len(failed)}{RESET}")

    if failed and len(failed) == len(target_sizes):
        print(f"\n{RED}No icons generated. Install a rasterizer:{RESET}")
        print("  pip install cairosvg        # Python, cross-platform")
        print("  brew install librsvg        # macOS")
        print("  sudo apt install librsvg2-bin  # Linux")
        sys.exit(1)

    print(f"\n{GREEN}✓ Icons written to {output_dir}{RESET}\n")


if __name__ == "__main__":
    main()
