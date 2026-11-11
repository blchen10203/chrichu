"""Per-fighter career metrics derived from the raw results/stats/events rows."""
from datetime import date

import parse

KEYS = ("kd", "sig", "sig_att", "td", "td_att", "sub", "ctrl", "head", "body", "leg")
KO_METHODS = ("KO/TKO", "TKO - Doctor's Stoppage")


def _count(s):
    s = s.strip()
    return int(float(s)) if s else 0


def _totals(rows):
    t = dict.fromkeys(KEYS, 0)
    for r in rows:
        sig, sig_att = parse.of(r["SIG.STR."])
        td, td_att = parse.of(r["TD"])
        for key, n in (("kd", _count(r["KD"])), ("sig", sig), ("sig_att", sig_att), ("td", td),
                       ("td_att", td_att), ("sub", _count(r["SUB.ATT"])), ("ctrl", parse.seconds(r["CTRL"])),
                       ("head", parse.of(r["HEAD"])[0]), ("body", parse.of(r["BODY"])[0]),
                       ("leg", parse.of(r["LEG"])[0])):
            t[key] += n
    return t


def unique_fights(results, events):
    """Result rows with each fight URL once, preferring the copy whose event has a date."""
    dated = {e["EVENT"].strip() for e in events if parse.iso_date(e["DATE"])}
    seen, out = set(), []
    for r in sorted(results, key=lambda r: r["EVENT"].strip() not in dated):
        url = (r.get("URL") or "").strip()
        if url and url in seen:
            continue
        seen.add(url)
        out.append(r)
    return out


def fights_by_fighter(results, stats, events):
    dates = {e["EVENT"].strip(): parse.iso_date(e["DATE"]) for e in events}
    rows = {}
    for r in stats:
        rows.setdefault((r["EVENT"].strip(), " ".join(r["BOUT"].split())), []).append(r)

    out = {}
    for res in unique_fights(results, events):
        event, bout = res["EVENT"].strip(), " ".join(res["BOUT"].split())
        names = bout.split(" vs. ")
        outcomes = res["OUTCOME"].strip().split("/")
        side_rows = [[r for r in rows.get((event, bout), []) if r["FIGHTER"].strip() == n] for n in names]
        for i, name in enumerate(names):
            out.setdefault(name, []).append({
                "date": dates.get(event),
                "outcome": outcomes[i].strip(),
                "method": res["METHOD"].strip(),
                "seconds": parse.fight_seconds(res["ROUND"], res["TIME"], res["TIME FORMAT"]),
                "tracked": bool(side_rows[i]),
                "mine": _totals(side_rows[i]),
                "theirs": _totals(side_rows[1 - i]),
            })
    return out


def _years(dob, on):
    d = date.fromisoformat(dob)
    return on.year - d.year - ((on.month, on.day) < (d.month, d.day))


def metrics_for(fights, height, reach, dob, deceased, today):
    m = {}
    tracked = [f for f in fights if f["tracked"]]
    mine = {k: sum(f["mine"][k] for f in tracked) for k in KEYS}
    theirs = {k: sum(f["theirs"][k] for f in tracked) for k in KEYS}
    minutes = sum(f["seconds"] for f in tracked) / 60
    wins = sum(f["outcome"] == "W" for f in fights)
    ko = sum(f["outcome"] == "W" and f["method"] in KO_METHODS for f in fights)
    sub = sum(f["outcome"] == "W" and f["method"] == "Submission" for f in fights)
    cage = sum(f["seconds"] for f in fights) / 60

    if height is not None:
        m["height"] = height
    if reach is not None:
        m["reach"] = reach
    if dob and not deceased:
        m["age"] = _years(dob, today)
    dated = [f["date"] for f in fights if f["date"]]
    if dob and dated:
        m["debut_age"] = _years(dob, date.fromisoformat(min(dated)))

    if len(tracked) >= 5:
        landed_by_target = mine["head"] + mine["body"] + mine["leg"]
        rates = {
            "slpm": (mine["sig"], minutes), "sapm": (theirs["sig"], minutes),
            "str_acc": (100 * mine["sig"], mine["sig_att"]),
            "str_def": (100 * (theirs["sig_att"] - theirs["sig"]), theirs["sig_att"]),
            "head_pct": (100 * mine["head"], landed_by_target),
            "body_pct": (100 * mine["body"], landed_by_target),
            "leg_pct": (100 * mine["leg"], landed_by_target),
            "td_avg": (15 * mine["td"], minutes), "sub_avg": (15 * mine["sub"], minutes),
            "td_acc": (100 * mine["td"], mine["td_att"]),
            "td_def": (100 * (theirs["td_att"] - theirs["td"]), theirs["td_att"]),
            "td_per_fight": (mine["td"], len(tracked)),
        }
        m.update({k: n / d for k, (n, d) in rates.items() if d})
    if mine["td"] >= 3 and minutes / mine["td"] >= 1:
        m["min_per_td"] = minutes / mine["td"]
    if mine["sig"] >= 1:
        m["career_sig"], m["knockdowns"] = mine["sig"], mine["kd"]
    if mine["ctrl"] / 60 >= 1:
        m["control_time"] = mine["ctrl"] / 60

    m["ufc_fights"], m["ufc_wins"], m["ko_wins"], m["sub_wins"] = len(fights), wins, ko, sub
    decided = sum(f["outcome"] != "NC" for f in fights)
    if len(fights) >= 5 and decided:
        m["win_pct"] = 100 * wins / decided
    if wins >= 5:
        m["finish_rate"] = 100 * (ko + sub) / wins
    if cage >= 1:
        m["cage_time"] = cage
    if len(fights) >= 5 and cage >= 1:
        m["avg_fight_len"] = cage / len(fights)
    return m
