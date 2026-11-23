import functools
import json
from datetime import date
from pathlib import Path

import pytest

import build
import derive
import metrics

DATA = (Path(__file__).parent / "data").as_uri() + "/"
TODAY = date(2026, 11, 11)
A = {"name": "A One", "ufcstats_id": "aaaa", "ufc_slug": "a-one", "deceased": "0"}
B = {"name": "B Two", "ufcstats_id": "bbbb", "ufc_slug": "b-two", "deceased": "0"}
SHIP = {"ship": ["height", "reach"], "step": {}}


@pytest.fixture(autouse=True)
def offline_roster(monkeypatch):
    """main() never reaches Wikipedia in tests: A One is on the roster, B Two is not."""
    monkeypatch.setattr(build, "read_active", lambda url: {"a-one"})


def run(roster=(A, B), shipped=SHIP, image_dir=Path("no-such-dir"), min_eligible=2, active=frozenset({"a-one"})):
    return build.build(build.read_csvs(DATA), list(roster), shipped, TODAY, image_dir, min_eligible, active=active)


def test_fighters_json_shape():
    fighters, _, _ = run()
    assert fighters[0] == {"id": "a-one", "name": "A One", "dob": "1987-07-19", "active": True, "daily": True,
                           "hasImage": False, "metrics": {"height": 76, "reach": 84.0}}
    assert fighters[1]["dob"] is None
    assert fighters[1]["active"] is False


def test_main_keeps_the_previous_active_flags_when_the_roster_cannot_be_read(tmp_path, monkeypatch, capsys):
    (tmp_path / "pipeline").mkdir()
    (tmp_path / "web" / "data").mkdir(parents=True)
    (tmp_path / "pipeline" / "roster.csv").write_text(
        "name,ufcstats_id,ufc_slug,deceased\nA One,aaaa,a-one,0\nB Two,bbbb,b-two,0\n")
    (tmp_path / "pipeline" / "shipped.json").write_text(json.dumps(SHIP))
    data = tmp_path / "web" / "data" / "fighters.json"
    data.write_text(json.dumps([{"id": "a-one", "name": "A One", "active": False, "metrics": {"height": 76, "reach": 84.0}},
                                {"id": "b-two", "name": "B Two", "active": True, "metrics": {}}]))

    def blocked(url):
        raise OSError("HTTP Error 403: Forbidden")
    monkeypatch.setattr(build, "read_active", blocked)
    monkeypatch.setattr(build, "ROOT", tmp_path)
    monkeypatch.setattr(build, "SOURCE", DATA)
    monkeypatch.setattr(build, "MIN_FIGHTERS", 2)
    monkeypatch.setattr(build, "build", functools.partial(build.build, min_eligible=2))
    assert build.main() == 0
    assert [f["active"] for f in json.loads(data.read_text(encoding="utf-8"))] == [False, True]
    assert "403" in capsys.readouterr().err


WIKITEXT = """== Recent releases and retirements ==
|-
|{{#invoke:flag|icon|BRA}}
|{{sortname|José|Aldo}}
==Debuted fighters==
==Lightweights (155 lb, 70 kg)==
|-
|{{#invoke:flag|icon|RUS}}
|{{sortname|Islam|Makhachev}} (c)
|{{age nts|1991|10|27}}
|-
|{{#invoke:flag|icon|GEO}}<br>{{#invoke:flag|icon|ESP}}
|{{sortname|Ilia|Topuria|Ilia Topuria (fighter)}}
|-
|{{#invoke:flag|icon|POL}}
|[[Jan Błachowicz (fighter)|Jan Błachowicz]] '''*'''
|-
|{{#invoke:flag|icon|USA}}
|Sean O&#39;Malley <ref name="x"/>
==See also==
|{{#invoke:flag|icon|USA}}
|Not A Fighter
"""


def test_read_active_reads_only_the_weight_class_tables(tmp_path, monkeypatch):
    page = tmp_path / "roster.json"
    page.write_text(json.dumps({"parse": {"wikitext": WIKITEXT}}), encoding="utf-8")
    monkeypatch.undo()  # the real read_active, against a local file
    monkeypatch.setattr(build, "MIN_ACTIVE", 4)
    assert build.read_active(page.as_uri()) == {"islam-makhachev", "ilia-topuria", "jan-blachowicz", "sean-o-malley"}
    monkeypatch.setattr(build, "MIN_ACTIVE", 5)
    with pytest.raises(build.BuildError, match="Only 4 fighters"):
        build.read_active(page.as_uri())


def test_metrics_json_entry():
    reach = next(m for m in run()[1] if m["id"] == "reach")
    assert {k: reach[k] for k in ("label", "unit", "round", "scale", "snap")} == {
        "label": "Reach (in)", "unit": "in", "round": "silhouette", "scale": "linear", "snap": 0.5}
    assert (reach["min"], reach["max"], reach["step"]) == pytest.approx((68.6, 85.4, 2.8))
    assert [m["id"] for m in run()[1]] == ["height", "reach"]  # shipped only, in ship order


