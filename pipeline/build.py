"""Download the ufcstats CSVs, derive metrics, and write the site's data.

Reads roster.csv and shipped.json. Writes web/data/fighters.json,
web/data/metrics.json and a report. Spec sections 5 and 11.
"""
import csv
import html
import io
import json
import re
import sys
import time
import unicodedata
import urllib.request
from datetime import date
from pathlib import Path

import derive
import metrics
import parse

ROOT = Path(__file__).resolve().parent.parent
SOURCE = "https://raw.githubusercontent.com/Greco1899/scrape_ufc_stats/main/"
MIN_FIGHTERS = 150
MAX_CHANGED = 0.15
FILES = ("ufc_fighter_tott", "ufc_event_details", "ufc_fight_results", "ufc_fight_stats")
# The current UFC roster, for the site's active-only setting: Wikipedia's list, whose API lets build servers in
# (roster.watch, which agrees on all but a fighter or two, refuses GitHub's).
ROSTER_URL = ("https://en.wikipedia.org/w/api.php?action=parse&page=List_of_current_UFC_fighters"
              "&prop=wikitext&format=json&formatversion=2")
MIN_ACTIVE = 300  # it lists ~650; far fewer means the page changed, not the roster
# Letters NFKD does not split into a base letter and an accent.
PLAIN = str.maketrans("łŁøØđĐ", "lLoOdD")


class BuildError(Exception):
    pass


def get(url, ua="reachdle-build/1.0 (python-urllib)", tries=3):
    """The body at url, asking again after a busy server (429, 5xx) or a dropped connection."""
    for n in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": ua}), timeout=60) as resp:
                return resp.read()
        except OSError as e:  # HTTPError (has a code), URLError, timeouts
            if n == tries - 1 or getattr(e, "code", 503) not in (429, 500, 502, 503, 504):
                raise
            time.sleep(2 ** (n + 1))


def name_key(name):
    """A name without accents, case or punctuation, so "Jan Błachowicz" and "Jan Blachowicz" match."""
    return parse.slug(unicodedata.normalize("NFKD", name.translate(PLAIN)).encode("ascii", "ignore").decode())


def roster_name(cell):
    """The fighter's name from the table cell after the flag: {{sortname|First|Last}}, [[Link|Name]] or plain."""
    if m := re.match(r"\{\{sortname\|([^|}]*)\|([^|}]*)", cell):
        return f"{m[1]} {m[2]}"
    if m := re.match(r"\[\[(?:[^|\]]*\|)?([^\]]*)\]\]", cell):
        return m[1]
    return re.split(r"\s*(?:\(|'''|<|\{\{)", cell)[0]  # drop a trailing (c) or note


def read_active(url):
    text = json.loads(get(url, "roster-build/1.0 (python-urllib)").decode("utf-8"))["parse"]["wikitext"]
    # Only the weight-class tables: the page also lists recent releases, retirements and unsigned signings.
    text = text[text.index("==Debuted fighters=="):text.index("==See also==")]
    # Each fighter row starts with their flag (two for dual nationals), then their name.
    cells = re.findall(r"^\|\{\{#invoke:flag\|icon[^\n]*\n\|([^\n]*)", text, re.M)
    active = {name_key(html.unescape(roster_name(c.strip()))) for c in cells}
    if len(active) < MIN_ACTIVE:
        raise BuildError(f"Only {len(active)} fighters in the Wikipedia roster, need {MIN_ACTIVE}: has the page changed?")
    return active


def ranked_additions(rows, roster, divisions):
    """Roster rows for ranked fighters (from rankings.json) not on the roster, when exactly one ufcstats fighter
    matches and has fights. They get daily=0: the Daily draws by position in the fighter list, so a new fighter
    in its pool would change every future puzzle. Returns (added rows, skipped descriptions)."""
    have = {r["ufc_slug"] for r in roster} | {name_key(r["name"]) for r in roster}
    fought = {n.strip() for r in rows["ufc_fight_results"] for n in " ".join(r["BOUT"].split()).split(" vs. ")}
    by_key = {}
    for t in rows["ufc_fighter_tott"]:
        by_key.setdefault(name_key(t["FIGHTER"]), []).append(t)
    added, skipped = [], []
    for d in divisions:
        for f in ([d["champion"]] if d["champion"] else []) + d["ranked"]:
            keys = {name_key(f["name"]), f["slug"]}  # ufc.com slugs often carry the ufcstats name: patricio-freire
            if keys & have:
                continue
            have |= keys
            # Rows, not ids: build() rejects a name that appears twice in the fighter file.
            matches = list({id(t): t for k in keys for t in by_key.get(k, [])}.values())
            name = matches[0]["FIGHTER"].strip() if len(matches) == 1 else None
            if name and name_key(name) in have - keys:
                continue  # on the roster under the ufcstats spelling
            if not name or name not in fought:
                skipped.append(f"{f['name']} ({f['slug']}): {len(matches)} ufcstats matches"
                               + ("" if not name else ", no fights"))
                continue
            added.append({"name": name, "ufcstats_id": parse.fighter_id(matches[0]["URL"]), "ufc_slug": f["slug"],
                          "deceased": "0", "daily": "0"})
            have.add(name_key(name))
    return added, skipped


