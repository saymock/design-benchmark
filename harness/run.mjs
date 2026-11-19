#!/usr/bin/env node
/**
 * One benchmark run: a headless Claude Code agent reproduces a reference screen
 * with one pipeline (saymock or Figma), then the result is exported and measured.
 * claude-design is a manual pipeline: a person runs it in Claude Design and writes run.json,
 * then `--export-only` renders its HTML export (docs/benchmarks/PROTOCOL.md).
 *
 *   node run.mjs --bench <dir> --screen <reference.png> --pipeline saymock|figma|claude-design
 *                [--repeat 1] [--model opus] [--budget 15] [--timeout-min 45]
 *                [--scale 1]          # pixel density of the reference (3 = iPhone screenshot)
 *                [--name <screen>]    # default: the file name, or <set>-<platform> for
 *                                     # docs/inspiration/<set>/<platform>/reference.png
 *                [--assets <dir>]     # default: assets/ next to the reference, if any
 *                [--export-only]      # redo export + pixel metrics of an existing run
 *                [--extra-prompt f]   # text appended to the core prompt (e.g. a friction log)
 *
 * Writes <bench>/<screen>/<pipeline>-<repeat>/:
 *   work/reference.png  the agent's working directory (the reference, and assets/ if any)
 *   prompt.md           exact prompt sent
 *   transcript.jsonl    claude --output-format stream-json
 *   run.json            cost, tokens, time, turns, tool calls, errors, MCP servers, result ids
 *   render.png          the design rendered at the reference size
 *   structure.html | structure.json + structure.txt   the editable design
 *   stats.json          structural counts (layers, auto-layout, reuse, names)
 *   compare/            heatmap, side-by-side, metrics.json (design-fidelity-judge/compare.cjs)
 *
 * Env (root .env of the repo is loaded): MCP_URL + SAYMOCK_TOKEN for saymock,
 * FIGMA_TOKEN (personal access token, read-only scopes) for the Figma export.
 */
import { spawn, spawnSync } from "node:child_process";
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "../../../..");
try {
  process.loadEnvFile(join(repo, ".env"));
} catch {}

const opts = parseArgs(process.argv.slice(2));
const pipelineName = opts.pipeline;
const pipeline = PIPELINES()[pipelineName];
if (!opts.bench || !opts.screen || !pipeline) {
  console.error(
    "usage: run.mjs --bench <dir> --screen <ref.png> --pipeline saymock|figma|claude-design [--repeat n] [--model m] [--budget usd] [--timeout-min n] [--scale n] [--name s] [--assets dir] [--export-only]",
  );
  process.exit(2);
}
const screenPath = resolve(opts.screen);
const fileName = basename(screenPath).replace(/\.[a-z]+$/i, "");
// docs/inspiration/<set>/ios/reference.png → "<set>-ios".
const screen =
  opts.name ??
  (fileName === "reference"
    ? `${basename(dirname(dirname(screenPath)))}-${basename(dirname(screenPath))}`
    : fileName);
/** The screen's real files (images, icons, fonts.md), given to every pipeline alike. */
const assetsDir = opts.assets
  ? resolve(opts.assets)
  : existsSync(join(dirname(screenPath), "assets"))
    ? join(dirname(screenPath), "assets")
    : null;
const repeat = Number(opts.repeat ?? 1);
const model = opts.model ?? "opus";
const dir = resolve(opts.bench, screen, `${pipelineName}-${repeat}`);
const work = join(dir, "work");
const [PW, PH] = pngSize(screenPath);
/** Reference pixel density: the frame is PW/scale × PH/scale CSS px, rendered back at `scale`. */
const scale = Number(opts.scale ?? 1);
const W = Math.round(PW / scale);
const H = Math.round(PH / scale);

