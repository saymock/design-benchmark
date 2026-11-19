#!/usr/bin/env node
/**
 * Aggregates a benchmark into <bench>/summary.md (for people) and summary.json.
 *
 *   node summarize.mjs <bench-dir>
 *
 * Reads every <screen>/<pipeline>-<n>/ (run.json, compare/metrics.json, stats.json)
 * and the judge's scores (_judge/<id>/score.json through _judge/mapping.json).
 * Repeats of a screen are reduced to their median, then screens are averaged, so
 * every screen weighs the same whatever the number of successful repeats.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const bench = resolve(process.argv[2] ?? "");
if (!process.argv[2] || !existsSync(bench)) {
  console.error("usage: summarize.mjs <bench-dir>");
  process.exit(2);
}
const read = (p) => (existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : null);

const CRITERIA = {
  layout: 15,
  typography: 12,
  color: 8,
  icons: 10,
  content: 10,
  pixel: 5,
  hierarchy: 10,
  layoutPrimitives: 12,
  reuse: 10,
  cleanliness: 8,
};

// ---- Load ------------------------------------------------------------------
const mapping = read(join(bench, "_judge/mapping.json")) ?? {};
const scoreOf = Object.fromEntries(
  Object.entries(mapping).map(([id, key]) => [key, read(join(bench, "_judge", id, "score.json"))]),
);
const runs = [];
for (const screen of readdirSync(bench, { withFileTypes: true })) {
  if (!screen.isDirectory() || screen.name.startsWith("_")) continue;
  for (const d of readdirSync(join(bench, screen.name), { withFileTypes: true })) {
    const dir = join(bench, screen.name, d.name);
    const run = read(join(dir, "run.json"));
    if (!d.isDirectory() || !run) continue;
    runs.push({
      ...run,
      key: `${screen.name}/${d.name}`,
      metrics: read(join(dir, "compare/metrics.json")),
      stats: read(join(dir, "stats.json")),
      score: scoreOf[`${screen.name}/${d.name}`] ?? null,
    });
  }
}
if (!runs.length) {
  console.error(`No run.json under ${bench}`);
  process.exit(1);
}
const pipelines = [...new Set(runs.map((r) => r.pipeline))].sort();
const screens = [...new Set(runs.map((r) => r.screen))].sort();

// ---- Stats helpers -----------------------------------------------------------
const nums = (xs) => xs.filter((x) => typeof x === "number" && Number.isFinite(x));
const median = (xs) => {
  const s = nums(xs).sort((a, b) => a - b);
  if (!s.length) return null;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const mean = (xs) => {
  const s = nums(xs);
  return s.length ? s.reduce((a, b) => a + b, 0) / s.length : null;
};
/** Median over the repeats of each screen, then mean over screens. */
const overScreens = (rs, f) =>
  mean(screens.map((s) => median(rs.filter((r) => r.screen === s).map(f))));
const fmt = (x, d = 1) => (x === null || x === undefined ? "–" : Number(x).toFixed(d));
/** Token counts read better than dollars: 5.2M, 340k. */
const tok = (x) => (!x ? "–" : x >= 1e6 ? `${fmt(x / 1e6, 1)}M` : `${fmt(x / 1000, 0)}k`);
const ok = (r) => r.status === "ok";
const scored = (r) => ok(r) && r.score;

