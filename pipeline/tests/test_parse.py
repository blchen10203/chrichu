import parse


def test_height_in():
    assert parse.height_in("6' 4\"") == 76
    assert parse.height_in("--") is None


def test_reach_in():
    assert parse.reach_in('84"') == 84.0
    assert parse.reach_in("--") is None


def test_of():
    assert parse.of("42 of 48") == (42, 48)
    assert parse.of("") == (0, 0)  # blank stat row


def test_seconds():
    assert parse.seconds("3:37") == 217
    assert parse.seconds("--") == 0
    assert parse.seconds("") == 0


def test_iso_date():
    assert parse.iso_date("Jul 19, 1987") == "1987-07-19"
    assert parse.iso_date("November 07, 2026") == "2026-11-07"
    assert parse.iso_date("--") is None


def test_fight_seconds():
    assert parse.fight_seconds("3", "4:29", "5 Rnd (5-5-5-5-5)") == 869
    assert parse.fight_seconds("2", "1:00", "1 Rnd + OT (12-3)") == 780
    assert parse.fight_seconds("1", "7:15", "No Time Limit") == 435


def test_fighter_id():
    assert parse.fighter_id("http://ufcstats.com/fighter-details/07f72a2a7591b409") == "07f72a2a7591b409"


def test_slug():
    assert parse.slug("Georges St-Pierre") == "georges-st-pierre"
    assert parse.slug("Michael Aswell Jr.") == "michael-aswell-jr"