def read_csvs(base_url):
    out = {}
    for name in FILES:
        out[name] = list(csv.DictReader(io.StringIO(get(f"{base_url}{name}.csv").decode("utf-8"), newline="")))
    return out


def build(rows, roster, shipped, today, image_dir, min_eligible=30, *, active=frozenset()):
    if not roster:
        raise BuildError("The roster is empty.")
    names = [r["name"] for r in roster]
    for name in set(names):
        if names.count(name) > 1:
            raise BuildError(f"{name} is in the roster twice.")

    tott = rows["ufc_fighter_tott"]
    fights = derive.fights_by_fighter(rows["ufc_fight_results"], rows["ufc_fight_stats"], rows["ufc_event_details"])
    fighters, per_fighter, differs = [], [], []
    for r in roster:
        name = r["name"]
        mine = [t for t in tott if parse.fighter_id(t["URL"]) == r["ufcstats_id"]]
        if not mine:
            raise BuildError(f"{name}: id {r['ufcstats_id']} is not in the fighter file.")
        t = mine[0]
        if any(o["FIGHTER"].strip() in (name, t["FIGHTER"].strip()) and o is not t for o in tott):
            raise BuildError(f"{name}: another fighter has the same name, so their fights cannot be told apart.")
        if name not in fights:
            raise BuildError(f"{name}: no fights found under this name.")
        if parse.slug(t["FIGHTER"]) != parse.slug(name):
            differs.append(f"{name} -> {t['FIGHTER'].strip()}")
        dob = parse.iso_date(t["DOB"])
        if r["deceased"].strip() not in ("0", "1"):
            raise BuildError(f"{name}: deceased must be 0 or 1, not {r['deceased']!r}.")
        deceased = r["deceased"].strip() == "1"
        fighter_id = parse.slug(name)
        values = derive.metrics_for(fights[name], parse.height_in(t["HEIGHT"]), parse.reach_in(t["REACH"]),
                                    dob, deceased, today)
        per_fighter.append(values)
        fighters.append({
            "id": fighter_id, "name": name, "dob": dob,
            "active": name_key(name) in active,  # on the current UFC roster
            "daily": r.get("daily", "1").strip() != "0",  # in the Daily's pool; see ranked_additions
            "hasImage": (image_dir / f"{fighter_id}.webp").exists(),
            "metrics": values,
        })

    # Ranges and steps come from the Daily's pool only: they decide its rounds and scores, so adding a
    # non-Daily fighter must not move them.
    stats = {}
    daily_values = [v for v, f in zip(per_fighter, fighters) if f["daily"]]
    for metric_id, (_, unit, _, scale, _) in metrics.CANDIDATES.items():
        pool = [v[metric_id] for v in daily_values if metric_id in v]
        if pool:  # summarize and slider raise on an empty pool
            stats[metric_id] = (metrics.summarize(pool, scale), metrics.slider(pool, scale, unit))

    metrics_out = []
    for metric_id in shipped["ship"]:
        if metric_id not in metrics.CANDIDATES:
            raise BuildError(f"Unknown metric {metric_id} in shipped.json.")
        summary, (lo, hi) = stats.get(metric_id, ({"n": 0, "step": 0}, (0, 0)))
        # A range override widens the slider past the data, so a guess can go well off either end.
        lo, hi = shipped.get("range", {}).get(metric_id, (lo, hi))
        if not all(isinstance(x, (int, float)) and not isinstance(x, bool) for x in (lo, hi)) or lo >= hi:
            raise BuildError(f"{metric_id}: range override must be two numbers, low then high.")
        step = shipped.get("step", {}).get(metric_id, summary["step"])
        if metric_id in shipped.get("step", {}) and (isinstance(step, bool) or not isinstance(step, (int, float)) or step <= 0):
            raise BuildError(f"{metric_id}: step override must be a number greater than 0.")
        if summary["n"] < min_eligible:
            raise BuildError(f"{metric_id}: {summary['n']} eligible fighters, need {min_eligible}.")
        if step == 0:
            raise BuildError(f"{metric_id}: step is 0, the fighters do not differ.")
        label, unit, round_, scale, snap = metrics.CANDIDATES[metric_id]
        metrics_out.append({"id": metric_id, "label": label, "unit": unit, "round": round_, "scale": scale,
                            "snap": snap, "min": round(lo, 4), "max": round(hi, 4), "step": round(step, 4)})

    ranges = {m["id"]: (m["min"], m["max"]) for m in metrics_out}
    for f in fighters:
        # A non-Daily fighter off the slider's scale could never be guessed, so they skip that metric.
        f["metrics"] = {m: metrics.round_value(m, f["metrics"][m]) for m in shipped["ship"] if m in f["metrics"]
                        and (f["daily"] or ranges[m][0] <= f["metrics"][m] <= ranges[m][1])}

    lines = [f"Metric report {today.isoformat()}, {len(fighters)} fighters",
             f"{'metric':<15}{'n':>4}{'min':>10}{'median':>10}{'max':>10}{'sd':>10}{'step':>10}"]
    for metric_id in metrics.CANDIDATES:
        line = f"{metric_id:<15}"
        if metric_id in stats:
            s = stats[metric_id][0]
            line += f"{s['n']:>4}" + "".join(f"{s[k]:>10.3f}" for k in ("min", "median", "max", "sd", "step"))
        else:
            line += f"{0:>4}"
        lines.append(line + ("  SHIP" if metric_id in shipped["ship"] else ""))
    if differs:
        lines += ["", "Name differs from fighter file (check the id):"] + differs
    return fighters, metrics_out, "\n".join(lines) + "\n"


