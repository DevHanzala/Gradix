# Screenshot and accessibility pass

`scripts/shootAll.mjs`: 28 pages x 3 widths (360, 768, 1280 px) x 4 languages (en, ur, ar, sd) = 336 captures
against the production build and the demo API. Each capture is checked for horizontal overflow, raw i18n keys or
`{{placeholders}}`, the `<html dir>` of RTL languages, console errors, and axe-core (WCAG 2 A/AA) violations of
impact serious or critical.

Result (`checks.csv`, `problems.json`): **1 of 336 with a problem**: 0 axe serious/critical violations, 0 raw
keys, 0 console errors, all RTL directions right; one 4 px horizontal overflow on the projector view in English at
360 px (the team-race progress label). Fixed in `components/live/TeamRace.jsx` (row wraps, smaller text on narrow
screens) and re-checked: no element wider than the viewport.

Only a sample of the PNGs is kept here to keep the repository small; rerun the script to regenerate all of them.