// ---- Per pipeline --------------------------------------------------------------
const perPipeline = Object.fromEntries(
  pipelines.map((p) => {
    const all = runs.filter((r) => r.pipeline === p);
    const good = all.filter(scored);
    const okRuns = all.filter(ok);
    const total = overScreens(good, (r) => r.score.total);
    const cost = overScreens(okRuns, (r) => r.costUsd);
    const tokens = overScreens(okRuns, (r) => r.tokens?.total);
    return [
      p,
      {
        runs: all.length,
        ok: okRuns.length,
        scored: good.length,
        total,
        totalWithFailures: overScreens(all, (r) => (ok(r) ? r.score?.total : 0)),
        totalRange: [
          Math.min(...nums(good.map((r) => r.score.total))),
          Math.max(...nums(good.map((r) => r.score.total))),
        ],
        visual: overScreens(good, (r) => r.score.visual),
        editability: overScreens(good, (r) => r.score.editability),
        meanDiff: overScreens(okRuns, (r) => r.metrics?.meanDiff),
        costUsd: cost,
        minutes: overScreens(okRuns, (r) => r.minutes),
        turns: overScreens(okRuns, (r) => r.turns),
        toolCalls: overScreens(okRuns, (r) => r.toolCallsTotal),
        toolErrors: overScreens(okRuns, (r) => r.toolErrors),
        outputTokens: overScreens(okRuns, (r) => r.tokens?.output),
        totalTokens: tokens,
        // New context (uncached input + cache writes) vs. context re-read at each turn.
        newInputTokens: overScreens(okRuns, (r) =>
          r.tokens ? r.tokens.input + r.tokens.cacheWrite : null,
        ),
        cacheReadTokens: overScreens(okRuns, (r) => r.tokens?.cacheRead),
        costPerPoint: total && cost ? cost / total : null,
        tokensPerPoint: total && tokens ? tokens / total : null,
        lost: Object.fromEntries(
          Object.entries(CRITERIA).map(([c, max]) => [
            c,
            overScreens(good, (r) => max - (r.score.scores?.[c] ?? 0)),
          ]),
        ),
        structure: Object.fromEntries(
          ["layers", "autoLayout", "absolute", "named", "reuse", "images"].map((k) => [
            k,
            overScreens(okRuns, (r) => r.stats?.[k]),
          ]),
        ),
        models: [...new Set(all.map((r) => r.model))],
        mcpServers: [...new Set(all.flatMap((r) => r.mcpServers ?? []))],
        tools: topTools(okRuns),
        defects: defects(good),
      },
    ];
  }),
);

function topTools(rs) {
  const sum = {};
  for (const r of rs)
    for (const [k, v] of Object.entries(r.toolCalls ?? {})) sum[k] = (sum[k] ?? 0) + v;
  return Object.entries(sum)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([k, v]) => [k.replace(/^mcp__.*?__/, ""), +(v / Math.max(1, rs.length)).toFixed(1)]);
}

function defects(rs) {
  const byCriterion = {};
  for (const r of rs)
    for (const d of r.score.top_defects ?? []) {
      const o = typeof d === "string" ? { severity: "?", criterion: "?", what: d } : d;
      const key = o.criterion ?? "?";
      byCriterion[key] = [...(byCriterion[key] ?? []), { ...o, run: r.key }];
    }
  return Object.entries(byCriterion)
    .map(([criterion, list]) => ({
      criterion,
      count: list.length,
      major: list.filter((d) => d.severity === "major").length,
      examples: [...new Set(list.map((d) => `${d.where ? `${d.where}: ` : ""}${d.what}`))].slice(
        0,
        3,
      ),
    }))
    .sort((a, b) => b.major - a.major || b.count - a.count);
}

// ---- Per screen ------------------------------------------------------------------
const perScreen = Object.fromEntries(
  screens.map((s) => [
    s,
    Object.fromEntries(
      pipelines.map((p) => {
        const rs = runs.filter((r) => r.screen === s && r.pipeline === p);
        return [
          p,
          {
            runs: rs.length,
            ok: rs.filter(ok).length,
            total: median(rs.filter(scored).map((r) => r.score.total)),
            visual: median(rs.filter(scored).map((r) => r.score.visual)),
            editability: median(rs.filter(scored).map((r) => r.score.editability)),
            costUsd: median(rs.filter(ok).map((r) => r.costUsd)),
            totalTokens: median(rs.filter(ok).map((r) => r.tokens?.total)),
            minutes: median(rs.filter(ok).map((r) => r.minutes)),
            verdict: rs.find(scored)?.score.verdict ?? null,
          },
        ];
      }),
    ),
  ]),
);

// ---- Warnings ------------------------------------------------------------------------
const warnings = [];
for (const r of runs) {
  if (!ok(r)) warnings.push(`${r.key}: ${r.status}`);
  else if (!r.metrics) warnings.push(`${r.key}: not exported (run.mjs --export-only)`);
  else if (!r.score) warnings.push(`${r.key}: not judged yet (blind.mjs, then the judge)`);
  if (r.metrics && !r.metrics.sizeMatch)
    warnings.push(
      `${r.key}: render ${r.metrics.candidateSize?.join("×")} ≠ reference ${r.metrics.referenceSize?.join("×")}`,
    );
  if (r.permissionDenials)
    warnings.push(
      `${r.key}: ${r.permissionDenials} permission denials (tools missing from --allowedTools?)`,
    );
  if (r.score) {
    const sum = Object.keys(CRITERIA).reduce((t, c) => t + (r.score.scores?.[c] ?? 0), 0);
    const over = Object.entries(CRITERIA).filter(([c, max]) => (r.score.scores?.[c] ?? 0) > max);
    if (sum !== r.score.total)
      warnings.push(`${r.key}: judge's criteria add up to ${sum}, total says ${r.score.total}`);
    if (over.length)
      warnings.push(`${r.key}: score above maximum for ${over.map(([c]) => c).join(", ")}`);
  }
}
const models = [...new Set(runs.map((r) => r.model))];
if (models.length > 1) warnings.push(`Several models in one benchmark: ${models.join(", ")}`);
for (const p of pipelines) {
  const extra = perPipeline[p].mcpServers.filter((s) => !s.toLowerCase().includes(p));
  if (extra.length)
    warnings.push(
      `${p}: other MCP servers were loaded (${extra.join(", ")}): their tool definitions add to the cost`,
    );
}

