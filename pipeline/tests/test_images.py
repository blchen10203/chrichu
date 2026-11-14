import struct
import zlib

import images


def png(alphas, filt=0):
    """A tiny RGBA PNG whose rows all use one filter type."""
    w, h = len(alphas[0]), len(alphas)
    raw = b"".join(bytes([filt]) + bytes(c for a in row for c in (0, 0, 0, a)) for row in alphas)
    chunk = lambda kind, body: struct.pack(">I", len(body)) + kind + body + struct.pack(">I", zlib.crc32(kind + body))
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b""))


def test_read_alpha():
    assert images.read_alpha(png([[0, 255], [128, 7]])) == [bytes([0, 255]), bytes([128, 7])]


def test_read_alpha_undoes_the_up_filter():
    # With filter 2 each byte is stored as the difference from the row above.
    assert images.read_alpha(png([[10, 20], [5, 5]], filt=2)) == [bytes([10, 20]), bytes([15, 25])]


def test_a_square_traces_to_four_corners():
    mask = [[False] * 6] + [[False, True, True, True, True, False] for _ in range(4)] + [[False] * 6]
    (loop,) = images.loops(mask)
    far = max(range(len(loop)), key=lambda m: abs(loop[m][0] - loop[0][0]) + abs(loop[m][1] - loop[0][1]))
    corners = images.simplify(loop[: far + 1], 0.5)[:-1] + images.simplify(loop[far:] + loop[:1], 0.5)[:-1]
    assert sorted(corners) == [(1, 1), (1, 5), (5, 1), (5, 5)]


def test_a_hole_is_its_own_loop():
    mask = [[True] * 3, [True, False, True], [True] * 3]
    assert len(images.loops(mask)) == 2


def test_a_photo_cut_by_the_frame_stays_open_at_the_cut():
    rows = [bytes([0] * 8)] * 4 + [bytes([0, 0, 255, 255, 255, 255, 0, 0])] * 12  # touches the bottom edge
    d, cut = images.outline(rows)
    assert "Z" not in d and cut < images.FIG
    ys = [float(v) for v in d.replace("M", " ").replace("L", " ").split()[1::2]]
    assert min(ys) == 0 and max(ys) == cut


def test_a_whole_body_spans_head_to_floor():
    rows = [bytes([0] * 8)] * 4 + [bytes([0, 0, 255, 255, 255, 255, 0, 0])] * 12 + [bytes([0] * 8)] * 2
    d, cut = images.outline(rows)
    ys = [float(v) for v in d.replace("M", " ").replace("L", " ").replace("Z", " ").split()[1::2]]
    assert d.endswith("Z") and cut == images.FIG and min(ys) == 0 and max(ys) == images.FIG


def test_long_hair_reads_as_a_waist_crop():
    assert images.framing([[True] * 100] * 50) == images.WAIST  # no neck found: the head looks huge


def test_a_bystander_is_dropped():
    mask = [[True, True, False, False, True]] * 3
    assert images.largest(mask) == [[True, True, False, False, False]] * 3
