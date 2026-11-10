"""Download the ufcstats CSVs, derive metrics, and write the site's data.

Reads roster.csv and shipped.json. Writes web/data/fighters.json,
web/data/metrics.json and a report. Spec sections 5 and 11.
"""
import sys


def main() -> int:
    print("build.py is not implemented yet (spec sections 5 and 11).", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
