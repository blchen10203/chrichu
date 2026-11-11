import build
import draft_roster
from test_build import DATA


def test_draft_ranks_title_fighters_first_and_flags_shared_names():
    rows = draft_roster.draft(build.read_csvs(DATA))
    assert [r["name"] for r in rows] == ["B Two", "A One", "D Dup"]
    assert rows[1] == {"name": "A One", "ufcstats_id": "aaaa", "ufc_slug": "a-one", "deceased": "0"}
    assert rows[2]["ufcstats_id"] == ""  # two fighters share the name: owner must fix or drop


def test_limit():
    assert len(draft_roster.draft(build.read_csvs(DATA), limit=1)) == 1


def test_main_will_not_overwrite_an_edited_roster(tmp_path, monkeypatch):
    (tmp_path / "pipeline").mkdir()
    roster = tmp_path / "pipeline" / "roster.csv"
    roster.write_text("name,ufcstats_id,ufc_slug,deceased\nA One,aaaa,a-one,0\n")
    monkeypatch.setattr(build, "ROOT", tmp_path)
    monkeypatch.setattr(build, "SOURCE", DATA)
    assert draft_roster.main() == 1
    assert "A One,aaaa" in roster.read_text()


def test_a_fight_listed_twice_counts_once():
    row = {"EVENT": "UFC 1", "WEIGHTCLASS": "Bout"}
    rows = {"ufc_fighter_tott": [], "ufc_event_details": [{"EVENT": "UFC 1", "DATE": "January 10, 2020"}],
            "ufc_fight_results": [{**row, "BOUT": "D Dup vs. X", "URL": "u1"}, {**row, "BOUT": "D Dup vs. X", "URL": "u1"},
                                  {**row, "BOUT": "A One vs. Y", "URL": "u2"}]}
    assert [r["name"] for r in draft_roster.draft(rows)][:2] == ["A One", "D Dup"]  # a tie, so name order