// ---- Verdict ---------------------------------------------------------------------------
const verdict = [];
const ranked = [...pipelines].sort(
  (a, b) => (perPipeline[b].total ?? -1) - (perPipeline[a].total ?? -1),
);
for (const p of ranked) {
  const s = perPipeline[p];
  verdict.push(
    `**${p}**: ${fmt(s.total)}/100 (visual ${fmt(s.visual)}/60, editability ${fmt(s.editability)}/40), ${tok(s.totalTokens)} tokens and ${fmt(s.minutes)} min per screen, ${s.ok}/${s.runs} runs succeeded.`,
  );
}
if (ranked.length >= 2) {
  const [a, b] = ranked.map((p) => perPipeline[p]);
  const wins = screens.filter(
    (s) => (perScreen[s][ranked[0]].total ?? -1) > (perScreen[s][ranked[1]].total ?? -1),
  ).length;
  const ratio = a.totalTokens && b.totalTokens ? a.totalTokens / b.totalTokens : null;
  verdict.push(
    `**${ranked[0]}** leads **${ranked[1]}** by ${fmt((a.total ?? 0) - (b.total ?? 0))} points (visual ${fmt((a.visual ?? 0) - (b.visual ?? 0))}, editability ${fmt((a.editability ?? 0) - (b.editability ?? 0))}), wins ${wins}/${screens.length} screens, at ${ratio ? `${fmt(ratio, 2)}×` : "–"} the tokens.`,
  );
  const gaps = Object.keys(CRITERIA)
    .map((c) => [c, (b.lost[c] ?? 0) - (a.lost[c] ?? 0)])
    .sort((x, y) => Math.abs(y[1]) - Math.abs(x[1]))
    .slice(0, 3);
  verdict.push(
    `Largest differences: ${gaps.map(([c, d]) => `${c} (${d >= 0 ? ranked[0] : ranked[1]} +${fmt(Math.abs(d))})`).join(", ")}.`,
  );
}
if (screens.length < 5 || runs.length / Math.max(1, screens.length * pipelines.length) < 2)
  verdict.push(
    `_Small sample (${screens.length} screens, ${runs.length} runs): differences under ~5 points are noise._`,
  );

// ---- Markdown ---------------------------------------------------------------------------
const table = (head, rows) =>
  [
    `| ${head.join(" | ")} |`,
    `| ${head.map((_, i) => (i ? "---:" : "---")).join(" | ")} |`,
    ...rows.map((r) => `| ${r.join(" | ")} |`),
  ].join("\n");
const dates = runs
  .map((r) => r.date)
  .filter(Boolean)
  .sort();

