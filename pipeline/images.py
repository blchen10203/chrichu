"""Trace ufc.com full-body cutouts into outline paths for the height silhouette.

Run by hand when the roster changes; not part of the weekly Action.
`--offline` traces only the cutouts already cached.
Photos are cached in pipeline/.image-cache/ (git-ignored) and are never
committed: only the traced paths go to web/data/outlines.json. Spec 11.1, 13.
"""
import csv
import json
import re
import struct
import sys
import time
import urllib.error
import urllib.request
import zlib
from pathlib import Path

import parse

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "pipeline" / ".image-cache"
OUT = ROOT / "web" / "data" / "outlines.json"
DELAY = 15  # ufc.com robots.txt crawl-delay, seconds
UA = "Mozilla/5.0 (compatible; reachdle-outlines)"
FULL_BODY = re.compile(r"https://ufc\.com/images/styles/athlete_bio_full_body/[^\"'\s]+")
FIG = 120  # SilhouetteStage figure height in SVG units: head at 0, floor at FIG
# Most cutouts stop at the waist, some at mid-shin: the share of standing height each shows.
WAIST, SHIN = 0.42, 0.85
HEAD = 0.093  # head width with ears, as a share of standing height
STEP = 2  # trace every 2nd pixel; the figure is drawn ~100 px tall
EPSILON = 1.2  # simplification tolerance, in traced pixels
# Where the arms join when a photo's pose hides it: centre line and half shoulder width, in FIG units.
ARM_Y, ARM_X = 23.0, 14.5


