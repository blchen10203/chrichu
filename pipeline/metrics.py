import math
import statistics

# id: (label, unit, round, scale, snap). snap None = log metric; the site snaps it to 2 significant figures.
CANDIDATES = {
    "height": ("Height (in)", "in", "silhouette", "linear", 1),
    "reach": ("Reach (in)", "in", "silhouette", "linear", 0.5),
    "slpm": ("Significant strikes landed per minute", "/min", "bar", "linear", 0.1),
    "sapm": ("Significant strikes absorbed per minute", "/min", "bar", "linear", 0.1),
    "str_acc": ("Striking accuracy %", "%", "bar", "linear", 1),
    "str_def": ("Striking defense %", "%", "bar", "linear", 1),
    "career_sig": ("Career significant strikes landed", "", "bar", "log", None),
    "knockdowns": ("Career knockdowns landed", "", "bar", "linear", 1),
    "head_pct": ("Share of strikes to the head %", "%", "bar", "linear", 1),
    "body_pct": ("Share of strikes to the body %", "%", "bar", "linear", 1),
    "leg_pct": ("Share of strikes to the legs %", "%", "bar", "linear", 1),
    "td_avg": ("Takedowns per 15 minutes", "/15 min", "bar", "linear", 0.1),
    "td_acc": ("Takedown accuracy %", "%", "bar", "linear", 1),
    "td_def": ("Takedown defense %", "%", "bar", "linear", 1),
    "sub_avg": ("Submission attempts per 15 minutes", "/15 min", "bar", "linear", 0.1),
    "td_per_fight": ("Takedowns per fight", "/fight", "bar", "linear", 0.1),
    "min_per_td": ("Minutes per takedown", "min", "bar", "log", None),
    "control_time": ("Career control time (min)", "min", "bar", "log", None),
    "win_pct": ("Win % (UFC fights)", "%", "bar", "linear", 1),
    "ufc_fights": ("UFC fights", "", "bar", "linear", 1),
    "ufc_wins": ("UFC wins", "", "bar", "linear", 1),
    "finish_rate": ("% of wins by finish", "%", "bar", "linear", 1),
    "ko_wins": ("Wins by KO/TKO", "", "bar", "linear", 1),
    "sub_wins": ("Wins by submission", "", "bar", "linear", 1),
    "cage_time": ("Career cage time (min)", "min", "bar", "log", None),
    "avg_fight_len": ("Average fight length (min)", "min", "bar", "linear", 0.1),
    "age": ("Age (years)", "years", "bar", "linear", 1),
    "debut_age": ("Age at UFC debut", "years", "bar", "linear", 1),
}


def summarize(values, scale):
    xs = [math.log10(v) for v in values] if scale == "log" else values
    sd = statistics.pstdev(xs)
    return {
        "n": len(values),
        "min": min(values),
        "median": statistics.median(values),
        "max": max(values),
        "sd": sd,
        "step": 0.4 * sd,
    }


def slider(values, scale, unit):
    log = scale == "log"
    xs = [math.log10(v) for v in values] if log else values
    lo, hi = min(xs), max(xs)
    pad = 0.1 * (hi - lo)
    lo, hi = lo - pad, hi + pad
    if log:
        lo, hi = 10 ** lo, 10 ** hi
    lo = max(lo, 1 if log else 0)
    if unit == "%":
        hi = min(hi, 100)
    return lo, hi


def round_value(metric_id, value):
    _, _, _, scale, snap = CANDIDATES[metric_id]
    x = round(value, 1) if scale == "log" else round(value / snap) * snap
    return round(x, 4)
