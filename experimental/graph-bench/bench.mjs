// Benchmark @ttsc/graph on a real project: how long the resident Program takes
// to load, how cheap graph extraction is on top of that already-built Program,
// the node/edge counts, and the codegraph-style "fair coverage" (share of
// symbol-bearing source files with at least one resolved cross-file edge).
//
// Counts and coverage are deterministic. Timings are indicative and only
// trustworthy on a quiet host (see .codex/skills/benchmark); CI numbers show the
// shape, not a publishable figure.
//
// Usage:
//   node experimental/graph-bench/bench.mjs                       # default: packages/ttsc
//   node experimental/graph-bench/bench.mjs --project=/abs/path --tsconfig=tsconfig.json --runs=5

import cp from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");
const ttscDir = path.join(repoRoot, "packages", "ttsc");

const args = parseArgs(process.argv.slice(2));
const project = path.resolve(args.project ?? ttscDir);
const tsconfig = args.tsconfig ?? "tsconfig.json";
const runs = Number(args.runs ?? 5);
const warmup = Number(args.warmup ?? 1);

const goRoot = path.join(os.homedir(), "go-sdk", "go", "bin");
const env = {
  ...process.env,
  PATH: fs.existsSync(goRoot)
    ? `${goRoot}${path.delimiter}${process.env.PATH ?? ""}`
    : process.env.PATH,
};

const binary = path.join(
  os.tmpdir(),
  `graphbench-${process.pid}${process.platform === "win32" ? ".exe" : ""}`,
);

console.log("Building graphbench...");
runChecked("go", ["build", "-o", binary, "./cmd/graphbench"], ttscDir);

console.log(
  `Benchmarking @ttsc/graph on ${path.relative(repoRoot, project) || project} (${tsconfig}), ${runs} run(s) + ${warmup} warmup\n`,
);

for (let i = 0; i < warmup; i++) measure();
const samples = [];
for (let i = 0; i < runs; i++) {
  const sample = measure();
  samples.push(sample);
  console.log(
    `  run ${i + 1}: load ${sample.loadMs.toFixed(0)}ms, build ${sample.buildMs.toFixed(0)}ms, ` +
      `${sample.nodes} nodes, ${sample.totalEdges} edges, coverage ${(sample.coverage * 100).toFixed(1)}%`,
  );
}

const first = samples[0];
const report = {
  project: path.relative(repoRoot, project) || project,
  tsconfig,
  runs,
  sourceFiles: first.sourceFiles,
  nodes: first.nodes,
  externalNodes: first.externalNodes,
  edges: first.edges,
  totalEdges: first.totalEdges,
  symbolFiles: first.symbolFiles,
  coveredFiles: first.coveredFiles,
  coverage: first.coverage,
  loadMsMedian: median(samples.map((s) => s.loadMs)),
  buildMsMedian: median(samples.map((s) => s.buildMs)),
  buildShareMedian: median(samples.map((s) => s.buildShareOfLoad)),
};

console.log("\nResult (counts deterministic; timings indicative):");
console.log(`  source files:  ${report.sourceFiles}`);
console.log(`  nodes:         ${report.nodes} (${report.externalNodes} external boundary leaves)`);
console.log(
  `  edges:         ${report.totalEdges} (heritage ${report.edges.heritage}, ` +
    `value-call ${report.edges["value-call"]}, type-ref ${report.edges["type-ref"]})`,
);
console.log(
  `  fair coverage: ${(report.coverage * 100).toFixed(1)}% ` +
    `(${report.coveredFiles}/${report.symbolFiles} symbol-bearing files cross-linked)`,
);
console.log(`  load time:     ${report.loadMsMedian.toFixed(0)} ms (median)`);
console.log(
  `  graph build:   ${report.buildMsMedian.toFixed(0)} ms (median), ` +
    `${(report.buildShareMedian * 100).toFixed(1)}% on top of the load it rides`,
);

const reportPath = path.join(here, "report.json");
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`\nReport: ${path.relative(repoRoot, reportPath)}`);

try {
  fs.rmSync(binary, { force: true });
} catch {
  /* best effort */
}

function measure() {
  const out = runChecked(
    binary,
    ["--cwd", project, "--tsconfig", tsconfig],
    ttscDir,
  );
  return JSON.parse(out.trim());
}

function runChecked(command, commandArgs, cwd) {
  const result = cp.spawnSync(command, commandArgs, {
    cwd,
    env,
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `${command} ${commandArgs.join(" ")} failed (${result.status})\n${result.stderr ?? ""}`,
    );
  }
  return result.stdout ?? "";
}

function median(values) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function parseArgs(argv) {
  const out = {};
  for (const arg of argv) {
    const match = /^--([^=]+)=(.*)$/.exec(arg);
    if (match) out[match[1]] = match[2];
  }
  return out;
}
