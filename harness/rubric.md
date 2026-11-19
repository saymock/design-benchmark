---

name: design-fidelity-judge
description: Score how well a design made by an agent (saymock, Figma or any tool) reproduces a reference screenshot, and how good it is as an editable design. Use when grading design benchmarks, comparing tools or agents, or reviewing a "reproduce this screen" task. Produces a 100-point score with evidence.
---

# Design fidelity judge

You grade one or more **candidates** against a **reference** screenshot. Each candidate has a
render (PNG at the reference's size) and a structure dump (HTML for saymock, a node outline
`structure.txt` or node XML for Figma, or similar), sometimes with `stats.json` (layer, auto-layout,
absolute, named, reuse and image counts: evidence for the editability criteria). Candidates are
labelled A, B… or by a random pack id; judge them on what you see, not on the tool behind them.
In a benchmark pack, `metrics.json`, `heatmap.png` and `side-by-side.png` are already computed:
use them, and only run the script below for `--crop` zooms.

Be an exacting design reviewer: a 1–2 px offset, a wrong weight or a slightly off grey are
real defects in a "high-fidelity" task. Every deduction needs evidence (where, what, by how much).

## 1. Measure first

Run the comparison script for each candidate (Chromium via Playwright, no other dependency):

```bash
node .claude/skills/design-fidelity-judge/scripts/compare.cjs <reference.png> <candidate.png> <out-dir>
```

It writes `<out-dir>/heatmap.png` (red = differences), `<out-dir>/side-by-side.png` and prints JSON:
`sizeMatch`, `meanDiff` (0–255, mean absolute channel difference), `pctDiff` (% of pixels differing
by more than 40), and a 6×4 `grid` of per-cell `meanDiff` to locate where the candidate drifts.
A size mismatch is a defect in itself (the render is then compared after scaling, flagged in the JSON).

Then **look**: open the reference and the candidate, and crop/zoom regions (header, navigation,
first rows, controls, icons) with the `--crop x,y,w,h,scale` option of the script:

```bash
node .claude/skills/design-fidelity-judge/scripts/compare.cjs ref.png cand.png out --crop 0,0,480,140,3
```

## 2. Score (100 points)

### Visual fidelity — 60

| Criterion            | Pts | What earns full marks                                                                                             |
| -------------------- | --- | ----------------------------------------------------------------------------------------------------------------- |
| Layout & geometry    | 15  | Every block at the reference position and size (±1 px); same spacing, alignment, column widths, row heights.      |
| Typography           | 12  | Same family, size, weight, color, line height, letter case; same wrapping/truncation.                             |
| Color & surfaces     | 8   | Fills, borders/separators, radii, shadows, states (selected/hover row, active tab) match.                         |
| Icons & imagery      | 10  | Right icon for each slot (same glyph family), size, color, alignment; logo and photos present, correctly cropped. |
| Content completeness | 10  | Every text/element of the reference present and exact (accents, numbers, truncation); nothing invented.           |
| Pixel metrics        | 5   | From the script: 5 if `meanDiff` < 1.5, 4 < 3, 3 < 6, 2 < 10, 1 < 20, else 0 (−2 if `sizeMatch` is false, min 0). |

### Editable design quality — 40 (from the structure dump)

| Criterion          | Pts | What earns full marks                                                                                                                                                                             |
| ------------------ | --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hierarchy & naming | 10  | Meaningful groups (header, sidebar, tabs, form/table, rows) with readable names; no anonymous pile of layers.                                                                                     |
| Layout primitives  | 12  | Flex/auto-layout where the UI flows (bars, lists, rows, fields), so editing text or adding a row reflows; absolute positioning only where the UI is really fixed.                                 |
| Reuse              | 10  | Repeated things (rows, nav items, fields, tags) built once and repeated (components/instances, templates/data), consistent values (tokens/styles/variables) instead of copy-pasted magic numbers. |
| Cleanliness        | 8   | Real text (not outlines or a pasted screenshot), real vectors/icons, no hidden or off-frame leftovers, no hacks (e.g. a bitmap of UI parts other than genuine photos/logos).                      |

A candidate that pastes the reference screenshot (or large crops of UI from it) as an image gets
0 for Typography, Icons and Editable design quality: only real photos and logos may be images.

## 3. Report

Score each criterion as its maximum minus the deductions you can show; list every deduction of
2 points or more as a defect. Check the arithmetic: `visual` = sum of the six visual criteria,
`editability` = sum of the four others, `total` = both. In a benchmark (pack directory given),
write the JSON to `score.json` there; otherwise print it. Exact keys, no comments, numbers not strings:

```json
{
  "candidate": "A",
  "verdict": "One sentence a designer would say: overall closeness, the worst gap, how editable it is.",
  "metrics": { "sizeMatch": true, "meanDiff": 0.0, "pctDiff": 0.0 },
  "scores": {
    "layout": 0,
    "typography": 0,
    "color": 0,
    "icons": 0,
    "content": 0,
    "pixel": 0,
    "hierarchy": 0,
    "layoutPrimitives": 0,
    "reuse": 0,
    "cleanliness": 0
  },
  "visual": 0,
  "editability": 0,
  "total": 0,
  "top_defects": [
    {
      "severity": "major",
      "criterion": "icons",
      "where": "left navigation rail",
      "what": "outlined icons instead of filled Material Symbols, 24 px instead of 20 px",
      "points": 3
    }
  ],
  "strengths": ["short, specific: what is exactly right"]
}
```

- `top_defects`: at most 8, most visible first. `severity`: `major` (seen at a glance at 100 %, or
  breaks editing: missing block, wrong font family, screenshot pasted, everything absolute),
  `minor` (needs zoom or side-by-side: 1–3 px offsets, slightly off grey, one wrong icon).
  `criterion` is one of the score keys. `where` names the region the way the UI does (header,
  table header row, "Visites" tab), `what` gives the expected vs actual with sizes or colors.
- `strengths`: 1–3 items, only things that are verifiably right.

After the JSON, write a short rationale (3–6 lines): the criteria where most points were lost and
why, and what the structure dump shows about editability.

With several candidates in one session, end with a comparison: which is better on fidelity, which
on editability, and the 3 defects that most separate them. Do not guess which tool made which
candidate.
