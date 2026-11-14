"""Cut fighters out of openly licensed Wikimedia Commons photos, for fighters ufc.com has no cutout of.

Run by hand in the rembg venv, then trace:
    .venv-images/Scripts/python open_photos.py
    python images.py --offline
open_photos.csv names the Commons file chosen for each fighter (check each cutout by eye)
and `shown`: the share of standing height the photo shows, judged by eye (chest ~0.3, waist ~0.42, feet 1).
web/data/photo-credits.json keeps author and licence, which CC BY and CC BY-SA require the site to show.
"""
import csv
import html
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

from rembg import new_session, remove

import parse

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "pipeline" / ".image-cache"
CREDITS = ROOT / "web" / "data" / "photo-credits.json"
UA = {"User-Agent": "reachdle-outlines/1.0 (https://reachdle.vercel.app)"}  # Wikimedia asks for a contact
OPEN = re.compile(r"^(CC BY(-SA)? [\d.]+|CC0|Public domain)$")  # licences that allow a traced copy


def get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as resp:
        return resp.read()


def info(file):
    """A 900 px rendering of the file, and its credit line."""
    q = {"action": "query", "titles": f"File:{file}", "prop": "imageinfo", "iiprop": "url|extmetadata",
         "iiurlwidth": 900, "format": "json", "formatversion": 2}
    page = json.loads(get("https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(q)))["query"]["pages"][0]
    ii = page["imageinfo"][0]
    text = lambda k: html.unescape(re.sub(r"<[^>]+>", "", ii["extmetadata"].get(k, {}).get("value", ""))).strip()
    # Commons wraps a guessed author as "No machine-readable author provided. X assumed (...)".
    author = re.sub(r"^No machine-readable author provided\. (.+?) assumed\b.*$", r"\1", text("Artist"))
    return ii.get("thumburl") or ii["url"], {
        "author": author or "Unknown",
        "license": text("LicenseShortName"),
        "url": ii["descriptionurl"],
    }


def main():
    CACHE.mkdir(exist_ok=True)
    session = new_session("u2net_human_seg")
    with open(ROOT / "pipeline" / "open_photos.csv", newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    credits = {}
    for r in rows:
        fighter_id = parse.slug(r["name"])
        try:
            url, credit = info(r["file"])
            if not OPEN.match(credit["license"]):
                print(f"{fighter_id}: skipped, licence {credit['license']!r}", file=sys.stderr)
                continue
            png = CACHE / f"{fighter_id}.png"
            if not png.exists():
                png.write_bytes(remove(get(url), session=session))
                time.sleep(1)
            credits[fighter_id] = {"name": r["name"], **credit}
            print(f"{fighter_id}: cut out", flush=True)
        except Exception as e:  # one bad file must not lose the rest
            print(f"{fighter_id}: skipped ({e})", file=sys.stderr, flush=True)
    CREDITS.write_text(json.dumps(credits, indent=1, sort_keys=True, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {len(credits)} credits to {CREDITS.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
