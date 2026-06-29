#!/usr/bin/env node
// Suite runner for the measure-improve loop, built around a fixed baseline.
//
// The no-MCP baseline does not change as the graph engine improves, so it is
// measured ONCE at n=5 per prompt and cached as a constant; every later
// iteration runs only the graph arm at n=1, concurrently across all projects,
// and compares to that cached baseline. This makes each iteration cheap and
// fast while keeping the reference stable.
//
// Usage:
//   # one-time: fix the baseline (no MCP) at n=5 for every dedicated prompt
//   node run-suite.mjs --arm=baseline --runs=5 --harness=codex --model=gpt-5.4-mini
//   # each iteration: graph arm, n=1, all projects at once, vs the cached baseline
//   node run-suite.mjs --arm=graph --runs=1 --harness=codex --model=gpt-5.4-mini
//
// Flags: --family=dedicated|common|all (default dedicated, = one prompt/project),
// --concurrency (prompts in flight, default 4), --inner-concurrency (agent runs
// in flight inside one prompt, default = --runs), --baseline-store=<path>,
// --out=<combined report>, --no-setup, --no-website,
// --publish-suite=<combined report>.
import cp from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..", "..");
const work = path.join(repoRoot, "experimental", "benchmark", ".work");
const websiteJson = path.join(
  repoRoot,
  "website",
  "public",
  "benchmark",
  "graph.json",
);
const graphBenchmarkScript = path.join(
  repoRoot,
  "experimental",
  "benchmark",
  "graph.mjs",
);
const PUBLISHED_SAMPLE_KEYS = [
  "tokens",
  "cached",
  "reasoning",
  "tokensWithReasoning",
  "turns",
  "tools",
  "reads",
  "grep",
  "shell",
  "web",
  "graph",
  "other",
  "sourceTouches",
  "shellSource",
  "cost",
  "durMs",
  "ok",
  "invalid",
  "error",
  "run",
  "attempts",
];

// Match experimental/benchmark/graph.mjs, which owns fixture setup.
// Prepared clones live in .work/<repoName>@<branch>.
const PROJECTS = {
  excalidraw: {
    repoName: "ttsc-benchmark-excalidraw",
  },
  vscode: {
    repoName: "ttsc-benchmark-vscode",
  },
  nestjs: {
    repoName: "ttsc-benchmark-nestjs",
  },
  vue: {
    repoName: "ttsc-benchmark-vue",
  },
  zod: {
    repoName: "ttsc-benchmark-zod",
  },
  typeorm: {
    repoName: "ttsc-benchmark-typeorm",
  },
  rxjs: {
    repoName: "ttsc-benchmark-rxjs",
  },
  "shopping-backend": {
    repoName: "shopping-backend",
  },
};

function arg(name, fallback) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

const noWebsite = process.argv.includes("--no-website");
const publishSuitePath = arg("publish-suite");
if (publishSuitePath) {
  publishWebsiteReports(reportsFromSuite(path.resolve(publishSuitePath)));
  process.exit(0);
}

const arm = arg("arm");
if (arm !== "baseline" && arm !== "graph")
  throw new Error("--arm=baseline | graph is required");
const harness = arg("harness", "codex");
const model = arg("model", harness === "codex" ? "gpt-5.4-mini" : "sonnet");
const runs = Number(arg("runs", arm === "baseline" ? "5" : "1"));
const maxRunRetries = arg("max-run-retries", arm === "baseline" ? "4" : "0");
const family = arg("family", "dedicated");
const outer = Number(arg("concurrency", "4"));
const inner = Number(arg("inner-concurrency", String(runs)));
const storePath = path.resolve(
  arg("baseline-store", path.join(here, `baselines-${harness}.json`)),
);
const outPath = arg("out");
const setup = !process.argv.includes("--no-setup");

const harnessScript = path.join(
  here,
  harness === "codex" ? "agent-ab-codex.mjs" : "agent-ab.mjs",
);
const manifest = JSON.parse(
  fs.readFileSync(path.join(here, "questions", "manifest.json"), "utf8"),
);
// --repo limits the suite to a subset (comma-separated) for validation or for
// targeting one project; default is every project in the family.
const repoFilter = arg("repo");
const repoSet = repoFilter ? new Set(repoFilter.split(",")) : null;
const prompts = (manifest.prompts ?? []).filter(
  (p) =>
    (family === "all" || p.family === family) &&
    (!repoSet || repoSet.has(p.repo)),
);
if (prompts.length === 0) throw new Error(`no prompts for family ${family}`);