const md = `# Design benchmark — ${bench.split("/").pop()}

${screens.length} screens × ${pipelines.length} pipelines (${pipelines.join(", ")}), ${runs.length} runs, model ${models.join(", ")}, ${dates[0]?.slice(0, 10) ?? ""}${dates.length > 1 && dates.at(-1).slice(0, 10) !== dates[0].slice(0, 10) ? ` → ${dates.at(-1).slice(0, 10)}` : ""}.

## Verdict

${verdict.map((v) => `- ${v}`).join("\n")}

## Quality

${table(
  [
    "Pipeline",
    "Score /100",
    "Range",
    "Failures as 0",
    "Visual /60",
    "Editability /40",
    "meanDiff",
    "Success",
  ],
  pipelines.map((p) => {
    const s = perPipeline[p];
    return [
      p,
      fmt(s.total),
      s.scored ? `${s.totalRange[0]}–${s.totalRange[1]}` : "–",
      fmt(s.totalWithFailures),
      fmt(s.visual),
      fmt(s.editability),
      fmt(s.meanDiff, 2),
      `${s.ok}/${s.runs}`,
    ];
  }),
)}

## Cost (per screen)

Tokens processed by the model, subagents included. "Cache reads" is the context re-read at each
turn (it grows with turns × context size, billed ~10× cheaper than new input). Dollars stay in
summary.json (\`costUsd\`).

${table(
  [
    "Pipeline",
    "Tokens",
    "New input",
    "Cache reads",
    "Output",
    "Tokens / point",
    "Time (min)",
    "Turns",
    "Tool calls",
    "Tool errors",
  ],
  pipelines.map((p) => {
    const s = perPipeline[p];
    return [
      p,
      tok(s.totalTokens),
      tok(s.newInputTokens),
      tok(s.cacheReadTokens),
      tok(s.outputTokens),
      tok(s.tokensPerPoint),
      fmt(s.minutes),
      fmt(s.turns, 0),
      fmt(s.toolCalls, 0),
      fmt(s.toolErrors, 1),
    ];
  }),
)}

## By screen

Median score over repeats (tokens, minutes). Best score in bold.

${table(
  ["Screen", ...pipelines],
  screens.map((s) => {
    const best = Math.max(...pipelines.map((p) => perScreen[s][p].total ?? -1));
    return [
      s,
      ...pipelines.map((p) => {
        const c = perScreen[s][p];
        if (!c.runs) return "–";
        const score =
          c.total === null ? "n/a" : c.total === best ? `**${fmt(c.total)}**` : fmt(c.total);
        return `${score} (${tok(c.totalTokens)} tokens, ${fmt(c.minutes)}′)${c.ok < c.runs ? ` ⚠ ${c.runs - c.ok} failed` : ""}`;
      }),
    ];
  }),
)}

${screens
  .map((s) =>
    pipelines
      .filter((p) => perScreen[s][p].verdict)
      .map((p) => `- **${s} / ${p}**: ${perScreen[s][p].verdict}`)
      .join("\n"),
  )
  .filter(Boolean)
  .join("\n")}

## Where points are lost

Mean points lost per criterion (max in parentheses). Higher = weaker.

${table(
  ["Criterion", ...pipelines],
  Object.entries(CRITERIA).map(([c, max]) => [
    `${c} (${max})`,
    ...pipelines.map((p) => fmt(perPipeline[p].lost[c])),
  ]),
)}

## Structure of the designs

Median per screen. Figma: auto-layout frames, instances as reuse; saymock: flex/grid elements, \`<template data-each>\` as reuse.

${table(
  ["Pipeline", "Layers", "Auto-layout", "Absolute", "Named", "Reuse", "Images"],
  pipelines.map((p) => {
    const s = perPipeline[p].structure;
    return [
      p,
      fmt(s.layers, 0),
      fmt(s.autoLayout, 0),
      fmt(s.absolute, 0),
      fmt(s.named, 0),
      fmt(s.reuse, 0),
      fmt(s.images, 0),
    ];
  }),
)}

## Recurring defects

${pipelines
  .map(
    (p) =>
      `### ${p}\n\n${
        perPipeline[p].defects.length
          ? perPipeline[p].defects
              .slice(0, 5)
              .map(
                (d) =>
                  `- **${d.criterion}**: ${d.count} defects (${d.major} major), e.g. ${d.examples.join("; ")}`,
              )
              .join("\n")
          : "_No judged runs._"
      }`,
  )
  .join("\n\n")}

## Process

${pipelines
  .map((p) => {
    const s = perPipeline[p];
    return `- **${p}**: ${s.tools.map(([t, n]) => `${t} ×${n}`).join(", ") || "–"} (mean calls per run). MCP servers: ${s.mcpServers.join(", ") || "–"}.`;
  })
  .join("\n")}

${warnings.length ? `## Warnings\n\n${warnings.map((w) => `- ${w}`).join("\n")}\n` : ""}
---
Scores: design-fidelity-judge (100 points: visual 60, editability 40), blind. Cost and tokens from
Claude Code (\`total_cost_usd\`, all models incl. subagents), export and judging excluded. Repeats are
reduced to their median per screen, then screens are averaged.
`;

writeFileSync(join(bench, "summary.md"), md);
writeFileSync(
  join(bench, "summary.json"),
  JSON.stringify(
    { perPipeline, perScreen, warnings, runs: runs.map(({ stats, metrics, ...r }) => r) },
    null,
    2,
  ),
);
console.log(md);