def test_range_override():
    shipped = {"ship": ["height", "reach"], "step": {}, "range": {"reach": [48, 96]}}
    reach = next(m for m in run(shipped=shipped)[1] if m["id"] == "reach")
    assert (reach["min"], reach["max"]) == (48, 96)


def test_step_override():
    reach = next(m for m in run(shipped={"ship": ["height", "reach"], "step": {"reach": 2}})[1] if m["id"] == "reach")
    assert reach["step"] == 2


def test_report_lists_every_candidate():
    report = run()[2]
    for metric_id in metrics.CANDIDATES:
        assert metric_id in report


def test_has_image_follows_the_file(tmp_path):
    (tmp_path / "a-one.webp").write_bytes(b"x")
    fighters, _, _ = run(image_dir=tmp_path)
    assert [f["hasImage"] for f in fighters] == [True, False]


def test_deceased_flag_reaches_the_metrics(monkeypatch):
    seen, real = [], derive.metrics_for
    monkeypatch.setattr(derive, "metrics_for", lambda *a: seen.append(a[4]) or real(*a))
    run(roster=({**A, "deceased": "1"}, B))
    assert seen == [True, False]


@pytest.mark.parametrize("roster, shipped, min_eligible, message", [
    ((), SHIP, 2, "roster"),                                                # empty roster
    (({**A, "ufcstats_id": "zzzz"}, B), SHIP, 2, "A One"),                  # id not in the fighter file
    ((A, {"name": "C Three", "ufcstats_id": "cccc", "ufc_slug": "", "deceased": "0"}), SHIP, 2, "C Three"),  # no fights
    ((A, {**B, "name": "B Twoo"}), SHIP, 2, "B Twoo"),                      # misspelled: no fights
    ((A, {"name": "D Dup", "ufcstats_id": "dddd", "ufc_slug": "", "deceased": "0"}), SHIP, 2, "D Dup"),      # shared name
    ((A, A), SHIP, 2, "A One"),                                             # listed twice
    ((A, B), {"ship": ["nope"], "step": {}}, 2, "nope"),                    # unknown metric
    ((A, B), SHIP, 3, "height"),                                            # too few eligible
    (({**A, "deceased": "yes"}, B), SHIP, 2, "A One"),                      # deceased is not 0 or 1
    ((A, B), {"ship": ["height", "reach"], "step": {"reach": 0}}, 2, "reach"),  # override must be above 0
    ((A, B), {"ship": ["height", "reach"], "step": {}, "range": {"reach": [90, 50]}}, 2, "reach"),  # low then high
])
def test_build_stops(roster, shipped, min_eligible, message):
    with pytest.raises(build.BuildError, match=message):
        run(roster=roster, shipped=shipped, min_eligible=min_eligible)


def test_zero_spread_cannot_ship():
    with pytest.raises(build.BuildError, match="height"):  # one fighter: every step is 0
        run(roster=(A,), min_eligible=1)


def test_derive_and_table_agree():
    from test_derive import career
    m = derive.metrics_for(career(5), 76, 84.0, "1990-01-01", False, TODAY)
    assert set(m) == set(metrics.CANDIDATES)


def test_failed_run_leaves_files_untouched(tmp_path, monkeypatch, capsys):
    (tmp_path / "pipeline").mkdir()
    (tmp_path / "web" / "data").mkdir(parents=True)
    (tmp_path / "pipeline" / "roster.csv").write_text("name,ufcstats_id,ufc_slug,deceased\n")
    (tmp_path / "pipeline" / "shipped.json").write_text(json.dumps(SHIP))
    old = tmp_path / "web" / "data" / "fighters.json"
    old.write_text("[]")
    monkeypatch.setattr(build, "ROOT", tmp_path)
    monkeypatch.setattr(build, "SOURCE", DATA)
    assert build.main() == 1                      # empty roster
    assert old.read_text() == "[]"
    assert not (tmp_path / "pipeline" / "report.txt").exists()
    monkeypatch.setattr(build, "SOURCE", (tmp_path / "missing").as_uri() + "/")
    assert build.main() == 1                      # download fails
    assert old.read_text() == "[]"
    assert "roster" in capsys.readouterr().err


def test_missing_step_key_builds():
    assert run(shipped={"ship": ["height", "reach"]})[1]


