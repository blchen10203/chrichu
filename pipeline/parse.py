"""Parsers for the raw ufcstats-style string fields. "--" or blank means missing."""
import re
from datetime import datetime


def height_in(s):
    m = re.fullmatch(r"(\d+)'\s*(\d+)\"?", s.strip())
    return int(m[1]) * 12 + int(m[2]) if m else None


def reach_in(s):
    m = re.fullmatch(r"(\d+(?:\.\d+)?)\"?", s.strip())
    return float(m[1]) if m else None


def of(s):
    m = re.fullmatch(r"(\d+) of (\d+)", s.strip())
    return (int(m[1]), int(m[2])) if m else (0, 0)


def seconds(s):
    m = re.fullmatch(r"(\d+):(\d+)", s.strip())
    return int(m[1]) * 60 + int(m[2]) if m else 0


def iso_date(s):
    s = s.strip()
    for fmt in ("%b %d, %Y", "%B %d, %Y"):
        try:
            return datetime.strptime(s, fmt).date().isoformat()
        except ValueError:
            pass
    return None


def fight_seconds(round_, time, time_format):
    m = re.search(r"\(([\d-]+)\)", time_format.strip())
    lengths = [int(n) for n in m[1].split("-")] if m else []
    return sum(lengths[: int(round_.strip()) - 1]) * 60 + seconds(time)


def fighter_id(url):
    return url.strip().rstrip("/").rsplit("/", 1)[-1]


def slug(name):
    return re.sub(r"[^a-z0-9]+", "-", name.strip().lower()).strip("-")
