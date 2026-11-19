#!/usr/bin/env node
/**
 * Double blind judging: merges the independent scores of one pack (score-a.json, score-b.json,
 * …) into the score.json that summarize.mjs reads.
 *
 *   node merge-judges.mjs <bench-dir>
 *
 * Criteria are averaged (one decimal), subtotals recomputed from them; defects and strengths of
 * every judge are kept; `judges` records each judge's total and `spread` their largest gap, so a
 * disagreement shows up. Prints one line per pack.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const VISUAL = ["layout", "typography", "color", "icons", "content", "pixel"];
const EDIT = ["hierarchy", "layoutPrimitives", "reuse", "cleanliness"];
const round = (x) => Math.round(x * 10) / 10;
const sum = (o, keys) => round(keys.reduce((t, k) => t + (o[k] ?? 0), 0));

const bench = resolve(process.argv[2] ?? "");
const judgeDir = join(bench, "_judge");
if (!process.argv[2] || !existsSync(judgeDir)) {
  console.error("usage: merge-judges.mjs <bench-dir> (after blind.mjs and the judges)");
  process.exit(2);
}

for (const id of readdirSync(judgeDir)) {
  const dir = join(judgeDir, id);
  if (!existsSync(join(dir, "reference.png"))) continue;
  const files = readdirSync(dir)
    .filter((f) => /^score-[a-z]\.json$/.test(f))
    .sort();
  if (!files.length) {
    console.log(`${id}: no judge yet`);
    continue;
  }
  const judges = files.map((f) => ({
    name: f.slice(6, -5),
    ...JSON.parse(readFileSync(join(dir, f), "utf8")),
  }));
  for (const j of judges) {
    const t = sum(j.scores, [...VISUAL, ...EDIT]);
    if (Math.abs(t - j.total) > 0.5)
      console.warn(`${id}/score-${j.name}.json: criteria add up to ${t}, total says ${j.total}`);
  }
  const scores = Object.fromEntries(
    [...VISUAL, ...EDIT].map((k) => [
      k,
      round(judges.reduce((t, j) => t + j.scores[k], 0) / judges.length),
    ]),
  );
  const totals = judges.map((j) => sum(j.scores, [...VISUAL, ...EDIT]));
  const merged = {
    candidate: id,
    verdict: judges.map((j) => j.verdict).join(" / "),
    metrics: judges[0].metrics,
    scores,
    visual: sum(scores, VISUAL),
    editability: sum(scores, EDIT),
    total: sum(scores, [...VISUAL, ...EDIT]),
    judges: Object.fromEntries(judges.map((j, i) => [j.name, totals[i]])),
    spread: round(Math.max(...totals) - Math.min(...totals)),
    top_defects: judges.flatMap((j) => j.top_defects ?? []),
    strengths: [...new Set(judges.flatMap((j) => j.strengths ?? []))],
  };
  writeFileSync(join(dir, "score.json"), JSON.stringify(merged, null, 2));
  console.log(
    `${id}: ${merged.total} (${files.length} judges: ${totals.join(", ")}; spread ${merged.spread})`,
  );
}