def test_report_flags_an_id_that_points_at_another_name():
    rows = build.read_csvs(DATA)
    rows["ufc_fighter_tott"] = [{**t, "FIGHTER": "A Onne"} if t["FIGHTER"] == "A One" else t
                                for t in rows["ufc_fighter_tott"]]
    _, _, report = build.build(rows, [A, B], SHIP, TODAY, Path("no-such-dir"), 2)
    assert "Name differs from fighter file (check the id):\nA One -> A Onne\n" in report
    assert "B Two ->" not in report
    assert "Name differs" not in run()[2]


def test_shared_name_check_covers_the_fighter_file_name():
    rows = build.read_csvs(DATA)
    rows["ufc_fighter_tott"] = rows["ufc_fighter_tott"] + [
        {**rows["ufc_fighter_tott"][0], "FIGHTER": "A One", "URL": "http://x/fighter-details/ffff"}]
    rows["ufc_fighter_tott"][0] = {**rows["ufc_fighter_tott"][0], "FIGHTER": "A Onne"}
    with pytest.raises(build.BuildError, match="A One"):  # id aaaa is "A Onne", but ffff is also "A One"
        build.build(rows, [A, B], SHIP, TODAY, Path("no-such-dir"), 2)


def test_main_reads_a_roster_saved_with_a_byte_order_mark(tmp_path, monkeypatch, capsys):
    (tmp_path / "pipeline").mkdir()
    (tmp_path / "pipeline" / "roster.csv").write_text("name,ufcstats_id,ufc_slug,deceased\n", encoding="utf-8-sig")
    (tmp_path / "pipeline" / "shipped.json").write_text(json.dumps(SHIP))
    monkeypatch.setattr(build, "ROOT", tmp_path)
    monkeypatch.setattr(build, "SOURCE", DATA)
    assert build.main() == 1
    assert "roster is empty" in capsys.readouterr().err


def test_main_writes_the_site_data(tmp_path, monkeypatch):
    (tmp_path / "pipeline").mkdir()
    (tmp_path / "pipeline" / "roster.csv").write_text(
        "name,ufcstats_id,ufc_slug,deceased\nA One,aaaa,a-one,0\nB Two,bbbb,b-two,0\n")
    (tmp_path / "pipeline" / "shipped.json").write_text(json.dumps(SHIP))
    monkeypatch.setattr(build, "ROOT", tmp_path)
    monkeypatch.setattr(build, "SOURCE", DATA)
    monkeypatch.setattr(build, "MIN_FIGHTERS", 2)
    monkeypatch.setattr(build, "build", functools.partial(build.build, min_eligible=2))
    assert build.main() == 0
    for name in ("fighters.json", "metrics.json"):
        assert len(json.loads((tmp_path / "web" / "data" / name).read_text(encoding="utf-8"))) == 2
    assert (tmp_path / "pipeline" / "report.txt").exists()


def roster_of(n):
    return [{"id": f"f{i}", "metrics": {"height": 70.0, "reach": 72.0}} for i in range(n)]


def test_too_few_fighters_stops():
    with pytest.raises(build.BuildError, match="149 fighters, need 150"):
        build.validate(None, roster_of(149), SHIP)


def test_first_build_has_nothing_to_compare():
    build.validate(None, roster_of(150), SHIP)


def test_up_to_15_percent_changed_passes():
    new = roster_of(150)
    for f in new[:45]:            # 45 of 300 values
        f["metrics"]["height"] = 71.0
    build.validate(roster_of(150), new, SHIP)


def test_more_than_15_percent_changed_stops():
    new = roster_of(150)
    for f in new[:46]:
        f["metrics"]["height"] = 71.0
    with pytest.raises(build.BuildError, match=r"15\.3% of values changed"):
        build.validate(roster_of(150), new, SHIP)


def test_a_lost_value_counts_as_changed():
    new = roster_of(150)
    for f in new[:46]:
        del f["metrics"]["reach"]
    with pytest.raises(build.BuildError, match="changed"):
        build.validate(roster_of(150), new, SHIP)


def test_roster_and_shipped_edits_do_not_count():
    old = roster_of(200)          # 50 fighters since removed from the roster
    for f in old:
        f["metrics"]["slpm"] = 4.0  # a metric since removed from shipped.json
    build.validate(old, roster_of(150), SHIP)


def test_main_keeps_the_old_data_when_too_much_changed(tmp_path, monkeypatch, capsys):
    (tmp_path / "pipeline").mkdir()
    (tmp_path / "web" / "data").mkdir(parents=True)
    (tmp_path / "pipeline" / "roster.csv").write_text(
        "name,ufcstats_id,ufc_slug,deceased\nA One,aaaa,a-one,0\nB Two,bbbb,b-two,0\n")
    (tmp_path / "pipeline" / "shipped.json").write_text(json.dumps(SHIP))
    old = tmp_path / "web" / "data" / "fighters.json"
    old_text = json.dumps([{"id": i, "metrics": {"height": 1, "reach": 1}} for i in ("a-one", "b-two")])
    old.write_text(old_text)
    monkeypatch.setattr(build, "ROOT", tmp_path)
    monkeypatch.setattr(build, "SOURCE", DATA)
    monkeypatch.setattr(build, "MIN_FIGHTERS", 2)
    monkeypatch.setattr(build, "build", functools.partial(build.build, min_eligible=2))
    assert build.main() == 1
    assert old.read_text() == old_text
    assert "changed" in capsys.readouterr().err


