# Reachdle web

A static Next.js site (`output: "export"`): `npm run dev` to play locally, `npm run build` writes `out/`.
Checks: `npm test` (unit), `npm run e2e` (Playwright; stop any other `next dev` first), `npm run lint`.
Fighter data in `data/` is built by `../pipeline/build.py`, not edited by hand.