if (!opts["export-only"] && pipeline.manual) {
  console.error(
    `${pipelineName} is run by hand (docs/benchmarks/PROTOCOL.md): write ${dir}/run.json and the export, then pass --export-only.`,
  );
  process.exit(2);
}
if (!opts["export-only"]) {
  mkdirSync(work, { recursive: true });
  copyFileSync(screenPath, join(work, "reference.png"));
  if (assetsDir) cpSync(assetsDir, join(work, "assets"), { recursive: true });
  const prompt = buildPrompt();
  writeFileSync(join(dir, "prompt.md"), prompt);
  const run = await runAgent(prompt);
  writeFileSync(join(dir, "run.json"), JSON.stringify(run, null, 2));
  console.log(
    `${screen}/${pipelineName}-${repeat}: ${run.status} $${run.costUsd?.toFixed(2)} ${run.minutes?.toFixed(1)} min ${run.turns} turns`,
  );
  if (run.status !== "ok") process.exit(1);
}

const run = JSON.parse(readFileSync(join(dir, "run.json"), "utf8"));
if (!run.result) {
  console.error(`No RESULT line in the agent's answer: see ${dir}/transcript.jsonl`);
  process.exit(1);
}
await pipeline.export(run.result);
const metrics = spawnSync(
  "node",
  [
    join(repo, ".claude/skills/design-fidelity-judge/scripts/compare.cjs"),
    screenPath,
    join(dir, "render.png"),
    join(dir, "compare"),
  ],
  { cwd: repo, encoding: "utf8" },
);
if (metrics.status !== 0) throw new Error(`compare.cjs failed: ${metrics.stderr}`);
writeFileSync(join(dir, "compare/metrics.json"), metrics.stdout);
const m = JSON.parse(metrics.stdout);
console.log(
  `exported ${dir}: meanDiff ${m.meanDiff}, pctDiff ${m.pctDiff}%, sizeMatch ${m.sizeMatch}`,
);

// ---------------------------------------------------------------------------

function PIPELINES() {
  return {
    saymock: {
      tool: "saymock",
      // Only saymock's MCP server, nothing from the user's config.
      mcpArgs: () => {
        if (!process.env.SAYMOCK_TOKEN)
          throw new Error("SAYMOCK_TOKEN missing: run `pnpm dev:token`.");
        const url = process.env.MCP_URL ?? `http://localhost:${process.env.PORT ?? 4000}/mcp`;
        const config = {
          mcpServers: {
            saymock: {
              type: "http",
              url,
              headers: { Authorization: `Bearer ${process.env.SAYMOCK_TOKEN}` },
            },
          },
        };
        return ["--strict-mcp-config", "--mcp-config", JSON.stringify(config)];
      },
      allowed: ["mcp__saymock"],
      expects: "saymock",
      instructions: `Use the saymock MCP tools. Create a new saymock file named "{name}" containing one frame of exactly {W}×{H}.
When done, print as the very last line: RESULT {"fileId":"<file id>","frameId":"<frame id>"}`,
      export: exportSaymock,
    },
    figma: {
      tool: "Figma",
      // A dedicated MCP config if present (pipelines/figma.mcp.json), else the user's
      // connectors (claude.ai Figma). run.json lists the servers that were loaded.
      mcpArgs: () => {
        const file = join(here, "../pipelines/figma.mcp.json");
        return existsSync(file) ? ["--strict-mcp-config", "--mcp-config", file] : [];
      },
      allowed: ["mcp__figma", "mcp__claude_ai_Figma"],
      expects: "figma",
      // --figma-file <key> (or a `figma-file` file in the bench dir): work in an existing
      // file, one page per run, instead of creating a file (whose team/plan is a guess).
      instructions: `${
        figmaFileKey()
          ? `Use the Figma MCP tools. Work in the existing Figma design file with key "${figmaFileKey()}": add a new page named "{name}" and, on it, one top-level frame of exactly {W}×{H}. Do not touch the other pages.`
          : `Use the Figma MCP tools. Create a new Figma design file named "{name}" with one top-level frame of exactly {W}×{H}.`
      }
When done, print as the very last line: RESULT {"fileKey":"<file key>","nodeId":"<frame node id, e.g. 1:2>"}`,
      export: exportFigma,
    },
    "claude-design": {
      tool: "Claude Design",
      manual: true,
      export: exportHtmlFile,
    },
  };
}

