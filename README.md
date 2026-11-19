# Saymock vs Figma MCP: a design benchmark for AI agents

The same coding agent reproduced three real Wikipedia screens as **editable designs**, once with
[Saymock](https://saymock.com/en/?utm_source=github-benchmark&utm_medium=github)'s MCP server and
once with Figma's official MCP server: 3 screens × 3 runs × 2 tools = 18 runs, all scored blind by
two independent judges. This repository holds the protocol, the harness, the prompt, every run's
measurements, both judges' scores and the agent transcripts.

Run on November 12, 2026 by the makers of Saymock. Read the limits below before quoting it.

## Results

Median of the 3 runs per screen, then the mean of the 3 screens.

| Per screen          | Saymock MCP | Figma MCP |  Difference |
| ------------------- | ----------: | --------: | ----------: |
| Tokens processed    |       1.88M |     2.74M |  31% fewer  |
| Output tokens       |         30k |       61k |  50% fewer  |
| Cost (API prices)   |       $1.70 |     $2.69 |  37% lower  |
| Time                |     5.4 min |   9.8 min | 1.8× faster |
| Tool errors         |         1.0 |       4.0 |  4× fewer   |
| Score /100          |        79.0 |      82.2 |    a tie    |
| Visual fidelity /60 |        47.0 |      49.7 |             |
| Editability /40     |        31.3 |      32.8 |             |
| Successful runs     |         9/9 |       9/9 |             |

- **Quality is a tie.** Figma leads by 3.2 points on average, under the protocol's 5-point
  threshold. It scored higher on each of the three screens: +1.5 (iPhone), +6.0 (Android),
  +2.0 (web).
- **Cost.** Saymock used fewer tokens, above all output tokens (half as many), the most expensive
  ones, hence a larger gap in dollars (−37%) than in tokens (−31%).
- **Exception.** On the iPhone screen, Saymock's median run processed more tokens than Figma's
  (3.07M vs 1.91M) while costing less ($2.29 vs $2.58).
- The two judges were at most 5 points apart on any run.

| Screen  | Score Saymock | Score Figma | Tokens Saymock | Tokens Figma | Cost Saymock | Cost Figma | Time Saymock | Time Figma |
| ------- | ------------: | ----------: | -------------: | -----------: | -----------: | ---------: | -----------: | ---------: |
| iPhone  |          78.5 |        80.0 |          3.07M |        1.91M |        $2.29 |      $2.58 |      6.9 min |    9.7 min |
| Android |          78.0 |        84.0 |          1.20M |        3.14M |        $1.44 |      $2.88 |      4.6 min |   10.5 min |
| Web     |          80.5 |        82.5 |          1.38M |        3.18M |        $1.38 |      $2.62 |      4.8 min |    9.2 min |

All 18 runs, one line each: [`results/runs.csv`](results/runs.csv). Saymock's first iPhone run
(85 turns, 6.83M tokens) is the outlier of the benchmark; the median sets it aside.

What the judges held against each tool (details in each run's `score-a.json` and `score-b.json`):

- **Saymock**: letter spacing of the fallback font (Roboto without Android's 0.25 sp, no SF Pro on
  iOS) shifts some line breaks; a few icon glyphs; colors and margins repeated as arbitrary values,
  few templates outside the navigation bars.
- **Figma**: Inter instead of SF Pro on iOS, an opaque tab bar; corner radii too large; neither text
  styles nor color variables, fractional spacing.

## Setup

- **Task**: reproduce a screenshot of a real app screen as an editable design, at its exact size,
  with the app's real assets (photos, icons, logo, font names). Same prompt for both tools
  ([`harness/prompt.md`](harness/prompt.md) and [`harness/prompt-assets.md`](harness/prompt-assets.md)),
  each pipeline adding only how to create its file.
- **Screens**: Wikipedia's home ("Community" feed) on iPhone (430×932 @3) and Android (411×923
  @2.625), and Wikipedia's Main Page on desktop web (1440×900 @2). Capture conditions and the
  measured styles the judges could check against: [`screens/`](screens/).
- **Agent**: Claude Code 2.1.311, headless, `--model opus` (Claude Opus 5.5), $15 and 45 min per
  run, one run at a time, pipelines alternated at each repetition.
- **One MCP server per run**: Saymock's production server (`https://app.saymock.com/mcp`), or
  Figma's official server through a strict MCP config that declares nothing else
  ([`harness/figma.mcp.json`](harness/figma.mcp.json)).
- **No help**: no run was corrected, retried or nudged. A failed run would have counted (none
  failed). One bench failure (the machine locked during a Figma Android run) was killed and redone,
  as the protocol allows.
- **Export**: Saymock through `get_screenshot` and `get_html`; Figma through its REST API.
- **Scoring**: each result was renamed to a random id, then scored by two independent judge agents
  on a 100-point rubric (visual fidelity /60: layout, typography, color, icons and images, content,
  pixel measure; editability /40: hierarchy and names, fluid layout, reuse, cleanliness):
  [`harness/rubric.md`](harness/rubric.md). The score of a run is the mean of both judges.
- **Costs** are as measured by Claude Code for the design agent, at API prices: tokens processed
  (new input, cache reads and writes, output), dollars, minutes, turns, tool calls and errors.

The full protocol: [`PROTOCOL.md`](PROTOCOL.md).

## Limits

- **One app, one model.** Three screens of Wikipedia, one agent (Claude Code with Claude Opus 5.5).
  Other apps, other models or other prompts may give other results.
- **Model judges.** The scores come from two judge agents, not from people. Their rubric is public
  and their reasons are in each `score-*.json`.
- **Run by the makers of Saymock.** Everything needed to check it is here; the harness is the one
  we used, not a neutral third party's.
- **Saymock ran in production**, on the founder's account, rather than in the dedicated test stack
  the protocol asks for.
- **Small sample.** 3 runs per screen: a difference under ~5 points is noise.
- An earlier pilot (2 iPad screens, 1 run per tool, no assets) showed larger gaps; this benchmark
  supersedes it.

## What is in this repository

```
PROTOCOL.md                  how the benchmark is run and what makes it fair
harness/                     run.mjs (one run), blind.mjs, merge-judges.mjs, summarize.mjs,
                             the prompt, Figma's strict MCP config, the judges' rubric
screens/<screen>/SOURCES.md  capture conditions and measured styles of each reference
runs/<screen>/<tool>-<n>/
  run.json                   cost, tokens, time, turns, tool calls and errors
  stats.json                 structure counters of the result (layers, auto layout, reuse…)
  structure.*                the result's structure: Saymock's HTML, Figma's node tree
  pixel-metrics.json         pixel comparison with the reference
  score-a.json, score-b.json the two judges' scores, reasons and top defects
  transcript.jsonl.gz        the agent's full Claude Code transcript
results/
  runs.csv                   one line per run
  summary.json               the summary computed by summarize.mjs
```

**Not published**: the screenshots, the references and the assets. They show Wikimedia's and
third parties' logos and marks, so images are stripped from the transcripts too (`"image not
published"`, `<base64 image omitted>`). Also replaced: local paths (`~`), expired upload links,
Saymock asset URLs and the Figma file key of the working file.

The harness was written inside Saymock's repository: it reads the screens from that repository's
`docs/inspiration/` and expects its dev tooling (`pnpm dev:token`). It documents exactly what was
run; to rerun it elsewhere, give `run.mjs` your own `--screen` references, `MCP_URL` and
`SAYMOCK_TOKEN` for Saymock, `FIGMA_TOKEN` for the Figma export, and the Figma MCP signed in once.

## License

The harness code is under the MIT license ([`LICENSE`](LICENSE)). The data, scores and texts are
under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/): cite "Saymock design benchmark,
2026-11-12" with a link to this repository or to
[saymock.com/en/benchmark](https://saymock.com/en/benchmark/?utm_source=github-benchmark&utm_medium=github).
Wikipedia's text reproduced in the results and transcripts is Wikipedia's, under
[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/); Wikipedia is a trademark of the
Wikimedia Foundation, which has nothing to do with this benchmark.
