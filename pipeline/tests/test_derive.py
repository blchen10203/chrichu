from datetime import date

import pytest

import derive

EVENTS = [{"EVENT": "UFC 1", "URL": "", "DATE": "January 10, 2020", "LOCATION": ""}]
TODAY = date(2026, 11, 11)


def result(bout, outcome="W/L", method="KO/TKO ", event="UFC 1 "):
    return {"EVENT": event, "BOUT": bout, "OUTCOME": outcome, "METHOD": method,
            "ROUND": "1", "TIME": "5:00", "TIME FORMAT": "3 Rnd (5-5-5)"}


def stat(bout, fighter, sig="10 of 20", td="1 of 2", ctrl="1:00", event="UFC 1"):
    return {"EVENT": event, "BOUT": bout, "ROUND": "Round 1", "FIGHTER": fighter, "KD": "1.0",
            "SIG.STR.": sig, "TD": td, "SUB.ATT": "1.0", "CTRL": ctrl,
            "HEAD": "6 of 12", "BODY": "3 of 5", "LEG": "1 of 3"}


def career(n, **mine):
    """n wins for 'A One' over distinct opponents, each 5:00, as fight dicts."""
    results, stats = [], []
    for i in range(n):
        bout = f"A One vs. Opp {i}"
        results.append(result(bout))
        stats += [stat(bout, "A One", **mine), stat(bout, f"Opp {i}", sig="5 of 10", td="0 of 1")]
    return derive.fights_by_fighter(results, stats, EVENTS).get("A One", [])


def test_fight_is_joined_despite_stray_spaces():
    fights = derive.fights_by_fighter(
        [result("A One vs. B Two")],
        [stat("A One vs. B Two", "A One"), stat("A One vs. B Two", "B Two", sig="5 of 10", td="0 of 1")],
        EVENTS)
    a, b = fights["A One"][0], fights["B Two"][0]
    assert (a["date"], a["outcome"], a["method"], a["seconds"], a["tracked"]) == ("2020-01-10", "W", "KO/TKO", 300, True)
    assert (a["mine"]["sig"], a["mine"]["sig_att"], a["theirs"]["sig"], a["theirs"]["td_att"]) == (10, 20, 5, 1)
    assert a["mine"]["ctrl"] == 60
    assert b["outcome"] == "L"


def test_blank_stat_rows_mean_untracked():
    blank = {k: "" for k in stat("x", "y")} | {"EVENT": "UFC 1", "BOUT": "A One vs. B Two"}
    f = derive.fights_by_fighter([result("A One vs. B Two")], [blank, blank], EVENTS)["A One"][0]
    assert f["tracked"] is False
    assert f["seconds"] == 300


def test_event_without_date():
    f = derive.fights_by_fighter([result("A One vs. B Two", event="Unlisted ")], [], EVENTS)["A One"][0]
    assert f["date"] is None


def test_draw_and_no_contest():
    fights = derive.fights_by_fighter(
        [result("A One vs. B Two", outcome="D/D"), result("A One vs. C Three", outcome="NC/NC")], [], EVENTS)
    assert [f["outcome"] for f in fights["A One"]] == ["D", "NC"]


def test_all_metrics_for_five_identical_wins():
    m = derive.metrics_for(career(5), 76, 84.0, "1990-01-01", False, TODAY)
    assert m == pytest.approx({
        "height": 76, "reach": 84.0, "age": 36, "debut_age": 30,
        "slpm": 2.0, "sapm": 1.0, "str_acc": 50, "str_def": 50,
        "career_sig": 50, "knockdowns": 5,
        "head_pct": 60, "body_pct": 30, "leg_pct": 10,
        "td_avg": 3.0, "td_acc": 50, "td_def": 100, "sub_avg": 3.0,
        "td_per_fight": 1.0, "min_per_td": 5.0, "control_time": 5.0,
        "win_pct": 100, "ufc_fights": 5, "ufc_wins": 5,
        "finish_rate": 100, "ko_wins": 5, "sub_wins": 0,
        "cage_time": 25.0, "avg_fight_len": 5.0,
    })


def test_four_fights_is_too_few_for_rates():
    m = derive.metrics_for(career(4), 76, 84.0, "1990-01-01", False, TODAY)
    assert m["ufc_fights"] == 4 and m["knockdowns"] == 4
    for key in ("slpm", "str_acc", "td_avg", "win_pct", "avg_fight_len", "finish_rate", "head_pct"):
        assert key not in m


def test_missing_basics_drop_only_their_metric():
    m = derive.metrics_for(career(5), None, None, None, False, TODAY)
    assert not {"height", "reach", "age", "debut_age"} & set(m)
    assert m["slpm"] == pytest.approx(2.0)


def test_deceased_has_no_age():
    m = derive.metrics_for(career(5), 76, 84.0, "1990-01-01", True, TODAY)
    assert "age" not in m and m["debut_age"] == 30


def test_zero_takedowns_and_zero_control():
    m = derive.metrics_for(career(5, td="0 of 0", ctrl="0:00"), 76, 84.0, "1990-01-01", False, TODAY)
    for key in ("min_per_td", "control_time", "td_acc"):
        assert key not in m
    assert m["td_avg"] == 0


def test_no_contest_is_left_out_of_win_pct():
    fights = career(4) + derive.fights_by_fighter(
        [result("A One vs. X", outcome="L/W"), result("A One vs. Y", outcome="NC/NC")], [], EVENTS)["A One"]
    m = derive.metrics_for(fights, 76, 84.0, "1990-01-01", False, TODAY)
    assert m["win_pct"] == pytest.approx(80)
    assert m["ufc_fights"] == 6


def test_same_fight_url_is_counted_once_and_the_dated_copy_wins():
    bout = "A One vs. B Two"
    undated = {**result(bout, event="Other Name "), "URL": " http://x/f1 "}
    dated = {**result(bout), "URL": "http://x/f1"}
    stats = [stat(bout, "A One", event="Other Name"), stat(bout, "B Two", event="Other Name"),
             stat(bout, "A One"), stat(bout, "B Two")]
    fights = derive.fights_by_fighter([undated, dated], stats, EVENTS)["A One"]
    assert len(fights) == 1
    assert fights[0]["date"] == "2020-01-10"
    assert fights[0]["mine"]["sig"] == 10


def test_rows_without_a_url_are_never_duplicates():
    fights = derive.fights_by_fighter([result("A One vs. B Two"), result("A One vs. B Two")], [], EVENTS)
    assert len(fights["A One"]) == 2


def test_log_minimums_are_not_met_just_above_zero():
    m = derive.metrics_for(career(5, td="10 of 10", ctrl="0:10"), 76, 84.0, "1990-01-01", False, TODAY)
    assert "control_time" not in m and "min_per_td" not in m  # 50 s control; 0.5 min per takedown


def test_two_takedowns_are_too_few_for_min_per_td():
    fights = career(1, td="1 of 1") + career(1, td="1 of 1")
    assert "min_per_td" not in derive.metrics_for(fights, 76, 84.0, "1990-01-01", False, TODAY)