function figmaFileKey() {
  if (opts["figma-file"]) return opts["figma-file"];
  const file = join(resolve(opts.bench), "figma-file");
  return existsSync(file) ? readFileSync(file, "utf8").trim() : null;
}

function buildPrompt() {
  const name = `bench ${screen} ${pipelineName}-${repeat}`;
  const fill = (s) => s.replaceAll("{name}", name).replaceAll("{W}", W).replaceAll("{H}", H);
  const core = readFileSync(join(here, "../prompt.md"), "utf8");
  const assets = assetsDir
    ? `\n\n${readFileSync(join(here, "../prompt-assets.md"), "utf8").trim()}`
    : "";
  // --extra-prompt <file>: text added before the pipeline's instructions (e.g. a friction log
  // asked of one pipeline only). It changes the prompt: say so in the benchmark's NOTES.md.
  const extra = opts["extra-prompt"]
    ? `\n\n${readFileSync(opts["extra-prompt"], "utf8").trim()}`
    : "";
  return `${fill(core)}${assets}${extra}\n\n${fill(pipeline.instructions)}\n`;
}

/** Runs claude headless in the empty work dir; parses the stream-json transcript. */
function runAgent(prompt) {
  const args = [
    "-p",
    "--output-format",
    "stream-json",
    "--verbose",
    "--model",
    model,
    "--max-budget-usd",
    String(opts.budget ?? 15),
    "--no-session-persistence",
    "--permission-mode",
    "dontAsk",
    ...pipeline.mcpArgs(),
    "--allowedTools",
    "Read",
    "Glob",
    "Bash",
    "Skill",
    "ToolSearch",
    ...pipeline.allowed,
  ];
  const started = Date.now();
  return new Promise((done) => {
    const child = spawn("claude", args, { cwd: work, stdio: ["pipe", "pipe", "pipe"] });
    const out = [];
    const err = [];
    child.stdout.on("data", (d) => out.push(d));
    child.stderr.on("data", (d) => err.push(d));
    child.stdin.end(prompt);
    const timer = setTimeout(
      () => child.kill("SIGTERM"),
      Number(opts["timeout-min"] ?? 45) * 60_000,
    );
    child.on("close", (code) => {
      clearTimeout(timer);
      const text = Buffer.concat(out).toString("utf8");
      writeFileSync(join(dir, "transcript.jsonl"), text);
      if (err.length) writeFileSync(join(dir, "stderr.log"), Buffer.concat(err));
      done(parseTranscript(text, code, Date.now() - started));
    });
  });
}

