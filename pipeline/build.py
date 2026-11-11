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
FILES = ("ufc_fighter_tott", "ufc_event_details", "ufc_fight_results", "ufc_fight_stats")


class BuildError(Exception):
    pass


def read_csvs(base_url):
    out = {}
    for name in FILES:
        with urllib.request.urlopen(f"{base_url}{name}.csv") as resp:
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
    fighters, per_fighter = [], []
    for r in roster:
        name = r["name"]
        mine = [t for t in tott if parse.fighter_id(t["URL"]) == r["ufcstats_id"]]
        if not mine:
            raise BuildError(f"{name}: id {r['ufcstats_id']} is not in the fighter file.")
        if any(t["FIGHTER"].strip() == name and t is not mine[0] for t in tott):
            raise BuildError(f"{name}: another fighter has the same name, so their fights cannot be told apart.")
        if name not in fights:
            raise BuildError(f"{name}: no fights found under this name.")
        t = mine[0]
        dob = parse.iso_date(t["DOB"])
        deceased = r["deceased"] == "1"
        fighter_id = parse.slug(name)
        values = derive.metrics_for(fights[name], parse.height_in(t["HEIGHT"]), parse.reach_in(t["REACH"]),
                                    dob, deceased, today)
        per_fighter.append(values)
        fighters.append({
            "id": fighter_id, "name": name, "dob": dob, "deceased": deceased,
            "hasImage": (image_dir / f"{fighter_id}.png").exists(),
            "trackedFights": sum(f["tracked"] for f in fights[name]),
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
        step = shipped["step"].get(metric_id, summary["step"])
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
    return fighters, metrics_out, "\n".join(lines) + "\n"


def main():
    try:
        with open(ROOT / "pipeline" / "roster.csv", newline="", encoding="utf-8") as f:
            roster = list(csv.DictReader(f))
        shipped = json.loads((ROOT / "pipeline" / "shipped.json").read_text(encoding="utf-8"))
        fighters, metrics_out, report = build(read_csvs(SOURCE), roster, shipped, date.today(),
                                              ROOT / "web/public/img/fighters")
    except (BuildError, OSError) as e:
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
