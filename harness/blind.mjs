#!/usr/bin/env node
/**
 * Prepares blind judging packs: one folder per exported run, under a random id,
 * so the judge does not see which pipeline made it.
 *
 *   node blind.mjs <bench-dir>
 *
 * Creates <bench>/_judge/<id>/ with reference.png, render.png, structure.html or
 * structure.txt (Figma outline), stats.json, metrics.json, heatmap.png, side-by-side.png,
 * and records <bench>/_judge/mapping.json ({ id: "<screen>/<pipeline>-<n>" }), which the
 * judge must not read. Runs already packed are skipped. Prints the packs without a score.json.
 */
import { randomBytes } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";

const bench = resolve(process.argv[2] ?? "");
if (!process.argv[2] || !existsSync(bench)) {
  console.error("usage: blind.mjs <bench-dir>");
  process.exit(2);
}
const judgeDir = join(bench, "_judge");
mkdirSync(judgeDir, { recursive: true });
const mappingPath = join(judgeDir, "mapping.json");
const mapping = existsSync(mappingPath) ? JSON.parse(readFileSync(mappingPath, "utf8")) : {};
const packed = new Set(Object.values(mapping));

for (const screen of readdirSync(bench, { withFileTypes: true })) {
  if (!screen.isDirectory() || screen.name.startsWith("_")) continue;
  for (const run of readdirSync(join(bench, screen.name), { withFileTypes: true })) {
    const key = `${screen.name}/${run.name}`;
    const src = join(bench, key);
    if (!run.isDirectory() || packed.has(key) || !existsSync(join(src, "compare/metrics.json")))
      continue;
    const id = randomBytes(3).toString("hex");
    const dst = join(judgeDir, id);
    mkdirSync(dst);
    const copies = {
      "work/reference.png": "reference.png",
      "render.png": "render.png",
      "structure.html": "structure.html",
      "structure.txt": "structure.txt",
      "stats.json": "stats.json",
      "compare/metrics.json": "metrics.json",
      "compare/heatmap.png": "heatmap.png",
      "compare/side-by-side.png": "side-by-side.png",
    };
    for (const [from, to] of Object.entries(copies))
      if (existsSync(join(src, from))) copyFileSync(join(src, from), join(dst, to));
    // metrics.json carries its output path, which names the pipeline: keep numbers only.
    const metricsPath = join(dst, "metrics.json");
    const metrics = JSON.parse(readFileSync(metricsPath, "utf8"));
    for (const [k, v] of Object.entries(metrics))
      if (typeof v === "string" && v.includes("/")) delete metrics[k];
    writeFileSync(metricsPath, JSON.stringify(metrics, null, 2));
    mapping[id] = key;
  }
}
writeFileSync(mappingPath, JSON.stringify(mapping, null, 2));

const todo = Object.keys(mapping).filter((id) => !existsSync(join(judgeDir, id, "score.json")));
console.log(`${Object.keys(mapping).length} packs, ${todo.length} to judge:`);
for (const id of todo) console.log(`  ${join(judgeDir, id)}`);
