"""Integration smoke test for the pinned CPU backend (runs on Linux CI)."""
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]


class CpuCutoutTest(unittest.TestCase):
    def test_real_cutout_is_transparent_and_complete(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "statue.png"
            subprocess.run([sys.executable, str(ROOT / "scripts/remove-image-background.py"),
                            str(ROOT / "tests/fixtures/foreground-source.jpg"), str(output)], check=True)
            with Image.open(output) as image:
                alpha = image.convert("RGBA").getchannel("A")
                low, high = alpha.getextrema()
                self.assertLess(low, 8)
                self.assertGreater(high, 200)
                left, top, right, bottom = alpha.point(lambda p: 255 if p > 16 else 0).getbbox()
                self.assertGreater(left, 1)
                self.assertGreater(top, 1)
                self.assertLess(right, image.width - 1)
                self.assertLess(bottom, image.height - 1)

    def test_paid_and_remote_model_backends_are_rejected(self):
        result = subprocess.run([sys.executable, str(ROOT / "scripts/remove-image-background.py"),
                                 "--model", "withoutbg", "--warmup"], capture_output=True)
        self.assertNotEqual(result.returncode, 0)
