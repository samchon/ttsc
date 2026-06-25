// Publish the @ttsc/graph benchmark results into the website.
//
// The three graph benchmarks each write a local, git-ignored report:
//   - bench.mjs            -> report.json                 (structural: counts + coverage)
//   - agent-ab.mjs         -> agent-ab-report.json        (Claude agent-cost A/B)
//   - agent-ab-codex.mjs   -> agent-ab-codex-report.json  (codex / GPT agent-cost A/B)
//
// This script folds whichever of those exist into the committed, served
// `website/public/benchmark/graph.json`, the graph sibling of the performance
// dashboard's `performance.json`. Like `merge-website.mjs`, it merges in place:
// each agent cell is keyed by (harness, tool, repo, promptFamily, model, effort, fixtureBranch)
// and upserted, so running one repo/model at a time accumulates cells across separate quiet-host runs
// instead of clobbering the others. The structural block is replaced whole.
//
// Only raw per-run samples are stored; medians and saved-percentages are left
// for the reader to derive, so the published JSON never carries a derived
// statistic that could drift out of sync with the prose at
// https://ttsc.dev/docs/benchmark#code-graph-mcp.
//
// Usage:
//   node experimental/graph-bench/publish.mjs            # fold every report found
//   node experimental/graph-bench/publish.mjs --reset    # drop prior cells first

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");
const websiteJson = path.resolve(
  repoRoot,
  "website",
  "public",
  "benchmark",
  "graph.json",
);

const reset = process.argv.slice(2).includes("--reset");

const prior =
  !reset && fs.existsSync(websiteJson)
    ? JSON.parse(fs.readFileSync(websiteJson, "utf8"))
    : { schemaVersion: 1, structural: null, agent: { cells: [] } };

const out = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  structural: prior.structural ?? null,
  agent: { cells: [...(prior.agent?.cells ?? [])] },
};

// Structural: replace whole when a fresh report.json is present.
const structural = readJson(path.join(here, "report.json"));
if (structural) {
  if (typeof structural.project === "string") {
    structural.project = structural.project.split(path.sep).join("/");
  }
  out.structural = structural;
  console.log(
    `structural: ${structural.nodes} nodes, ${structural.totalEdges} edges, ` +
      `coverage ${(structural.coverage * 100).toFixed(1)}%`,
  );
}

// Agent cells: upsert each available report by harness/tool/repo/model.
foldAgent(readJson(path.join(here, "agent-ab-report.json")), "claude-code");
foldAgent(readJson(path.join(here, "agent-ab-codex-report.json")), "codex");

fs.mkdirSync(path.dirname(websiteJson), { recursive: true });
fs.writeFileSync(websiteJson, `${JSON.stringify(out, null, 2)}\n`);
console.log(
  `\nWrote ${path.relative(repoRoot, websiteJson)} ` +
    `(${out.agent.cells.length} agent cell(s)).`,
);

function foldAgent(report, harness) {
  if (!report) return;
  const cell = {
    harness,
    tool: report.tool ?? "ttsc-graph",
    repo: report.repo,
    model: report.model,
    ...(report.effort ? { effort: report.effort } : {}),
    promptFamily: report.promptFamily ?? "project-specific",
    ...(report.fixtureBranch ? { fixtureBranch: report.fixtureBranch } : {}),
    ...(report.daemon !== undefined ? { daemon: report.daemon } : {}),
    ...(report.toolSetupMs !== undefined ? { toolSetupMs: report.toolSetupMs } : {}),
    runs: report.runs,
    question: report.question,
    samples: report.samples,
  };
  const key = (c) =>
    JSON.stringify([
      c.harness,
      c.tool ?? "ttsc-graph",
      c.repo,
      c.promptFamily ?? "project-specific",
      c.model,
      c.effort ?? "",
      c.fixtureBranch ?? "ttsc",
      c.daemon === true ? "daemon" : "single",
    ]);
  const at = out.agent.cells.findIndex((c) => key(c) === key(cell));
  if (at >= 0) out.agent.cells[at] = { ...out.agent.cells[at], ...cell };
  else out.agent.cells.push(cell);
  const n = (report.samples?.graph ?? []).length;
  console.log(
    `agent: ${harness} / ${cell.tool} / ${report.repo} / ${cell.promptFamily} / ${report.model} (${n} graph runs)`,
  );
}

function readJson(file) {
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}
