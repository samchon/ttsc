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
// --out=<combined report>, --no-setup.
import cp from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { gradeAnswer } from "./grade.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");
const work = path.join(repoRoot, "experimental", "benchmark", ".work");
const graphBenchmarkScript = path.join(
  repoRoot,
  "experimental",
  "benchmark",
  "graph.mjs",
);

// Match experimental/benchmark/graph.mjs, which owns fixture setup. Benchmarks
// use prepared performance fixtures in .work/<repoName>@ttsc unless a project is
// explicitly marked as a source-only graph target.
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

const arm = arg("arm");
if (arm !== "baseline" && arm !== "graph")
  throw new Error("--arm=baseline | graph is required");
const harness = arg("harness", "codex");
const model = arg("model", harness === "codex" ? "gpt-5.4-mini" : "sonnet");
const runs = Number(arg("runs", arm === "baseline" ? "5" : "1"));
const family = arg("family", "dedicated");
const outer = Number(arg("concurrency", "4"));
const inner = Number(arg("inner-concurrency", String(runs)));
const storePath = path.resolve(
  arg("baseline-store", path.join(here, `baselines-${harness}.json`)),
);
const outPath = arg("out");
const threshold = Number(arg("threshold", "0.8"));
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

/** Run one prompt through the harness for the selected arm; return its samples. */
function runPrompt(prompt) {
  return new Promise((resolve) => {
    const report = path.join(
      tmpDir,
      `${harness}-${model}-${prompt.id}-${arm}.json`,
    );
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
      `--repo-dir=${dir}`,
      `--report=${report}`,
    ];
    const child = cp.spawn(process.execPath, childArgs, {
      cwd: repoRoot,
      env: { ...process.env, TTSC_BENCH_CONCURRENCY: String(inner) },
      windowsHide: true,
    });
    let err = "";
    child.stderr?.on("data", (d) => (err += d));
    child.on("close", (code) => {
      let samples = [];
      try {
        const rep = JSON.parse(fs.readFileSync(report, "utf8"));
        samples = (rep.samples?.[arm] ?? []).filter((s) => s.ok);
      } catch {
        /* report missing — child crashed */
      }
      const toks = samples.map((s) => s.tokens);
      console.log(
        `  ${prompt.id.padEnd(32)} ${arm}  ${samples.length}/${runs} ok  median ${median(toks)} tok` +
          (code === 0 ? "" : `  [exit ${code}]`) +
          (samples.length === 0 && err
            ? `  ${err.trim().split("\n").pop()}`
            : ""),
      );
      resolve({ prompt, samples });
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

if (arm === "baseline") {
  const store = fs.existsSync(storePath)
    ? JSON.parse(fs.readFileSync(storePath, "utf8"))
    : {};
  for (const { prompt, samples } of results) {
    if (!samples.length) continue;
    const toks = samples.map((s) => s.tokens);
    const graded = samples.filter((s) => s.quality);
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
      pass: graded.length
        ? {
            passed: graded.filter((s) => s.quality.pass).length,
            graded: graded.length,
          }
        : null,
    };
  }
  fs.writeFileSync(storePath, `${JSON.stringify(store, null, 2)}\n`);
  console.log(`\nbaseline cached -> ${storePath}`);
  console.log(
    "\nNOTE: a gold the baseline cannot pass is mis-calibrated — relax it before trusting graph quality.",
  );
} else {
  const store = fs.existsSync(storePath)
    ? JSON.parse(fs.readFileSync(storePath, "utf8"))
    : {};
  console.log(`\n${"prompt".padEnd(32)} baseline -> graph  reduction  quality`);
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
    const graded = samples.filter((s) => s.quality);
    const passed = graded.filter((s) => s.quality.pass).length;
    rows.push({
      id: prompt.id,
      b,
      g,
      red,
      graphCalls,
      shellCalls,
      toolCalls,
      passed,
      graded: graded.length,
    });
    console.log(
      `  ${prompt.id.padEnd(32)} ${b || "?"} -> ${g}  ${red === null ? "(no baseline)" : red + "%"}  ${passed}/${graded.length}` +
        `  graph ${graphCalls} shell ${shellCalls} tools ${toolCalls}`,
    );
  }
  const reds = rows.filter((r) => r.red !== null).map((r) => r.red);
  if (reds.length)
    console.log(
      `\nmedian token reduction across ${reds.length} prompt(s): ${median(reds)}%`,
    );
  if (outPath)
    fs.writeFileSync(
      path.resolve(outPath),
      `${JSON.stringify({ harness, model, arm, runs, rows }, null, 2)}\n`,
    );
}
