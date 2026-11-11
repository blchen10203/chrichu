import pytest

import metrics


def test_candidates_match_spec():
    assert len(metrics.CANDIDATES) == 28
    assert metrics.CANDIDATES["reach"] == ("Reach (in)", "in", "silhouette", "linear", 0.5)
    assert metrics.CANDIDATES["career_sig"][3:] == ("log", None)


def test_summarize_linear():
    s = metrics.summarize([70, 72, 74, 76, 78], "linear")
    assert (s["n"], s["min"], s["median"], s["max"]) == (5, 70, 74, 78)
    assert s["sd"] == pytest.approx(2.8284, abs=1e-4)
    assert s["step"] == pytest.approx(1.1314, abs=1e-4)


def test_summarize_log_uses_log10_space():
    s = metrics.summarize([10, 100, 1000], "log")
    assert s["median"] == 100
    assert s["sd"] == pytest.approx(0.8165, abs=1e-4)
    assert s["step"] == pytest.approx(0.3266, abs=1e-4)


def test_slider():
    assert metrics.slider([70, 78], "linear", "in") == pytest.approx((69.2, 78.8))
    assert metrics.slider([0, 10], "linear", "") == pytest.approx((0, 11))        # floored at 0
    assert metrics.slider([20, 95], "linear", "%") == pytest.approx((12.5, 100))  # capped at 100
    lo, hi = metrics.slider([10, 1000], "log", "")
    assert lo == pytest.approx(6.3096, abs=1e-3)
    assert hi == pytest.approx(1584.89, abs=1e-1)
    assert metrics.slider([1, 10], "log", "")[0] == 1                             # floored at 1


def test_round_value():
    assert metrics.round_value("slpm", 4.3478) == 4.3
    assert metrics.round_value("reach", 84.26) == 84.5
    assert metrics.round_value("career_sig", 1463.04) == 1463.0
