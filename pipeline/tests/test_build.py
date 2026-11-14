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


def run(roster=(A, B), shipped=SHIP, image_dir=Path("no-such-dir"), min_eligible=2):
    return build.build(build.read_csvs(DATA), list(roster), shipped, TODAY, image_dir, min_eligible)


def test_fighters_json_shape():
    fighters, _, _ = run()
    assert fighters[0] == {"id": "a-one", "name": "A One", "dob": "1987-07-19",
                           "hasImage": False, "metrics": {"height": 76, "reach": 84.0}}
    assert fighters[1]["dob"] is None


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
    old.write_text("OLD")
    monkeypatch.setattr(build, "ROOT", tmp_path)
    monkeypatch.setattr(build, "SOURCE", DATA)
    assert build.main() == 1                      # empty roster
    assert old.read_text() == "OLD"
    assert not (tmp_path / "pipeline" / "report.txt").exists()
    monkeypatch.setattr(build, "SOURCE", (tmp_path / "missing").as_uri() + "/")
    assert build.main() == 1                      # download fails
    assert old.read_text() == "OLD"
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