ensureFixtures(prompts);

function fixtureOf(prompt) {
  const spec = PROJECTS[prompt.repo];
  if (!spec) throw new Error(`unknown repo ${prompt.repo}`);
  if (spec.sourceRepo) return path.join(work, "graph-source", spec.repoName);
  const branch = prompt.fixtureBranch ?? "ttsc";
  return path.join(work, `${spec.repoName}@${branch}`);
}

function ensureFixtures(selectedPrompts) {
  const missing = new Map();
  for (const prompt of selectedPrompts) {
    const dir = fixtureOf(prompt);
    if (fs.existsSync(dir)) continue;
    const branch = prompt.fixtureBranch ?? "ttsc";
    if (!missing.has(branch)) missing.set(branch, new Set());
    missing.get(branch).add(prompt.repo);
  }
  if (missing.size === 0) return;
  if (!setup) {
    const names = [...missing.values()].flatMap((repos) => [...repos]);
    throw new Error(`missing prepared graph fixtures: ${names.join(", ")}`);
  }
  for (const [branch, repos] of missing) {
    runFixtureSetup(branch, [...repos]);
  }
  const stillMissing = selectedPrompts
    .map((prompt) => [prompt.id, fixtureOf(prompt)])
    .filter(([, dir]) => !fs.existsSync(dir));
  if (stillMissing.length) {
    throw new Error(
      `graph fixture setup did not create: ${stillMissing
        .map(([id, dir]) => `${id} at ${dir}`)
        .join(", ")}`,
    );
  }
}

