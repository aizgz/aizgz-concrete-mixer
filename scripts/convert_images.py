#!/usr/bin/env python3
"""Create WebP display copies for CMS-uploaded JPEG and PNG files.

Original uploads are never modified. Each generated file is stored beside its
source as <original-filename>.webp, e.g. machine.jpg.webp.
"""
from pathlib import Path
from PIL import Image, ImageOps

UPLOADS_DIR = Path("uploads")
SUPPORTED_SUFFIXES = {".jpg", ".jpeg", ".png"}
WEBP_QUALITY = 88


def convert_image(source: Path) -> Path:
    destination = Path(str(source) + ".webp")

    with Image.open(source) as opened:
        image = ImageOps.exif_transpose(opened)
        # Preserve transparency for PNG assets; otherwise use RGB for compact output.
        has_alpha = image.mode in {"RGBA", "LA"} or (
            image.mode == "P" and "transparency" in image.info
        )
        image = image.convert("RGBA" if has_alpha else "RGB")
        image.save(
            destination,
            format="WEBP",
            quality=WEBP_QUALITY,
            method=6,
        )

    source_kb = source.stat().st_size / 1024
    output_kb = destination.stat().st_size / 1024
    reduction = (1 - destination.stat().st_size / source.stat().st_size) * 100
    print(
        f"{source}: {source_kb:.1f} KiB -> "
        f"{destination}: {output_kb:.1f} KiB ({reduction:.1f}% smaller)"
    )
    return destination


def main() -> None:
    if not UPLOADS_DIR.is_dir():
        print("No uploads directory found; nothing to convert.")
        return

    sources = sorted(
        path
        for path in UPLOADS_DIR.rglob("*")
        if path.is_file() and path.suffix.lower() in SUPPORTED_SUFFIXES
    )

    if not sources:
        print("No JPEG or PNG uploads found.")
        return

    for source in sources:
        convert_image(source)

    print(f"Generated {len(sources)} WebP image variant(s).")


if __name__ == "__main__":
    main()