function parseTranscript(text, exitCode, wallMs) {
  const events = text
    .split("\n")
    .filter(Boolean)
    .flatMap((l) => {
      try {
        return [JSON.parse(l)];
      } catch {
        return [];
      }
    });
  const init = events.find((e) => e.type === "system" && e.subtype === "init");
  const results = events.filter((e) => e.type === "result");
  const result = results.at(-1);
  const sum = (list, key) => list.reduce((t, e) => t + (e[key] ?? 0), 0);
  const toolCalls = {};
  let toolErrors = 0;
  for (const e of events) {
    for (const block of e.message?.content ?? []) {
      if (e.type === "assistant" && block.type === "tool_use")
        toolCalls[block.name] = (toolCalls[block.name] ?? 0) + 1;
      if (e.type === "user" && block.type === "tool_result" && block.is_error) toolErrors++;
    }
  }
  const usage = Object.values(result?.modelUsage ?? {}).reduce(
    (t, u) => ({
      input: t.input + (u.inputTokens ?? 0),
      cacheRead: t.cacheRead + (u.cacheReadInputTokens ?? 0),
      cacheWrite: t.cacheWrite + (u.cacheCreationInputTokens ?? 0),
      output: t.output + (u.outputTokens ?? 0),
    }),
    { input: 0, cacheRead: 0, cacheWrite: 0, output: 0 },
  );
  const answer = result?.result ?? "";
  const line = answer.split("\n").findLast((l) => l.trim().startsWith("RESULT "));
  let parsed = null;
  try {
    parsed = line ? JSON.parse(line.trim().slice(7)) : null;
  } catch {}
  const mcpServers = (init?.mcp_servers ?? []).map((s) => `${s.name}:${s.status}`);
  // claude.ai connectors are still "pending" at init and connect lazily: a run that called the
  // pipeline's tools had the server, whatever init said.
  const expected =
    (init?.mcp_servers ?? []).some(
      (s) => s.name.toLowerCase().includes(pipeline.expects) && s.status === "connected",
    ) || Object.keys(toolCalls).some((t) => pipeline.allowed.some((p) => t.startsWith(p)));
  const status = !result
    ? `failed (exit ${exitCode}, no result event)`
    : result.is_error || result.subtype !== "success"
      ? `failed (${result.subtype ?? "error"})`
      : !expected
        ? `failed (${pipeline.expects} MCP server not connected)`
        : !parsed
          ? "failed (no RESULT line)"
          : "ok";
  return {
    screen,
    pipeline: pipelineName,
    repeat,
    status,
    model: init?.model ?? model,
    claudeCodeVersion: init?.claude_code_version,
    mcpServers,
    costUsd: result?.total_cost_usd ?? null,
    // An agent waiting on background tasks ends several "result" events: durations and turns are
    // per segment (the cost is cumulative), so add them up.
    minutes: (sum(results, "duration_ms") || wallMs) / 60_000,
    apiMinutes: sum(results, "duration_api_ms") / 60_000,
    turns: result ? sum(results, "num_turns") : null,
    tokens: { ...usage, total: usage.input + usage.cacheRead + usage.cacheWrite + usage.output },
    toolCalls,
    toolCallsTotal: Object.values(toolCalls).reduce((a, b) => a + b, 0),
    toolErrors,
    permissionDenials: result?.permission_denials?.length ?? 0,
    result: parsed,
    date: new Date().toISOString(),
  };
}

async function exportSaymock({ fileId, frameId }) {
  // Resolved from the repo's node_modules (root devDependency).
  const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
  const { StreamableHTTPClientTransport } = await import(
    "@modelcontextprotocol/sdk/client/streamableHttp.js"
  );
  const url = process.env.MCP_URL ?? `http://localhost:${process.env.PORT ?? 4000}/mcp`;
  const client = new Client({ name: "saymock-bench", version: "1.0.0" });
  await client.connect(
    new StreamableHTTPClientTransport(new URL(url), {
      requestInit: { headers: { Authorization: `Bearer ${process.env.SAYMOCK_TOKEN ?? ""}` } },
    }),
  );
  const call = async (name, args) => {
    const res = await client.callTool({ name, arguments: args });
    if (res.isError) throw new Error(`${name}: ${res.content[0]?.text}`);
    return res.content[0];
  };
  const shot = await call("get_screenshot", { fileId, frameId, scale });
  writeFileSync(join(dir, "render.png"), Buffer.from(shot.data, "base64"));
  const html = (await call("get_html", { fileId, nodeId: frameId })).text;
  writeFileSync(join(dir, "structure.html"), html);
  await client.close();
  writeFileSync(join(dir, "stats.json"), JSON.stringify(htmlStats(html), null, 2));
}