def ranked(*fighters):
    return [{"division": "Flyweight", "is_p4p": False, "champion": None,
             "ranked": [{"rank": i + 1, "name": n, "slug": s, "change": None} for i, (n, s) in enumerate(fighters)]}]


def test_ranked_additions_adds_only_clear_matches():
    divisions = ranked(("A One", "a-one"), ("Bee Twoo", "b-two"), ("B Two", "b-two"), ("C Three", "c-three"),
                       ("D Dup", "d-dup"), ("Nobody", "nobody"))
    added, skipped = build.ranked_additions(build.read_csvs(DATA), [A], divisions)
    # B by the ufc.com slug, under the ufcstats name, once; out of the Daily.
    assert added == [{"name": "B Two", "ufcstats_id": "bbbb", "ufc_slug": "b-two", "deceased": "0", "daily": "0"}]
    assert skipped == ["C Three (c-three): 1 ufcstats matches, no fights", "D Dup (d-dup): 2 ufcstats matches",
                       "Nobody (nobody): 0 ufcstats matches"]



def with_e_five():
    """The fixture rows plus E Five, a 7-footer with one fight: far off the A One / B Two scale."""
    rows = {k: list(v) for k, v in build.read_csvs(DATA).items()}
    rows["ufc_fighter_tott"].append({"FIGHTER": "E Five", "HEIGHT": "7' 0\"", "WEIGHT": "265 lbs.", "REACH": "90\"",
                                     "STANCE": "", "DOB": "--", "URL": "http://ufcstats.com/fighter-details/ffff"})
    fight = next(r for r in rows["ufc_fight_results"] if r["BOUT"].startswith("A One"))
    rows["ufc_fight_results"].append({**fight, "BOUT": "E Five vs. B Two", "URL": "http://ufcstats.com/fight-details/f3"})
    for r in [r for r in rows["ufc_fight_stats"] if r["BOUT"] == "A One vs. B Two"]:
        rows["ufc_fight_stats"].append({**r, "BOUT": "E Five vs. B Two", "FIGHTER": r["FIGHTER"].replace("A One", "E Five")})
    return rows


E = {"name": "E Five", "ufcstats_id": "ffff", "ufc_slug": "e-five", "deceased": "0", "daily": "0"}


def test_non_daily_fighters_do_not_move_the_ranges():
    def go(roster):
        return build.build(with_e_five(), list(roster), SHIP, TODAY, Path("no-such-dir"), 2)
    fighters, with_e, _ = go((A, B, E))
    assert with_e == go((A, B))[1]
    assert fighters[2]["daily"] is False and fighters[2]["metrics"] == {}  # off the scale for height and reach
    assert go((A, B, dict(E, daily="1")))[1] != with_e


def test_main_adds_ranked_fighters_outside_the_daily(tmp_path, monkeypatch):
    (tmp_path / "pipeline").mkdir()
    (tmp_path / "web" / "data").mkdir(parents=True)
    (tmp_path / "pipeline" / "roster.csv").write_text(
        "name,ufcstats_id,ufc_slug,deceased\nA One,aaaa,a-one,0\nB Two,bbbb,b-two,0\n")
    (tmp_path / "pipeline" / "shipped.json").write_text(json.dumps(SHIP))
    (tmp_path / "web" / "data" / "rankings.json").write_text(json.dumps({"divisions": ranked(("E Five", "e-five"))}))
    monkeypatch.setattr(build, "read_active", lambda url: set())
    rows = with_e_five()
    monkeypatch.setattr(build, "read_csvs", lambda url: rows)
    monkeypatch.setattr(build, "ROOT", tmp_path)
    monkeypatch.setattr(build, "MIN_FIGHTERS", 2)
    monkeypatch.setattr(build, "build", functools.partial(build.build, min_eligible=2))
    assert build.main() == 0
    assert (tmp_path / "pipeline" / "roster.csv").read_bytes() == (
        b"name,ufcstats_id,ufc_slug,deceased,daily\nA One,aaaa,a-one,0,1\nB Two,bbbb,b-two,0,1\nE Five,ffff,e-five,0,0\n")
    fighters = json.loads((tmp_path / "web" / "data" / "fighters.json").read_text(encoding="utf-8"))
    assert [(f["id"], f["daily"], f["active"]) for f in fighters] == [
        ("a-one", True, False), ("b-two", True, False), ("e-five", False, True)]
