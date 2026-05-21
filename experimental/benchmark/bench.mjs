#!/usr/bin/env node
/**
 * ttsc benchmark runner.
 *
 * Measures wall-clock time of build / format / lint commands across three
 * shopping-backend variants and emits a Markdown report:
 *
 *   - shopping-backend@legacy      TypeScript 5.x  · tsc · prettier · eslint
 *   - shopping-backend@next        TypeScript 7.x  · ttsc
 *   - shopping-backend@experiment  TypeScript 7.x  · ttsc · @ttsc/lint (+format)
 *
 * Benchmark groups:
 *
 *   B1  build speed   legacy(tsc)      vs  next(ttsc)         — build:main, build:test
 *   B2  format speed  legacy(prettier) vs  experiment(format) — whole src tree
 *   B3  build+lint    legacy(tsc+eslint) vs experiment(ttsc+@ttsc/lint)
 *
 * Each measurement does WARMUP unmeasured runs, then RUNS measured runs, and
 * reports the median. A measured run that exits non-zero (e.g. the intermittent
 * @nestia/core parallel-emit crash) is retried up to RETRIES times so the timing
 * sample stays valid; the crash count is reported separately.
 *
 * Usage:
 *   node bench.mjs [groups...]      # e.g. `node bench.mjs b1 b2`, default: all
 *   TTSC_BENCH_EXAMPLES=/path       # override the nestia.examples directory
 *   TTSC_BENCH_RUNS=3               # measured runs per command
 *   TTSC_BENCH_WARMUP=1             # warmup runs per command
 *   TTSC_BENCH_RETRIES=3            # retries to recover from a crashed run
 *   TTSC_BENCH_OUT=/path/report.md  # report destination
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const EXAMPLES =
  process.env.TTSC_BENCH_EXAMPLES ??
  path.resolve(import.meta.dirname, "../../../nestia.examples");
const RUNS = Number(process.env.TTSC_BENCH_RUNS ?? 3);
const WARMUP = Number(process.env.TTSC_BENCH_WARMUP ?? 1);
const RETRIES = Number(process.env.TTSC_BENCH_RETRIES ?? 3);
const OUT =
  process.env.TTSC_BENCH_OUT ??
  path.resolve(import.meta.dirname, "report.md");

const PROJECTS = {
  legacy: path.join(EXAMPLES, "shopping-backend@legacy"),
  next: path.join(EXAMPLES, "shopping-backend@next"),
  experiment: path.join(EXAMPLES, "shopping-backend@experiment"),
};

/**
 * Every distinct (project, command) measured once. `key` is referenced by the
 * report tables; `crashy` marks commands subject to the parallel-emit race.
 */
const CASES = [
  { key: "legacy:build:main", project: "legacy", cmd: "pnpm run build:main" },
  { key: "legacy:build:test", project: "legacy", cmd: "pnpm run build:test" },
  { key: "next:build:main", project: "next", cmd: "pnpm run build:main", crashy: true },
  { key: "next:build:test", project: "next", cmd: "pnpm run build:test", crashy: true },
  { key: "legacy:prettier", project: "legacy", cmd: "pnpm exec prettier src --write" },
  { key: "experiment:format", project: "experiment", cmd: "pnpm exec ttsc format", crashy: true },
  { key: "legacy:eslint:src", project: "legacy", cmd: "pnpm exec eslint src" },
  { key: "legacy:eslint:test", project: "legacy", cmd: "pnpm exec eslint test" },
  { key: "experiment:build:main", project: "experiment", cmd: "pnpm run build:main", crashy: true },
  { key: "experiment:build:test", project: "experiment", cmd: "pnpm run build:test", crashy: true },
];

const GROUPS = {
  b1: ["legacy:build:main", "legacy:build:test", "next:build:main", "next:build:test"],
  b2: ["legacy:prettier", "experiment:format"],
  b3: [
    "legacy:build:main", "legacy:build:test", "legacy:eslint:src",
    "legacy:eslint:test", "experiment:build:main", "experiment:build:test",
  ],
};

const wanted = process.argv.slice(2).map((s) => s.toLowerCase());
const activeGroups = wanted.length
  ? wanted.filter((g) => GROUPS[g])
  : Object.keys(GROUPS);
const activeKeys = new Set(activeGroups.flatMap((g) => GROUPS[g]));

function runOnce(cwd, cmd) {
  const t0 = process.hrtime.bigint();
  const res = spawnSync(cmd, { cwd, shell: true, encoding: "utf8" });
  const t1 = process.hrtime.bigint();
  return {
    ms: Number(t1 - t0) / 1e6,
    ok: res.status === 0,
    status: res.status,
    log: `${res.stdout ?? ""}${res.stderr ?? ""}`,
  };
}