async function exportFigma({ fileKey, nodeId }) {
  const token = process.env.FIGMA_TOKEN;
  // Without a token the export can be done by hand through the Figma MCP (render.png at the
  // reference size, structure.txt and stats.json computed in use_figma): keep it.
  const manual = ["render.png", "structure.txt", "stats.json"].every((f) =>
    existsSync(join(dir, f)),
  );
  if (!token && manual) return;
  if (!token)
    throw new Error("FIGMA_TOKEN missing (Figma personal access token, file_content:read).");
  const api = async (path) => {
    const res = await fetch(`https://api.figma.com/v1${path}`, {
      headers: { "X-Figma-Token": token },
    });
    if (!res.ok) throw new Error(`Figma ${path}: HTTP ${res.status} ${await res.text()}`);
    return res.json();
  };
  const ids = encodeURIComponent(nodeId);
  const images = await api(`/images/${fileKey}?ids=${ids}&format=png&scale=${scale}`);
  const png = await fetch(Object.values(images.images)[0]);
  writeFileSync(join(dir, "render.png"), Buffer.from(await png.arrayBuffer()));
  const nodes = await api(`/files/${fileKey}/nodes?ids=${ids}`);
  const doc = Object.values(nodes.nodes)[0];
  writeFileSync(join(dir, "structure.json"), JSON.stringify(doc, null, 1));
  writeFileSync(join(dir, "structure.txt"), outline(doc.document));
  writeFileSync(join(dir, "stats.json"), JSON.stringify(figmaStats(doc.document), null, 2));
}

/**
 * A design exported as an HTML file (Claude Design's "standalone HTML"): `export/` in the run
 * directory holds it (index.html, or the only .html file) with its files. It is rendered in
 * Chromium at the reference's CSS size and density, after its scripts ran; the rendered DOM,
 * scripts removed, is the structure the judge reads.
 */
