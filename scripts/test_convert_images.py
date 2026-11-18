"""Unit tests for responsive WebP generation and safe cleanup."""
from pathlib import Path
import tempfile
import unittest

from PIL import Image

from convert_images import cleanup_orphaned_variants, convert_image


class ResponsiveWebPTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.root = Path(self.temp_dir.name)
        self.uploads = self.root / "uploads"
        self.uploads.mkdir()

    def tearDown(self):
        self.temp_dir.cleanup()

    def make_image(self, name, size, mode="RGB"):
        path = self.uploads / name
        color = (30, 120, 200, 80) if mode == "RGBA" else (30, 120, 200)
        Image.new(mode, size, color).save(path)
        return path

    def dimensions(self, path):
        with Image.open(path) as image:
            return image.size

    def test_generates_uniform_card_canvases_and_full_size_without_upscaling(self):
        source = self.make_image("machine.jpg", (1200, 600))
        generated = convert_image(source)
        self.assertEqual(len(generated), 3)
        self.assertEqual(self.dimensions(Path(str(source) + ".400.webp")), (400, 195))
        self.assertEqual(self.dimensions(Path(str(source) + ".800.webp")), (800, 391))
        self.assertEqual(self.dimensions(Path(str(source) + ".webp")), (1200, 600))
        self.assertTrue(source.exists())

    def test_small_source_is_contained_on_canvas_without_upscaling(self):
        source = self.make_image("small.png", (320, 320))
        convert_image(source)
        self.assertEqual(self.dimensions(Path(str(source) + ".400.webp")), (400, 195))
        self.assertEqual(self.dimensions(Path(str(source) + ".800.webp")), (800, 391))

    def test_same_filename_replacement_refreshes_variants(self):
        source = self.make_image("replace.jpg", (1200, 600))
        convert_image(source)
        Image.new("RGB", (640, 320), (180, 80, 20)).save(source)
        convert_image(source)
        self.assertEqual(self.dimensions(Path(str(source) + ".400.webp")), (400, 195))
        self.assertEqual(self.dimensions(Path(str(source) + ".800.webp")), (800, 391))
        self.assertEqual(self.dimensions(Path(str(source) + ".webp")), (640, 320))

    def test_transparency_is_preserved(self):
        source = self.make_image("transparent.png", (500, 250), mode="RGBA")
        convert_image(source)
        with Image.open(Path(str(source) + ".400.webp")) as image:
            self.assertEqual(image.mode, "RGBA")
            self.assertEqual(image.getpixel((0, 0))[3], 0)
            self.assertEqual(image.getpixel((200, 97))[3], 80)

    def test_orphan_cleanup_keeps_referenced_images(self):
        source = self.uploads / "removed.jpg"
        variants = [Path(str(source) + suffix) for suffix in (".400.webp", ".800.webp", ".webp")]
        for variant in variants:
            Image.new("RGB", (10, 10)).save(variant, format="WEBP")
        content = self.root / "content.md"
        content.write_text("image: /uploads/removed.jpg", encoding="utf-8")
        self.assertEqual(cleanup_orphaned_variants(self.root, self.uploads), 0)
        self.assertTrue(all(path.exists() for path in variants))
        content.write_text("no image reference", encoding="utf-8")
        self.assertEqual(cleanup_orphaned_variants(self.root, self.uploads), 3)
        self.assertTrue(all(not path.exists() for path in variants))


if __name__ == "__main__":
    unittest.main()
