# Protocol

How to measure, in a way others can quote, what a design made by an agent costs and what it is
worth, in Saymock and in Figma (MCP). This is the protocol the 2026-11-12 benchmark followed; the
places where that benchmark departed from it are listed in the README.

## Why this protocol

A first pilot (November 6, 2026) gave a trend, not a result. What this protocol changes:

| Limit of the pilot                                         | This protocol                                                              |
| ---------------------------------------------------------- | -------------------------------------------------------------------------- |
| 2 screens, one platform (iPad), 1 run per tool             | 3 screens on 3 platforms (iPhone, Android, web), 3 runs per screen and tool |
| A little-known business app                                | A well-known app, its real screens on the 3 platforms                      |
| No assets: photos, map and logo lost by both tools         | The real files (photos, icons, logo, font names) given to every agent      |
| Figma also loaded the user's other connectors              | A dedicated, strict MCP config for each pipeline                           |
| Only one pipeline kept a log of frictions during the runs  | No extra work during measured runs; frictions gathered separately          |
| The local stack was broken by another agent during a run   | A stack dedicated to the benchmark, that nobody else touches               |

## Reference screens

A set is one well-known app and three screens of different kinds (a feed, a content page, a dense
page), each on its platform, captured on the real app with its original assets.

| Screen                             | Platform    | What it exercises                                                 | CSS size, density        |
| ---------------------------------- | ----------- | ----------------------------------------------------------------- | ------------------------ |
| Wikipedia, home ("Community" feed) | iOS, iPhone | Card feed, photos, segmented control, Liquid Glass tab bar        | 430×932, `--scale 3`     |
| Wikipedia, home ("Community" feed) | Android     | Banner, image card and translucent card, Material 3 navigation    | 411×923, `--scale 2.625` |
| Wikipedia, Main Page               | Web desktop | Dense page: columns, colored boxes, photos, side panel            | 1440×900, `--scale 2`    |

Each screen has:

- `reference.png`: the raw capture, at the device's density;
- `assets/`: **what the agent gets**, as a designer would get it from the product team: `images/`
  (the real photos and illustrations), `icons/` (the app's SVGs; icons that are only named, SF
  Symbols or Material, are listed in `icons/README.md`) and `fonts.md` (families and weights per
  text role, no sizes or colors);
- `SOURCES.md`: capture conditions, origin and license of each asset, and the measured styles
  (sizes, colors). **Never given to the agents**: it is for the judges and for checking.

Capture rules: the real app (or the real site), its default appearance (the same for the whole
set), one language for the set, no bubble or alert on screen, a normalized status bar (9:41, full
battery: `simctl status_bar` on iOS, demo mode on Android), a native, untouched capture. Assets
are the original files, never crops of the capture. The day's content (feed, news) is frozen by
the capture: it is not retaken during a benchmark.

Android: a density of 2.625 makes a 411×923 frame that renders at 1079×2423, one pixel short of
the capture (1080×2424). The Android `reference.png` is therefore the capture without its last
column and row (noted in its `SOURCES.md`).

## Pipelines

| Pipeline  | Run                                                         | Measures                                     | Export                         |
| --------- | ----------------------------------------------------------- | -------------------------------------------- | ------------------------------ |
| `saymock` | `run.mjs`, Claude Code headless, only Saymock's MCP server   | Cost in $, tokens, time, turns, tool calls   | `get_screenshot` + `get_html`  |
| `figma`   | `run.mjs`, Claude Code headless, only Figma's MCP server     | Same                                         | Figma REST API (`FIGMA_TOKEN`) |

The harness also has a manual pipeline for Claude Design, and the protocol an optional control (an
agent writing an HTML file with no design tool); neither is part of the published benchmark.

### Same conditions for all

- **Same model**: `--model opus` (Claude Opus 5.5), recorded in `run.json`.
- **Same prompt**: `prompt.md`, plus `prompt-assets.md` when the screen has assets (added by
  `run.mjs`). Each pipeline only adds how to create its file.
- **Same assets**: `run.mjs` copies `assets/` next to `reference.png` in the agent's working
  folder.
- **Same budget**: $15 and 45 min per run (`--budget 15 --timeout-min 45`).
- **Strict MCP**: one server per run. For Figma, `figma.mcp.json` declares only Figma's MCP server
  (`https://mcp.figma.com/mcp`); check once, interactively, that `claude -p --strict-mcp-config
  --mcp-config …` sees Figma's tools (OAuth is done once). Without it `run.mjs` falls back on the
  user's connectors and the summary says so: such a benchmark is not quotable.
- **No extra work** during measured runs (`--extra-prompt` forbidden). Frictions are gathered
  afterwards, in runs that are not counted.
- **Nothing in between**: an agent is never corrected, restarted or helped. A failed run counts
  ("Success" and "Failures as 0"). Only exception: a failure of the bench itself (stack down,
  expired token), written down, and the run redone.

## Running

In the background, **one run at a time** (parallel runs compete for the rendering browser and
skew the times), output to a log file:

```bash
S=harness
I=<screens folder>
for n in 1 2 3; do
  for pipeline in saymock figma; do
    node $S/run.mjs --bench $B --screen $I/ios/reference.png     --scale 3     --pipeline $pipeline --repeat $n --model opus --budget 15
    node $S/run.mjs --bench $B --screen $I/android/reference.png --scale 2.625 --pipeline $pipeline --repeat $n --model opus --budget 15
    node $S/run.mjs --bench $B --screen $I/web/reference.png     --scale 2     --pipeline $pipeline --repeat $n --model opus --budget 15
  done
done > $B/runs.log 2>&1
```

Alternating the pipelines at each repetition keeps one tool from alone getting a quiet hour or an
outage.

## Judging and summarizing

Double blind: `blind.mjs` gives each result a random id, two independent judges score each pack
(`score-a.json`, `score-b.json`) with the rubric (`harness/rubric.md`), `merge-judges.mjs` merges
them, then `summarize.mjs` computes the summary. Judges may read the screen's `SOURCES.md` to check
colors and sizes; they never see the pipeline. Changing the rubric or the prompt along the way
means redoing everything.

## What gets published

A figure is published only if it comes from a benchmark run under this protocol:

- the medians per screen, averaged over the screens, with the number of screens and repetitions;
- a gap under ~5 points is a tie, and is called one;
- cost ratios between pipelines in tokens and in dollars;
- the date, the model and a link to the report.