def validate(old, new, shipped):
    if len(new) < MIN_FIGHTERS:
        raise BuildError(f"Only {len(new)} fighters, need {MIN_FIGHTERS}.")
    if old is None:
        return
    now = {f["id"]: f["metrics"] for f in new}
    pairs = [(f["id"], m, v) for f in old if f["id"] in now
             for m, v in f["metrics"].items() if m in shipped["ship"]]
    changed = sum(now[i].get(m) != v for i, m, v in pairs)
    if pairs and changed / len(pairs) > MAX_CHANGED:
        raise BuildError(f"{changed / len(pairs):.1%} of values changed since the last build (limit 15%). "
                         "If this is expected, delete web/data/fighters.json and run the build again.")


def main():
    try:
        with open(ROOT / "pipeline" / "roster.csv", newline="", encoding="utf-8-sig") as f:
            roster = list(csv.DictReader(f))
        shipped = json.loads((ROOT / "pipeline" / "shipped.json").read_text(encoding="utf-8"))
        old_file = ROOT / "web" / "data" / "fighters.json"
        old = json.loads(old_file.read_text(encoding="utf-8")) if old_file.exists() else None
        try:
            active = read_active(ROSTER_URL)
        except (BuildError, OSError, ValueError) as e:
            # A failed or changed roster page must not stop the data update: keep the last build's flags.
            print(f"Roster not read ({e}); keeping the previous active flags.", file=sys.stderr)
            active = {name_key(f["name"]) for f in old or [] if f.get("active")}
        rows = read_csvs(SOURCE)
        rankings_file = ROOT / "web" / "data" / "rankings.json"
        divisions = json.loads(rankings_file.read_text(encoding="utf-8"))["divisions"] if rankings_file.exists() else []
        added, skipped = ranked_additions(rows, roster, divisions)
        roster += added
        # Ranked means on the UFC roster, whatever Wikipedia calls them.
        ranked_slugs = {f["slug"] for d in divisions for f in [d["champion"] or {}, *d["ranked"]] if f}
        active |= {name_key(r["name"]) for r in roster if r["ufc_slug"] in ranked_slugs}
        fighters, metrics_out, report = build(rows, roster, shipped, date.today(),
                                              ROOT / "web/public/img/fighters", active=active)
        validate(old, fighters, shipped)
    except (BuildError, OSError, ValueError) as e:
        print(e, file=sys.stderr)
        return 1
    out = ROOT / "web" / "data"
    out.mkdir(parents=True, exist_ok=True)
    for name, data in (("fighters.json", fighters), ("metrics.json", metrics_out)):
        (out / name).write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    (ROOT / "pipeline" / "report.txt").write_text(report, encoding="utf-8")
    if added:
        with open(ROOT / "pipeline" / "roster.csv", "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, ["name", "ufcstats_id", "ufc_slug", "deceased", "daily"], restval="1",
                               lineterminator="\n")
            w.writeheader()
            w.writerows(roster)
    print(report, end="")
    print("".join(f"Added from the rankings (not in the Daily): {r['name']}\n" for r in added), end="")
    print("".join(f"Ranked but not added: {s}\n" for s in skipped), end="")
    print(f"Wrote {len(fighters)} fighters, {len(metrics_out)} metrics")
    return 0


if __name__ == "__main__":
    sys.exit(main())
