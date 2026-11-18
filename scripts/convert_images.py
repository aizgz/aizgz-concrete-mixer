#!/usr/bin/env python3
"""Create responsive WebP copies for CMS-uploaded JPEG and PNG images.

Original uploads are never modified. For each source image, generate:
  <source>.400.webp  - centered 2.05:1 card crop, up to 400px wide
  <source>.800.webp  - centered 2.05:1 card crop, up to 800px wide
  <source>.webp      - full source dimensions for product detail views

Card crops match the page's fixed 192px-tall object-cover image frame at
approximately 393px wide. Cropping is performed before resizing, never
upscales the source, and uses the same centered crop as CSS object-fit: cover.
Re-running always refreshes variants, so replacing an upload with the same
filename cannot leave stale optimized files.
"""
from pathlib import Path
from PIL import Image, ImageOps

ROOT_DIR = Path(".")
UPLOADS_DIR = ROOT_DIR / "uploads"
SUPPORTED_SUFFIXES = {".jpg", ".jpeg", ".png"}
VARIANT_WIDTHS = (400, 800)
CARD_ASPECT_RATIO = 393 / 192
WEBP_QUALITY = 72
WEBP_METHOD = 6


def save_webp(image: Image.Image, destination: Path, icc_profile=None) -> None:
    """Write atomically so an interrupted run cannot leave a partial file."""
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_name(destination.name + ".tmp")
    try:
        options = {"format": "WEBP", "quality": WEBP_QUALITY, "method": WEBP_METHOD}
        if icc_profile:
            options["icc_profile"] = icc_profile
        image.save(temporary, **options)
        temporary.replace(destination)
    finally:
        if temporary.exists():
            temporary.unlink()


def resized_to_width(image: Image.Image, target_width: int) -> Image.Image:
    """Resize proportionally when needed; never enlarge a small source."""
    if image.width <= target_width:
        return image.copy()
    target_height = max(1, round(image.height * target_width / image.width))
    return image.resize((target_width, target_height), Image.Resampling.LANCZOS)


def centered_card_crop(image: Image.Image) -> Image.Image:
    """Match a centered CSS object-fit: cover crop for the card frame."""
    width, height = image.size
    source_ratio = width / height
    if source_ratio > CARD_ASPECT_RATIO:
        crop_width = max(1, round(height * CARD_ASPECT_RATIO))
        left = (width - crop_width) // 2
        return image.crop((left, 0, left + crop_width, height))
    crop_height = max(1, round(width / CARD_ASPECT_RATIO))
    top = (height - crop_height) // 2
    return image.crop((0, top, width, top + crop_height))


def card_variant(image: Image.Image, target_width: int) -> Image.Image:
    """Create a centered card crop and resize without upscaling."""
    cropped = centered_card_crop(image)
    if cropped.width <= target_width:
        return cropped.copy()
    target_height = max(1, round(cropped.height * target_width / cropped.width))
    return cropped.resize((target_width, target_height), Image.Resampling.LANCZOS)


def convert_image(source: Path) -> list[Path]:
    """Generate card-cropped 400px/800px and full-size WebP variants."""
    generated = []
    with Image.open(source) as opened:
        image = ImageOps.exif_transpose(opened)
        has_alpha = image.mode in {"RGBA", "LA"} or (
            image.mode == "P" and "transparency" in image.info
        )
        image = image.convert("RGBA" if has_alpha else "RGB")
        icc_profile = opened.info.get("icc_profile")

        for width in VARIANT_WIDTHS:
            destination = Path(str(source) + f".{width}.webp")
            save_webp(card_variant(image, width), destination, icc_profile)
            generated.append(destination)

        full_size = Path(str(source) + ".webp")
        save_webp(image, full_size, icc_profile)
        generated.append(full_size)

    source_kb = source.stat().st_size / 1024
    output_kb = sum(path.stat().st_size for path in generated) / 1024
    print(f"{source}: {source_kb:.1f} KiB -> {len(generated)} variants, {output_kb:.1f} KiB total")
    return generated


def referenced_source_paths(root: Path, uploads_dir: Path) -> list[str]:
    """Read text outside uploads to identify still-referenced deleted images."""
    contents = []
    ignored = {".git", "node_modules", ".vercel", ".next"}
    for path in root.rglob("*"):
        if not path.is_file():
            continue
        try:
            relative = path.relative_to(root)
        except ValueError:
            continue
        if relative.parts[0] in ignored or uploads_dir == path or uploads_dir in path.parents:
            continue
        try:
            contents.append(path.read_text(encoding="utf-8"))
        except (UnicodeDecodeError, OSError):
            continue
    return contents


def cleanup_orphaned_variants(root: Path = ROOT_DIR, uploads_dir: Path = UPLOADS_DIR) -> int:
    """Delete variants only if their source is gone and no content references it.

    If content still points to a deleted source, keep its WebP siblings so the
    page can continue displaying the image while the CMS reference is repaired.
    """
    contents = referenced_source_paths(root, uploads_dir)
    removed = 0
    suffixes = (".400.webp", ".800.webp", ".webp")
    for variant in sorted(uploads_dir.rglob("*.webp")):
        suffix = next((item for item in suffixes if variant.name.endswith(item)), None)
        if suffix is None:
            continue
        source = Path(str(variant)[:-len(suffix)])
        if source.suffix.lower() not in SUPPORTED_SUFFIXES or source.exists():
            continue
        relative_ref = source.relative_to(root).as_posix()
        source_ref = "/" + relative_ref
        if any(source_ref in text or relative_ref in text for text in contents):
            continue
        variant.unlink()
        removed += 1
        print(f"Removed unreferenced image variant: {variant}")
    return removed


def main() -> None:
    if not UPLOADS_DIR.is_dir():
        print("No uploads directory found; nothing to convert.")
        return
    sources = sorted(
        path for path in UPLOADS_DIR.rglob("*")
        if path.is_file() and path.suffix.lower() in SUPPORTED_SUFFIXES
    )
    for source in sources:
        convert_image(source)
    removed = cleanup_orphaned_variants()
    print(f"Processed {len(sources)} source image(s); removed {removed} unreferenced variant(s).")


if __name__ == "__main__":
    main()
