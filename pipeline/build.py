"""Download the ufcstats CSVs, derive metrics, and write the site's data.

Reads roster.csv and shipped.json. Writes web/data/fighters.json,
web/data/metrics.json and a report. Spec sections 5 and 11.
"""
import csv
import io
import json
import sys
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


class BuildError(Exception):
    pass


def read_csvs(base_url):
    out = {}
    for name in FILES:
        with urllib.request.urlopen(f"{base_url}{name}.csv", timeout=60) as resp:
            out[name] = list(csv.DictReader(io.StringIO(resp.read().decode("utf-8"), newline="")))
    return out


def build(rows, roster, shipped, today, image_dir, min_eligible=30):
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
            "hasImage": (image_dir / f"{fighter_id}.png").exists(),
            "metrics": values,
        })

    stats = {}
    for metric_id, (_, unit, _, scale, _) in metrics.CANDIDATES.items():
        pool = [v[metric_id] for v in per_fighter if metric_id in v]
        if pool:  # summarize and slider raise on an empty pool
            stats[metric_id] = (metrics.summarize(pool, scale), metrics.slider(pool, scale, unit))

    metrics_out = []
    for metric_id in shipped["ship"]:
        if metric_id not in metrics.CANDIDATES:
            raise BuildError(f"Unknown metric {metric_id} in shipped.json.")
        summary, (lo, hi) = stats.get(metric_id, ({"n": 0, "step": 0}, (0, 0)))
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

    for f in fighters:
        f["metrics"] = {m: metrics.round_value(m, f["metrics"][m]) for m in shipped["ship"] if m in f["metrics"]}

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
        fighters, metrics_out, report = build(read_csvs(SOURCE), roster, shipped, date.today(),
                                              ROOT / "web/public/img/fighters")
        old_file = ROOT / "web" / "data" / "fighters.json"
        validate(json.loads(old_file.read_text(encoding="utf-8")) if old_file.exists() else None,
                 fighters, shipped)
    except (BuildError, OSError, ValueError) as e:
        print(e, file=sys.stderr)
        return 1
    out = ROOT / "web" / "data"
    out.mkdir(parents=True, exist_ok=True)
    for name, data in (("fighters.json", fighters), ("metrics.json", metrics_out)):
        (out / name).write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    (ROOT / "pipeline" / "report.txt").write_text(report, encoding="utf-8")
    print(report, end="")
    print(f"Wrote {len(fighters)} fighters, {len(metrics_out)} metrics")
    return 0


if __name__ == "__main__":
    sys.exit(main())