function runFixtureSetup(branch, repos) {
  const args = [
    graphBenchmarkScript,
    "--setup-only",
    `--project=${repos.join(",")}`,
    `--branch=${branch}`,
    "--tools=ttsc-graph",
    `--models=${model}`,
  ];
  const result = cp.spawnSync(process.execPath, args, {
    cwd: repoRoot,
    env: process.env,
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(
      `graph fixture setup failed (${result.status})\n${result.stdout ?? ""}${result.stderr ?? ""}`,
    );
}

const tmpDir = path.join(here, ".suite-tmp");
fs.mkdirSync(tmpDir, { recursive: true });

const median = (xs) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const mean = (xs) =>
  xs.length === 0 ? 0 : Math.round(xs.reduce((a, b) => a + b, 0) / xs.length);

/** Run one prompt through the harness for the selected arm; return its samples. */
function runPrompt(prompt) {
  return new Promise((resolve) => {
    const report = path.join(
      tmpDir,
      `${harness}-${model}-${prompt.id}-${arm}.json`,
    );
    const childOut = path.join(
      tmpDir,
      `${harness}-${model}-${prompt.id}-${arm}.child.out.log`,
    );
    const childErr = path.join(
      tmpDir,
      `${harness}-${model}-${prompt.id}-${arm}.child.err.log`,
    );
    fs.rmSync(report, { force: true });
    fs.rmSync(childOut, { force: true });
    fs.rmSync(childErr, { force: true });
    const dir = fixtureOf(prompt);
    if (!dir || !fs.existsSync(dir))
      throw new Error(
        `missing prepared graph fixture for ${prompt.id}: ${dir}`,
      );
    const childArgs = [
      harnessScript,
      `--prompt-id=${prompt.id}`,
      `--arm=${arm}`,
      `--runs=${runs}`,
      `--model=${model}`,
      `--max-run-retries=${maxRunRetries}`,
      `--repo-dir=${dir}`,
      `--report=${report}`,
    ];
    const child = cp.spawn(process.execPath, childArgs, {
      cwd: repoRoot,
      env: { ...process.env, TTSC_BENCH_CONCURRENCY: String(inner) },
      windowsHide: true,
    });
    let out = "";
    let err = "";
    child.stdout?.on("data", (d) => (out += d));
    child.stderr?.on("data", (d) => (err += d));
    child.on("close", (code) => {
      if (out) fs.writeFileSync(childOut, out);
      if (err) fs.writeFileSync(childErr, err);
      let samples = [];
      try {
        const rep = JSON.parse(fs.readFileSync(report, "utf8"));
        samples = (rep.samples?.[arm] ?? []).filter(validMeasuredSample);
      } catch {
        /* report missing — child crashed */
      }
      const toks = samples.map((s) => s.tokens);
      console.log(
        `  ${prompt.id.padEnd(32)} ${arm}  ${samples.length}/${runs} ok  median ${median(toks)} tok` +
          (code === 0 ? "" : `  [exit ${code}]`) +
          (samples.length === 0 && err
            ? `  ${err.trim().split("\n").slice(-2).join(" | ")}`
            : ""),
      );
      resolve({ prompt, report, samples });
    });
  });
}

/** Run all prompts with at most `outer` in flight. */
async function fanOut(items, fn) {
  const results = [];
  let next = 0;
  const lanes = Array.from(
    { length: Math.max(1, Math.min(outer, items.length)) },
    async () => {
      while (next < items.length) {
        const i = next++;
        results[i] = await fn(items[i]);
      }
    },
  );
  await Promise.all(lanes);
  return results;
}

console.log(
  `\nsuite: ${harness}/${model}  arm=${arm}  runs=${runs}  family=${family}  ${prompts.length} prompt(s)  concurrency=${outer}\n`,
);

const results = await fanOut(prompts, runPrompt);
publishWebsiteReports(results.map((result) => result.report));

if (arm === "baseline") {
  const store = fs.existsSync(storePath)
    ? JSON.parse(fs.readFileSync(storePath, "utf8"))
    : {};
  for (const { prompt, samples } of results) {
    if (!samples.length) continue;
    const toks = samples.map((s) => s.tokens);
    store[`${model}/${prompt.id}`] = {
      harness,
      model,
      repo: prompt.repo,
      promptId: prompt.id,
      runs: samples.length,
      medianTokens: median(toks),
      medianTools: median(samples.map((s) => s.tools)),
      medianShell: median(samples.map((s) => s.shell)),
      medianGraph: median(samples.map((s) => s.graph)),
      tokens: toks,
    };
  }
  fs.writeFileSync(storePath, `${JSON.stringify(store, null, 2)}\n`);
  console.log(`\nbaseline cached -> ${storePath}`);
} else {
  const store = fs.existsSync(storePath)
    ? JSON.parse(fs.readFileSync(storePath, "utf8"))
    : {};
  console.log(`\n${"prompt".padEnd(32)} baseline -> graph  reduction  tools`);
  const rows = [];
  for (const { prompt, samples } of results) {
    if (!samples.length) continue;
    const g = median(samples.map((s) => s.tokens));
    const graphCalls = median(samples.map((s) => s.graph));
    const shellCalls = median(samples.map((s) => s.shell));
    const toolCalls = median(samples.map((s) => s.tools));
    const base = store[`${model}/${prompt.id}`];
    const b = base?.medianTokens ?? 0;
    const red = b ? Math.round((1 - g / b) * 100) : null;
    rows.push({
      id: prompt.id,
      b,
      g,
      red,
      graphCalls,
      shellCalls,
      toolCalls,
    });
    console.log(
      `  ${prompt.id.padEnd(32)} ${b || "?"} -> ${g}  ${red === null ? "(no baseline)" : red + "%"}` +
        `  graph ${graphCalls} shell ${shellCalls} tools ${toolCalls}`,
    );
  }
  const reds = rows.filter((r) => r.red !== null).map((r) => r.red);
  if (reds.length)
    console.log(
      `\naverage token reduction across ${reds.length} prompt(s): ${mean(reds)}%`,
    );
  if (outPath) {
    const cells = results.map(({ prompt, report }) => ({
      harness,
      model,
      arm,
      repo: prompt.repo,
      promptId: prompt.id,
      promptFamily: prompt.family,
      report,
    }));
    fs.writeFileSync(
      path.resolve(outPath),
      `${JSON.stringify({ harness, model, arm, runs, maxRunRetries, family, cells, rows }, null, 2)}\n`,
    );
  }
}

function reportsFromSuite(file) {
  const suite = JSON.parse(fs.readFileSync(file, "utf8"));
  const base = path.dirname(file);
  return (suite.cells ?? [])
    .map((cell) => cell.report)
    .filter(Boolean)
    .map((report) =>
      path.isAbsolute(report) ? report : path.resolve(base, report),
    );
}

function publishWebsiteReports(reports) {
  if (noWebsite) return;
  const cells = reports
    .filter((report) => fs.existsSync(report))
    .map((report) =>
      websiteCellFromReport(JSON.parse(fs.readFileSync(report, "utf8"))),
    )
    .filter(Boolean);
  if (cells.length === 0) return;
  const prior = fs.existsSync(websiteJson)
    ? JSON.parse(fs.readFileSync(websiteJson, "utf8"))
    : null;
  const out = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    structural: prior?.structural ?? null,
    agent: { cells: [...(prior?.agent?.cells ?? [])] },
  };
  for (const cell of cells) {
    const key = websiteCellKey(cell);
    const at = out.agent.cells.findIndex((old) => websiteCellKey(old) === key);
    if (at >= 0) out.agent.cells[at] = cell;
    else out.agent.cells.push(cell);
  }
  fs.mkdirSync(path.dirname(websiteJson), { recursive: true });
  fs.writeFileSync(websiteJson, `${JSON.stringify(out)}\n`);
  console.log(
    `website: upserted ${cells.length} cell(s) -> ${path.relative(repoRoot, websiteJson)}`,
  );
}

function websiteCellFromReport(data) {
  const rawModel = data.model ?? "unknown";
  const resolvedModel = data.modelVersion ?? rawModel;
  const tool = reportTool(data);
  const samples = sanitizeSamples(data.samples);
  if (samples.baseline.length === 0 && samples.graph.length === 0) return null;
  const model = agentLabel(resolvedModel);
  const version = modelVersionId(resolvedModel) ?? modelVersionId(rawModel);
  return {
    harness:
      data.harness ??
      (resolvedModel.startsWith("gpt-") ? "codex" : "claude-code"),
    tool,
    repo: data.repo,
    model,
    ...(version ? { modelVersion: version } : {}),
    ...(data.effort ? { effort: data.effort } : {}),
    ...(data.promptId ? { promptId: data.promptId } : {}),
    ...(data.promptFamily ? { promptFamily: data.promptFamily } : {}),
    ...(data.questionSha256 ? { questionSha256: data.questionSha256 } : {}),
    ...(data.fixtureBranch ? { fixtureBranch: data.fixtureBranch } : {}),
    daemon: data.daemon === true,
    runs: data.runs,
    question: data.question,
    samples,
  };
}

function reportTool(data) {
  const baseline = data.samples?.baseline ?? [];
  const graph = data.samples?.graph ?? [];
  return baseline.length > 0 && graph.length === 0
    ? "baseline"
    : (data.tool ?? "ttsc-graph");
}

function agentLabel(resolvedModel) {
  if (resolvedModel === "sonnet" || resolvedModel.startsWith("claude-sonnet-"))
    return "claude-code-sonnet";
  if (resolvedModel === "opus" || resolvedModel.startsWith("claude-opus-"))
    return "claude-code-opus";
  if (!resolvedModel.startsWith("gpt-")) return `claude-code-${resolvedModel}`;
  const tier = resolvedModel
    .split("-")
    .filter((token) => token && !/^[0-9.]+$/.test(token))
    .join("-");
  return `codex-${tier}`;
}

function modelVersionId(resolvedModel) {
  if (resolvedModel.startsWith("claude-") || resolvedModel.startsWith("gpt-"))
    return resolvedModel;
  return undefined;
}

function sanitizeSamples(samples) {
  return {
    baseline: (samples?.baseline ?? [])
      .filter(validMeasuredSample)
      .map(sanitizeSample),
    graph: (samples?.graph ?? [])
      .filter(validMeasuredSample)
      .map(sanitizeSample),
  };
}

function validMeasuredSample(sample) {
  return Number(sample?.tokens ?? 0) > 0;
}

function sanitizeSample(sample) {
  const out = {};
  for (const key of PUBLISHED_SAMPLE_KEYS) {
    if (sample[key] !== undefined) out[key] = sample[key];
  }
  return out;
}

function websiteCellKey(cell) {
  return JSON.stringify([
    cell.harness,
    cell.tool ?? "ttsc-graph",
    cell.repo,
    cell.promptId ?? "",
    cell.promptFamily ?? "project-specific",
    cell.model,
    cell.effort ?? "",
    cell.fixtureBranch ?? "ttsc",
    cell.daemon === true ? "daemon" : "single",
  ]);
}