function median(xs) {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * Classify a failed run from its output. A `race` failure is the intermittent
 * Go data-race crash; anything else is a deterministic `error` (e.g. a type
 * error). This keeps an orthogonal stability bug from being mislabelled — and
 * stops a deterministic compile error from being reported as a "crash".
 */
function classifyFailure(log) {
  return /concurrent map|fatal error|\bpanic:|DATA RACE/.test(log)
    ? "race"
    : "error";
}

function measure(c) {
  const cwd = PROJECTS[c.project];
  process.stdout.write(`\n▶ ${c.key}\n  ${c.cmd}\n`);
  for (let i = 0; i < WARMUP; i++) {
    const w = runOnce(cwd, c.cmd);
    process.stdout.write(`  warmup ${i + 1}: ${w.ms.toFixed(0)} ms ${w.ok ? "ok" : `EXIT ${w.status}`}\n`);
  }
  const samples = [];
  let raceRetries = 0;
  let deterministicFailure = null; // { status } when a run never succeeds
  for (let i = 0; i < RUNS; i++) {
    let r = runOnce(cwd, c.cmd);
    let attempts = 0;
    while (!r.ok && attempts < RETRIES) {
      const kind = classifyFailure(r.log);
      if (kind === "race") raceRetries++;
      attempts++;
      process.stdout.write(`  run ${i + 1}: EXIT ${r.status} (${kind}) — retry ${attempts}\n`);
      if (kind === "error") break; // deterministic: retrying will not help
      r = runOnce(cwd, c.cmd);
    }
    if (!r.ok) {
      deterministicFailure = { status: r.status };
      process.stdout.write(`  run ${i + 1}: EXIT ${r.status} — deterministic failure, not measured\n`);
      continue;
    }
    samples.push(r.ms);
    process.stdout.write(`  run ${i + 1}: ${r.ms.toFixed(0)} ms\n`);
  }
  return {
    key: c.key,
    samples,
    raceRetries,
    deterministicFailure,
    median: samples.length ? median(samples) : null,
    min: samples.length ? Math.min(...samples) : null,
  };
}

function s(ms) {
  return ms == null ? "—" : `${(ms / 1000).toFixed(2)} s`;
}
function ratio(slow, fast) {
  return slow == null || fast == null ? "—" : `${(slow / fast).toFixed(2)}×`;
}
// Sum that stays honest: if any component is missing, so is the total.
function sum(...xs) {
  return xs.some((x) => x == null) ? null : xs.reduce((a, b) => a + b, 0);
}

// ── run ──────────────────────────────────────────────────────────────────────
// Prior results are merged so groups can be measured in separate invocations
// (e.g. `node bench.mjs b1` then `node bench.mjs b3`) and still report as one.
const started = new Date();
const jsonPath = OUT.replace(/\.md$/, ".json");
let results = {};
if (fs.existsSync(jsonPath)) {
  try {
    results = JSON.parse(fs.readFileSync(jsonPath, "utf8")).results ?? {};
  } catch {
    results = {};
  }
}
for (const c of CASES) {
  if (!activeKeys.has(c.key)) continue;
  results[c.key] = measure(c);
}
const R = (k) =>
  results[k] ?? { median: null, min: null, raceRetries: 0, samples: [] };
// A group is reported when any of its measurements has data, regardless of
// which groups were requested this invocation (results accumulate on disk).
const hasGroup = (g) => GROUPS[g].some((k) => results[k]?.median != null);

// ── report ───────────────────────────────────────────────────────────────────
const cpu = os.cpus();
const lines = [];
lines.push(`# ttsc benchmark — shopping-backend`);
lines.push("");
lines.push(`- Date: ${started.toISOString()}`);
lines.push(`- Host: ${os.type()} ${os.release()} · ${cpu.length}× ${cpu[0]?.model?.trim()} · ${(os.totalmem() / 2 ** 30).toFixed(0)} GB`);
lines.push(`- Method: ${WARMUP} warmup + ${RUNS} measured runs per command; median reported. A run that hits the intermittent parallel-emit race is retried (up to ${RETRIES}×); a deterministic failure is reported as such, not retried.`);
lines.push("");

if (hasGroup("b1")) {
  lines.push(`## B1 — Build speed: tsc (legacy) vs ttsc (next)`);
  lines.push("");
  lines.push(`| Step | legacy · tsc | next · ttsc | speedup |`);
  lines.push(`| --- | --- | --- | --- |`);
  for (const [step, lk, nk] of [
    ["build:main", "legacy:build:main", "next:build:main"],
    ["build:test", "legacy:build:test", "next:build:test"],
  ]) {
    lines.push(`| ${step} | ${s(R(lk).median)} | ${s(R(nk).median)} | ${ratio(R(lk).median, R(nk).median)} |`);
  }
  const lTot = sum(R("legacy:build:main").median, R("legacy:build:test").median);
  const nTot = sum(R("next:build:main").median, R("next:build:test").median);
  lines.push(`| **main + test** | **${s(lTot)}** | **${s(nTot)}** | **${ratio(lTot, nTot)}** |`);
  lines.push("");
}

if (hasGroup("b2")) {
  lines.push(`## B2 — Format speed: prettier (legacy) vs ttsc format (experiment)`);
  lines.push("");
  lines.push(`| Tool | command | median |`);
  lines.push(`| --- | --- | --- |`);
  lines.push(`| prettier | \`prettier src --write\` | ${s(R("legacy:prettier").median)} |`);
  lines.push(`| ttsc format | \`ttsc format\` | ${s(R("experiment:format").median)} |`);
  lines.push(`| **speedup** | | **${ratio(R("legacy:prettier").median, R("experiment:format").median)}** |`);
  lines.push("");
}

if (hasGroup("b3")) {
  lines.push(`## B3 — Build + lint: tsc+eslint (legacy) vs ttsc+@ttsc/lint (experiment)`);
  lines.push("");
  lines.push(`@ttsc/lint folds linting into the single ttsc compile pass; eslint is a separate process.`);
  lines.push("");
  lines.push(`| Layer | legacy (tsc + eslint) | experiment (ttsc + lint) | speedup |`);
  lines.push(`| --- | --- | --- | --- |`);
  const lMain = sum(R("legacy:build:main").median, R("legacy:eslint:src").median);
  const lTest = sum(R("legacy:build:test").median, R("legacy:eslint:test").median);
  const xTotal = sum(R("experiment:build:main").median, R("experiment:build:test").median);
  lines.push(`| build:main + src lint | ${s(R("legacy:build:main").median)} + ${s(R("legacy:eslint:src").median)} = ${s(lMain)} | ${s(R("experiment:build:main").median)} | ${ratio(lMain, R("experiment:build:main").median)} |`);
  lines.push(`| build:test + test lint | ${s(R("legacy:build:test").median)} + ${s(R("legacy:eslint:test").median)} = ${s(lTest)} | ${s(R("experiment:build:test").median)} | ${ratio(lTest, R("experiment:build:test").median)} |`);
  lines.push(`| **total** | **${s(sum(lMain, lTest))}** | **${s(xTotal)}** | **${ratio(sum(lMain, lTest), xTotal)}** |`);
  lines.push("");
}

const raced = Object.values(results).filter((r) => r.raceRetries > 0);
const failed = Object.entries(results).filter(([, r]) => r.deterministicFailure);
if (raced.length || failed.length) {
  lines.push(`## Stability`);
  lines.push("");
  if (raced.length) {
    lines.push(`Parallel-emit data-race retries — intermittent; the reported timing is from a clean run:`);
    lines.push("");
    for (const r of raced)
      lines.push(`- \`${r.key}\`: ${r.raceRetries} race retr${r.raceRetries === 1 ? "y" : "ies"}`);
    lines.push("");
  }
  if (failed.length) {
    lines.push(`Deterministic failures — a real compile error (retrying does not help), so the cell is left unmeasured:`);
    lines.push("");
    for (const [k, r] of failed)
      lines.push(`- \`${k}\`: exits ${r.deterministicFailure.status} on every run`);
    lines.push("");
  }
}

lines.push(`## Raw samples (ms)`);
lines.push("");
lines.push(`| Measurement | runs | median | min |`);
lines.push(`| --- | --- | --- | --- |`);
for (const k of Object.keys(results)) {
  const r = results[k];
  lines.push(`| \`${k}\` | ${r.samples.map((x) => x.toFixed(0)).join(", ") || "—"} | ${s(r.median)} | ${s(r.min)} |`);
}
lines.push("");

const report = lines.join("\n");
fs.writeFileSync(OUT, report);
fs.writeFileSync(OUT.replace(/\.md$/, ".json"), JSON.stringify({ started, results }, null, 2));
process.stdout.write(`\n${report}\n\nReport written to ${OUT}\n`);
