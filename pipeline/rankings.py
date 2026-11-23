"""Scrape the official, media-voted UFC rankings into web/data/rankings.json.

Usage: python pipeline/rankings.py   (exits 1 without writing if the page did not parse as expected)
"""
import csv
import json
import os
import re
import sys
from datetime import datetime, timezone

import requests
from bs4 import BeautifulSoup
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

import build
import parse

URL = "https://www.ufc.com/rankings"
OUT = build.ROOT / "web" / "data" / "rankings.json"
MIN_DIVISIONS = 10
MIN_RANKED = 5
# The page also holds UFC's algorithmic "meta" rankings in a block like this one, with the same headers.
MEDIA_BLOCK = ".block-views-blockathlete-rankings-block-1"


class RankingsError(Exception):
    pass


def fetch(url):
    session = requests.Session()
    session.mount("https://", HTTPAdapter(max_retries=Retry(total=3, backoff_factor=2,
                                                            status_forcelist=(429, 500, 502, 503, 504))))
    resp = session.get(url, headers={"User-Agent": "Mozilla/5.0 (compatible; reachdle-rankings/1.0)"}, timeout=30)
    resp.raise_for_status()
    return resp.text


def fighter(a):
    return {"name": a.get_text(" ", strip=True), "slug": a["href"].rstrip("/").rsplit("/", 1)[-1]}


def change(td):
    text = td.get_text(" ", strip=True) if td else ""
    if m := re.search(r"(increased|decreased) by (\d+)", text):
        return ("+" if m[1] == "increased" else "-") + m[2]
    return text or None  # "NR" for newly ranked


def parse_page(html):
    soup = BeautifulSoup(html, "html.parser")
    # The media footers also include a "How are rankings determined?" link; the meta list has its own date.
    footers = " ".join(f.get_text(" ", strip=True) for f in soup.select('[data-rankings-footer="media"]'))
    m = re.search(r"updated:\s*(\w+, \w+\.? \d+)", footers)
    divisions, seen = [], set()
    for group in soup.select(f"{MEDIA_BLOCK} .view-grouping"):
        header = group.select_one(".view-grouping-header")
        if not header:
            continue
        name = re.sub(r"\s*Top Rank$", "", header.get_text(" ", strip=True))
        if name in seen:  # the same list in a second layout
            continue
        seen.add(name)
        champ = group.select_one(".rankings--athlete--champion h5 a") or group.select_one(".info h5 a")
        ranked = []
        for tr in group.select("tbody tr"):
            tds, link = tr.find_all("td"), tr.select_one("td.views-field-title a")
            rank = re.search(r"\d+", tds[0].get_text()) if tds else None
            if not (rank and link):
                raise RankingsError(f"{name}: a row without a rank number or fighter link.")
            ranked.append({"rank": int(rank[0]), **fighter(link), "change": change(tds[2] if len(tds) > 2 else None)})
        divisions.append({"division": name, "is_p4p": "Pound-for-Pound" in name,
                          "champion": fighter(champ) if champ else None, "ranked": ranked})
    return (m[1] if m else None), divisions


def check(divisions):
    if len(divisions) < MIN_DIVISIONS:
        raise RankingsError(f"Only {len(divisions)} divisions parsed, need {MIN_DIVISIONS}: has the page changed?")
    for d in divisions:
        if len(d["ranked"]) < MIN_RANKED:
            raise RankingsError(f"{d['division']}: only {len(d['ranked'])} fighters parsed, need {MIN_RANKED}.")
        if not d["champion"] and not d["is_p4p"]:
            print(f"Warning: {d['division']} has no champion (vacant belt?).", file=sys.stderr)


def match(divisions, roster):
    """Set each entry's id to our fighter id: by UFC slug, then by normalized name. Returns the misses."""
    by_slug, by_name = {}, {}
    for r in roster:
        fid = parse.slug(r["name"])
        by_slug[r["ufc_slug"]] = by_slug[fid] = fid
        by_name[build.name_key(r["name"])] = fid
    missed = []
    for d in divisions:
        for f in ([d["champion"]] if d["champion"] else []) + d["ranked"]:
            f["id"] = by_slug.get(f["slug"]) or by_name.get(build.name_key(f["name"]))
            if not f["id"]:
                missed.append(f"{d['division']}: {f['name']} ({f['slug']})")
    return list(dict.fromkeys(missed))  # a P4P #1 is listed as champion and as rank 1


def main():
    sys.stdout.reconfigure(encoding="utf-8")  # names like Jiří Procházka on a Windows console
    try:
        last_updated, divisions = parse_page(fetch(URL))
        check(divisions)
    except (RankingsError, requests.RequestException) as e:
        print(e, file=sys.stderr)
        return 1
    with open(build.ROOT / "pipeline" / "roster.csv", newline="", encoding="utf-8-sig") as f:
        missed = match(divisions, list(csv.DictReader(f)))

    print(f"{len(divisions)} divisions, last updated {last_updated}")
    for d in divisions:
        champ = d["champion"]["name"] if d["champion"] else "vacant"
        print(f"  {d['division']:<32}{len(d['ranked']):>3} ranked   {'#1' if d['is_p4p'] else 'C'}: {champ}")
    print(f"{len(missed)} ranked fighters are not in our fighter data:")
    print("\n".join(f"  {m}" for m in missed))

    old = json.loads(OUT.read_text(encoding="utf-8")) if OUT.exists() else {}
    if old.get("divisions") == divisions and old.get("last_updated") == last_updated:
        print("Rankings unchanged; not rewriting.")
        return 0
    data = {"source": URL, "fetched_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "last_updated": last_updated, "divisions": divisions}
    tmp = OUT.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    os.replace(tmp, OUT)  # atomic: a crash never leaves a half-written file
    print(f"Wrote {OUT.relative_to(build.ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