def read_alpha(data):
    """Alpha rows of an 8-bit, non-interlaced RGBA or grey+alpha PNG."""
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError("not a PNG")
    pos, idat = 8, bytearray()
    while pos < len(data):
        n, kind = struct.unpack(">I4s", data[pos : pos + 8])
        body = data[pos + 8 : pos + 8 + n]
        if kind == b"IHDR":
            w, h, depth, ctype, _, _, interlace = struct.unpack(">IIBBBBB", body)
        elif kind == b"IDAT":
            idat += body
        pos += 12 + n
    if depth != 8 or ctype not in (4, 6) or interlace:
        raise ValueError(f"unsupported PNG: depth {depth}, colour type {ctype}, interlace {interlace}")
    bpp = 4 if ctype == 6 else 2
    raw, stride = zlib.decompress(bytes(idat)), w * bpp
    prev, rows, i = bytearray(stride), [], 0
    for _ in range(h):
        f, line = raw[i], bytearray(raw[i + 1 : i + 1 + stride])
        i += 1 + stride
        for x in range(stride):
            a = line[x - bpp] if x >= bpp else 0
            b = prev[x]
            if f == 1:
                line[x] = (line[x] + a) & 255
            elif f == 2:
                line[x] = (line[x] + b) & 255
            elif f == 3:
                line[x] = (line[x] + (a + b) // 2) & 255
            elif f == 4:
                c = prev[x - bpp] if x >= bpp else 0
                p = a + b - c
                pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                line[x] = (line[x] + (a if pa <= pb and pa <= pc else b if pb <= pc else c)) & 255
        rows.append(bytes(line[bpp - 1 :: bpp]))
        prev = line
    return rows


def largest(mask):
    """Only the biggest connected figure: drops bystanders, props and specks."""
    h, w = len(mask), len(mask[0])
    seen, best = [[False] * w for _ in range(h)], []
    for y in range(h):
        for x in range(w):
            if not mask[y][x] or seen[y][x]:
                continue
            comp, stack = [], [(x, y)]
            seen[y][x] = True
            while stack:
                px, py = stack.pop()
                comp.append((px, py))
                for nx, ny in ((px + 1, py), (px - 1, py), (px, py + 1), (px, py - 1)):
                    if 0 <= nx < w and 0 <= ny < h and mask[ny][nx] and not seen[ny][nx]:
                        seen[ny][nx] = True
                        stack.append((nx, ny))
            if len(comp) > len(best):
                best = comp
    out = [[False] * w for _ in range(h)]
    for x, y in best:
        out[y][x] = True
    return out


def head_scan(mask):
    """The top row, the head's width and the row where the shoulders start (None if not found)."""
    widths = [sum(r) for r in mask]
    top = next(y for y, w in enumerate(widths) if w)
    head, neck = 0, False
    for y in range(top, len(widths)):
        w = widths[y]
        if not head and w < 0.12 * len(mask[0]):
            continue  # hair above the head
        if neck and w > 1.3 * head:
            return top, head, y
        if not neck:
            head = max(head, w)
        neck = neck or w < 0.85 * head
    return top, head, None


def framing(mask):
    """The share of standing height a ufc.com cutout cut off by the frame shows, judged from head width."""
    top, head, _ = head_scan(mask)
    shown = (len(mask) - top) * HEAD / head
    # Long hair widens the head and reads as a tiny share; such photos are waist crops.
    return SHIN if shown > 0.6 else WAIST


def arms(mask, s, cx):
    """Where the arms join the body: centre line height and the left and right shoulder edges, in FIG units."""
    _, _, start = head_scan(mask)
    if start is not None:
        rows = range(start, min(len(mask), start + round(0.08 * FIG / s)))  # the deltoids, above hanging elbows
        y = max(rows, key=lambda r: sum(mask[r]))
        xs = [x for x, v in enumerate(mask[y]) if v]
        sy, sl, sr = y * s, (xs[0] - cx) * s, (xs[-1] + 1 - cx) * s
        if 0.12 * FIG <= sy <= 0.3 * FIG and 0.16 * FIG <= sr - sl <= 0.4 * FIG:
            return round(sy, 1), round(sl, 1), round(sr, 1)
    return ARM_Y, -ARM_X, ARM_X


def body(rows, shown=None):
    """Downsampled pixels of the main figure from the head to its lowest pixel, and the share of standing height shown.

    `shown` is given for photos judged by eye (open_photos.csv); otherwise it is worked out.
    """
    mask = largest([[a >= 128 for a in r[::STEP]] for r in rows[::STEP]])
    filled = [y for y, r in enumerate(mask) if any(r)]
    top, bottom = filled[0], filled[-1]
    if shown is None:
        shown = framing(mask) if bottom == len(mask) - 1 else 1.0
    return mask[top : bottom + 1], shown


def loops(mask):
    """Closed pixel-edge boundaries of the mask (outer edges and holes)."""
    h, w = len(mask), len(mask[0])
    inside = lambda x, y: 0 <= y < h and 0 <= x < w and mask[y][x]
    nxt = {}
    for y in range(h):
        for x in range(w):
            if not mask[y][x]:
                continue
            for dx, dy, a, b in ((0, -1, (x, y), (x + 1, y)), (1, 0, (x + 1, y), (x + 1, y + 1)),
                                 (0, 1, (x + 1, y + 1), (x, y + 1)), (-1, 0, (x, y + 1), (x, y))):
                if not inside(x + dx, y + dy):
                    nxt.setdefault(a, []).append(b)
    out = []
    while nxt:
        start = next(iter(nxt))
        loop, p = [start], start
        while True:
            q = nxt[p].pop()
            if not nxt[p]:
                del nxt[p]
            if q == start:
                break
            loop.append(q)
            p = q
        out.append(loop)
    return out


def simplify(points, eps):
    """Ramer-Douglas-Peucker on an open polyline, without recursion."""
    keep = {0, len(points) - 1}
    stack = [(0, len(points) - 1)]
    while stack:
        i, j = stack.pop()
        (x1, y1), (x2, y2) = points[i], points[j]
        dx, dy = x2 - x1, y2 - y1
        norm = (dx * dx + dy * dy) ** 0.5 or 1
        best, k = 0, None
        for m in range(i + 1, j):
            x, y = points[m]
            d = abs(dy * (x - x1) - dx * (y - y1)) / norm if (dx or dy) else ((x - x1) ** 2 + (y - y1) ** 2) ** 0.5
            if d > best:
                best, k = d, m
        if k is not None and best > eps:
            keep.add(k)
            stack += [(i, k), (k, j)]
    return [points[m] for m in sorted(keep)]


def area(loop):
    return abs(sum(x1 * y2 - x2 * y1 for (x1, y1), (x2, y2) in zip(loop, loop[1:] + loop[:1]))) / 2


def runs(loop, cut):
    """The loop as open polylines, leaving out edges along the frame's bottom edge."""
    on_cut = [loop[i][1] == cut and loop[(i + 1) % len(loop)][1] == cut for i in range(len(loop))]
    if not any(on_cut):
        return [loop + loop[:1]]
    first = next(i for i in range(len(loop)) if on_cut[i - 1] and not on_cut[i])
    out, run = [], []
    for k in range(len(loop)):
        i = (first + k) % len(loop)
        if on_cut[i]:
            if run:
                out.append(run + [loop[i]])
            run = []
        else:
            run.append(loop[i])
    if run:
        out.append(run + [loop[first]])
    return out


def outline(rows, shown=None):
    """An SVG path with the head at y 0 and the floor at y FIG, centred on x 0; where the photo stops (FIG when whole);
    and where the arms join (see arms)."""
    mask, shown = body(rows, shown)
    xs = [x for r in mask for x, v in enumerate(r) if v]
    cx, s = sum(xs) / len(xs), FIG * shown / len(mask)
    parts = []
    for loop in loops(mask):
        if area(loop) < 0.002 * len(mask) * len(mask[0]):
            continue  # specks and slivers
        for run in runs(loop, len(mask) if shown < 1 else None):
            pts = simplify(run, EPSILON)
            closed = pts[0] == pts[-1]
            pts = pts[:-1] if closed else pts
            parts.append("M" + "L".join(f"{round((x - cx) * s, 1):g} {round(y * s, 1):g}" for x, y in pts) + ("Z" if closed else ""))
    return "".join(parts), round(FIG * shown, 1), arms(mask, s, cx)


def fetch(url):
    time.sleep(DELAY)
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read()


def cutout(fighter_id, ufc_slug, offline=False):
    """The cached full-body PNG, downloading it once unless offline. None when there is none."""
    png, none = CACHE / f"{fighter_id}.png", CACHE / f"{fighter_id}.none"
    if png.exists():
        return png.read_bytes()
    if none.exists() or offline:
        return None
    page = fetch(f"https://www.ufc.com/athlete/{ufc_slug}").decode("utf-8", "replace")
    m = FULL_BODY.search(page)
    if not m:
        none.touch()
        return None
    data = fetch(m.group(0).replace("&amp;", "&"))
    png.write_bytes(data)
    return data


def main():
    CACHE.mkdir(exist_ok=True)
    # Two runs at once double the request rate, and ufc.com answers that with 403s.
    lock = CACHE / "lock"
    try:
        lock.touch(exist_ok=False)
    except FileExistsError:
        print(f"Another run holds {lock}; delete it if none is going.", file=sys.stderr)
        return 1
    try:
        with open(ROOT / "pipeline" / "roster.csv", newline="", encoding="utf-8-sig") as f:
            roster = list(csv.DictReader(f))
        out, offline = {}, "--offline" in sys.argv
        with open(ROOT / "pipeline" / "open_photos.csv", newline="", encoding="utf-8") as f:
            judged = {parse.slug(r["name"]): float(r["shown"]) for r in csv.DictReader(f)}  # Commons photos, see open_photos.py
        for n, r in enumerate(roster, 1):
            fighter_id = parse.slug(r["name"])
            try:
                data = cutout(fighter_id, r["ufc_slug"], offline)
                if data:
                    d, cut, (sy, sl, sr) = outline(read_alpha(data), judged.get(fighter_id))
                    out[fighter_id] = {"d": d, "cut": cut, "sy": sy, "sl": sl, "sr": sr}
                print(f"{n}/{len(roster)} {fighter_id}: {'traced' if data else 'no cutout'}", flush=True)
            except urllib.error.HTTPError as e:
                if e.code in (403, 429):  # refused: stop asking, but trace what is cached
                    print(f"ufc.com refused ({e.code}); no more downloads this run.", file=sys.stderr, flush=True)
                    offline = True
                print(f"{n}/{len(roster)} {fighter_id}: skipped ({e})", file=sys.stderr, flush=True)
            except Exception as e:  # one bad page or image must not lose the rest
                print(f"{n}/{len(roster)} {fighter_id}: skipped ({e})", file=sys.stderr, flush=True)
        OUT.write_text(json.dumps(out, indent=0, sort_keys=True) + "\n", encoding="utf-8")
        print(f"Wrote {len(out)} outlines to {OUT.relative_to(ROOT)}")
        return 0
    finally:
        lock.unlink()


if __name__ == "__main__":
    sys.exit(main())
