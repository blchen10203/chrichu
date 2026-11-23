import pytest

import rankings


def group(header, champ, rows):
    trs = "".join(f'<tr><td class="x">{r}</td><td class="views-field-title"><a href="/athlete/{s}">{n}</a></td>'
                  f"<td>{c}</td></tr>" for r, n, s, c in rows)
    champ_html = f'<div class="rankings--athlete--champion"><h5><a href="/athlete/{champ[1]}">{champ[0]}</a></h5></div>' if champ else ""
    return f'<div class="view-grouping"><div class="view-grouping-header">{header}</div>{champ_html}<table><tbody>{trs}</tbody></table></div>'


ROWS = [(1, "Jon Jones", "jon-jones", '<span>Rank increased by</span> 2'), (1, "B Two", "b-two", '<span>NR</span>'),
        (3, "C Three", "c-three", "")]
PAGE = (
    '<div class="block-views-blockathlete-rankings-block-1">'
    + group("Men's Pound-for-Pound <span>Top Rank</span>", ("Jon Jones", "jon-jones"), ROWS)
    + group("Flyweight", None, ROWS)
    + group("Flyweight", None, ROWS[:1])  # the second layout of the same list
    + '</div><div class="block-views-blockathlete-rankings-meta-rankings">'
    + group("Heavyweight", ("X", "x"), ROWS)
    + '</div><a data-rankings-footer="media">How are rankings determined?</a><p data-rankings-footer="media">Last\n updated: Tuesday, Nov. 17</p>'
    '<p data-rankings-footer="meta">Last updated: Saturday, Nov. 14</p>'
)


def test_parse_page_reads_media_lists_only():
    last_updated, divisions = rankings.parse_page(PAGE)
    assert last_updated == "Tuesday, Nov. 17"
    assert [d["division"] for d in divisions] == ["Men's Pound-for-Pound", "Flyweight"]
    p4p, fly = divisions
    assert p4p["is_p4p"] and p4p["champion"] == {"name": "Jon Jones", "slug": "jon-jones"}
    assert fly["champion"] is None and not fly["is_p4p"]
    assert [(r["rank"], r["slug"], r["change"]) for r in fly["ranked"]] == [
        (1, "jon-jones", "+2"), (1, "b-two", "NR"), (3, "c-three", None)]


def test_parse_page_without_footer():
    assert rankings.parse_page(PAGE.split("<p ")[0])[0] is None


def test_check_fails_loudly():
    _, divisions = rankings.parse_page(PAGE)
    with pytest.raises(rankings.RankingsError, match="divisions"):
        rankings.check(divisions)
    with pytest.raises(rankings.RankingsError, match="only 3 fighters"):
        rankings.check(divisions * 5)  # 3 fighters each, need 5


def test_match_by_slug_then_name():
    _, divisions = rankings.parse_page(PAGE)
    roster = [{"name": "Jon Jones", "ufc_slug": "jon-jones"}, {"name": "C Thrée", "ufc_slug": "other-slug"}]
    missed = rankings.match(divisions, roster)
    ids = [r["id"] for r in divisions[1]["ranked"]]
    assert ids == ["jon-jones", None, "c-thr-e"]  # the last by accent-free name; ids are parse.slug(name)
    assert divisions[0]["champion"]["id"] == "jon-jones"
    assert "Flyweight: B Two (b-two)" in missed
