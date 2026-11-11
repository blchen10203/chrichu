"""Drafts pipeline/roster.csv: the most-fought, title-fight-heavy names from the dataset.

Usage: py pipeline/draft_roster.py   (refuses to overwrite a roster that has data rows)
"""
import csv
from collections import Counter

import build
import derive
import parse

FIELDS = ["name", "ufcstats_id", "ufc_slug", "deceased"]


def draft(rows, limit=250):
    titles, fights = Counter(), Counter()
    for r in derive.unique_fights(rows["ufc_fight_results"], rows["ufc_event_details"]):
        title = "Title" in r["WEIGHTCLASS"].strip()
        for name in r["BOUT"].split(" vs. "):
            name = name.strip()
            fights[name] += 1
            titles[name] += title
    ids = {}
    for r in rows["ufc_fighter_tott"]:
        ids.setdefault(r["FIGHTER"].strip(), []).append(parse.fighter_id(r["URL"]))
    ranked = sorted(fights, key=lambda n: (-titles[n], -fights[n], n))[:limit]
    return [{"name": n,
             "ufcstats_id": ids[n][0] if len(ids.get(n, [])) == 1 else "",
             "ufc_slug": parse.slug(n),
             "deceased": "0"} for n in ranked]


def main():
    path = build.ROOT / "pipeline" / "roster.csv"
    if path.exists():
        with open(path, newline="", encoding="utf-8-sig") as f:
            if any(csv.DictReader(f)):
                print(f"{path} already has fighters; not overwriting it.")
                return 1
    drafted = draft(build.read_csvs(build.SOURCE))
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, FIELDS)
        w.writeheader()
        w.writerows(drafted)
    print(f"Drafted {len(drafted)} fighters into {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