async function exportHtmlFile() {
  const { readdirSync } = await import("node:fs");
  const exportDir = join(dir, "export");
  const htmlFiles = existsSync(exportDir)
    ? readdirSync(exportDir).filter((f) => f.endsWith(".html"))
    : [];
  const file = htmlFiles.includes("index.html") ? "index.html" : htmlFiles[0];
  if (!file || (htmlFiles.length > 1 && !htmlFiles.includes("index.html")))
    throw new Error(`${exportDir}: put the HTML export there (index.html or a single .html file).`);
  const { chromium } = await import("playwright");
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      viewport: { width: W, height: H },
      deviceScaleFactor: scale,
    });
    await page.goto(`file://${join(exportDir, file)}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: join(dir, "render.png") });
    // Stats from computed styles: an exported page lays out with CSS, not Tailwind classes.
    // Reuse cannot be seen in a flat DOM (components are gone): null, not 0.
    const { html, stats } = await page.evaluate(() => {
      const els = [...document.body.querySelectorAll("*")].filter(
        (el) => !["SCRIPT", "NOSCRIPT", "STYLE"].includes(el.tagName),
      );
      const cs = (el) => getComputedStyle(el);
      const body = document.body.cloneNode(true);
      for (const el of body.querySelectorAll("script, noscript")) el.remove();
      return {
        html: body.outerHTML,
        stats: {
          layers: els.length,
          text: els.filter((el) =>
            [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()),
          ).length,
          autoLayout: els.filter((el) => /^(inline-)?(flex|grid)$/.test(cs(el).display)).length,
          absolute: els.filter((el) => /^(absolute|fixed)$/.test(cs(el).position)).length,
          named: els.filter((el) => el.hasAttribute("data-name")).length,
          reuse: null,
          images: els.filter(
            (el) => el.tagName === "IMG" || cs(el).backgroundImage.includes("url("),
          ).length,
          vectors: els.filter((el) => el.tagName === "svg").length,
        },
      };
    });
    writeFileSync(join(dir, "structure.html"), html);
    writeFileSync(join(dir, "stats.json"), JSON.stringify(stats, null, 2));
  } finally {
    await browser.close();
  }
}

/** Structural counts for saymock HTML (comparable with figmaStats). */
function htmlStats(html) {
  const tags = html.match(/<(?!\/|!)([a-z][a-z0-9-]*)/gi) ?? [];
  const classes = [...html.matchAll(/class="([^"]*)"/g)].map((m) => m[1].split(/\s+/));
  const has = (re) => classes.filter((c) => c.some((x) => re.test(x))).length;
  return {
    layers: tags.length,
    text: [...html.matchAll(/>([^<>]*\S[^<>]*)</g)].length,
    autoLayout: has(/^(flex|inline-flex|grid|inline-grid)$/),
    absolute: has(/^(absolute|fixed)$/),
    named: (html.match(/data-name="/g) ?? []).length,
    // Repeated lists and component uses (attribute order varies: data-id comes first).
    reuse:
      (html.match(/<template\b[^>]*\bdata-each=/g) ?? []).length +
      (html.match(/\bdata-use=/g) ?? []).length,
    images: (html.match(/<img\b/g) ?? []).length,
    arbitraryValues: classes.flat().filter((c) => /\[[^\]]+\]/.test(c)).length,
  };
}

function figmaStats(root) {
  const s = {
    layers: 0,
    text: 0,
    autoLayout: 0,
    absolute: 0,
    named: 0,
    reuse: 0,
    components: 0,
    images: 0,
    vectors: 0,
    styled: 0,
    byType: {},
  };
  const defaultName =
    /^(Frame|Group|Rectangle|Ellipse|Vector|Line|Text|Component|Instance|Polygon|Star)( \d+)?$/;
  (function walk(n, parentAuto) {
    s.layers++;
    s.byType[n.type] = (s.byType[n.type] ?? 0) + 1;
    if (n.type === "TEXT") s.text++;
    if (n.layoutMode && n.layoutMode !== "NONE") s.autoLayout++;
    if (n.type !== "TEXT" && !defaultName.test(n.name ?? "")) s.named++;
    if (n.type === "INSTANCE") s.reuse++;
    if (n.type === "COMPONENT" || n.type === "COMPONENT_SET") s.components++;
    if (["VECTOR", "BOOLEAN_OPERATION", "STAR", "POLYGON"].includes(n.type)) s.vectors++;
    if ((n.fills ?? []).some((f) => f.type === "IMAGE")) s.images++;
    if (n.styles || n.boundVariables) s.styled++;
    if (parentAuto && n.layoutPositioning === "ABSOLUTE") s.absolute++;
    if (!parentAuto && n !== root) s.absolute++;
    for (const c of n.children ?? []) walk(c, n.layoutMode && n.layoutMode !== "NONE");
  })(root, false);
  return s;
}

/** Readable outline of a Figma node tree for the judge. */
function outline(n, depth = 0) {
  const box = n.absoluteBoundingBox
    ? ` ${Math.round(n.absoluteBoundingBox.width)}×${Math.round(n.absoluteBoundingBox.height)}`
    : "";
  const layout =
    n.layoutMode && n.layoutMode !== "NONE"
      ? ` auto-layout:${n.layoutMode.toLowerCase()} gap:${n.itemSpacing ?? 0}`
      : "";
  const text =
    n.type === "TEXT"
      ? ` "${(n.characters ?? "").slice(0, 60)}" ${n.style?.fontFamily ?? ""} ${n.style?.fontWeight ?? ""} ${n.style?.fontSize ?? ""}px`
      : "";
  const line = `${"  ".repeat(depth)}${n.type} "${n.name}"${box}${layout}${text}\n`;
  return line + (n.children ?? []).map((c) => outline(c, depth + 1)).join("");
}

function pngSize(file) {
  const b = readFileSync(file);
  if (b.toString("ascii", 1, 4) !== "PNG") throw new Error(`${file} must be a PNG`);
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}

function parseArgs(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i].replace(/^--/, "");
    if (argv[i + 1] && !argv[i + 1].startsWith("--")) o[k] = argv[++i];
    else o[k] = true;
  }
  return o;
}
