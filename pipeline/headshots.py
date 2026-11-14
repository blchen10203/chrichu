"""Crop a head-and-shoulders avatar for each fighter from the cutouts images.py and open_photos.py cached.

Run by hand after images.py, in the image venv (needs Pillow):
    .venv-images/Scripts/python headshots.py
Writes web/public/img/fighters/<id>.webp; then build.py marks those fighters hasImage.
No new downloads: a fighter with no cached cutout keeps the site's placeholder.
"""
import sys
from pathlib import Path

from PIL import Image

import images

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "web" / "public" / "img" / "fighters"
SIZE = 96  # the avatar is 44 css px; 96 covers 2x screens
SPAN = 2.4  # crop side as a multiple of the head's width: head plus a little shoulder


def crop_box(alpha_rows, step=images.STEP):
    """Square (left, top, right, bottom) around the head, in full-size pixels, from the cutout's alpha rows."""
    full = [[a >= 128 for a in r[::step]] for r in alpha_rows[::step]]
    mask = images.largest(full)
    top, head, shoulders = images.head_scan(mask)
    xs = [x for row in mask[top : top + max(1, head)] for x, v in enumerate(row) if v]
    side = head
    if shoulders is None:
        # No neck found (long hair, arms up): `head` is really the body's width and would zoom far out.
        # Size the head from standing height instead, but no tighter than half that width, for close-up photos.
        figure, shown = images.body(alpha_rows)
        side = max(1.15 * images.HEAD * len(figure) / shown, 0.55 * head)
    cx, side = sum(xs) / len(xs) * step, SPAN * side * step
    y0 = top * step - 0.12 * side
    return round(cx - side / 2), round(y0), round(cx + side / 2), round(y0 + side)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    done = 0
    for png in sorted(images.CACHE.glob("*.png")):
        try:
            data = png.read_bytes()
            box = crop_box(images.read_alpha(data))
            with Image.open(png) as im:
                # crop pads with transparency where the box runs past the photo's edge
                face = im.convert("RGBA").crop(box).resize((SIZE, SIZE), Image.LANCZOS)
            face.save(OUT / f"{png.stem}.webp", quality=82, method=6)
            done += 1
        except Exception as e:  # one odd photo must not lose the rest
            print(f"{png.stem}: skipped ({e})", file=sys.stderr)
    print(f"Wrote {done} headshots to {OUT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
