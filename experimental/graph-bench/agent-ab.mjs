// Agent-cost A/B for @ttsc/graph, a faithful port of codegraph's headline
// benchmark (scripts/agent-eval/run-all.sh + parse-bench-readme.mjs). For one
// structural question per repo it runs the Claude Code CLI headless twice, once
// with the @ttsc/graph MCP server and once with an empty MCP config, both under
// --strict-mcp-config, and reports the codegraph metrics: total tokens summed
// per assistant turn, tool-call count, cost, and wall time, median over N runs.
//
// Only codegraph's TWO TypeScript repos are runnable by a checker-resolved graph:
// excalidraw and vscode (the other five are Python/Rust/Java/Go/Swift). The
// questions are codegraph's verbatim.
//
// Spends real Claude credits; non-deterministic; not wired into CI. Requires
// `claude` and `go` on PATH.
//
// Usage:
//   node experimental/graph-bench/agent-ab.mjs --repo=excalidraw --runs=2
//   node experimental/graph-bench/agent-ab.mjs --repo=vscode --runs=4 --model=opus

import cp from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");
const ttscDir = path.join(repoRoot, "packages", "ttsc");

// codegraph's TypeScript benchmark repos and their verbatim questions.
const REPOS = {
  excalidraw: {
    url: "https://github.com/excalidraw/excalidraw",
    tsconfig: "tsconfig.json",
    question: "How does Excalidraw render and update canvas elements?",
  },
  vscode: {
    url: "https://github.com/microsoft/vscode",
    tsconfig: "src/tsconfig.json",
    question: "How does the extension host communicate with the main process?",
  },
};

const args = parseArgs(process.argv.slice(2));
const repoKey = args.repo ?? "excalidraw";
const spec = REPOS[repoKey];
if (!spec) throw new Error(`unknown --repo ${repoKey}; choose ${Object.keys(REPOS).join(" | ")}`);
const runs = Number(args.runs ?? 2);
const model = args.model ?? "sonnet";
const tsconfig = args.tsconfig ?? spec.tsconfig;

const corpus = path.join(os.tmpdir(), "graph-corpus");
const repoDir = path.join(corpus, repoKey);

const goRoot = path.join(os.homedir(), "go-sdk", "go", "bin");
const goEnv = {
  ...process.env,
  PATH: fs.existsSync(goRoot) ? `${goRoot}${path.delimiter}${process.env.PATH ?? ""}` : process.env.PATH,
};

// 1. Build the MCP server binary.
const binary = path.join(os.tmpdir(), `ttscgraph-ab-${process.pid}${process.platform === "win32" ? ".exe" : ""}`);
console.log("Building ttscgraph...");
runOrThrow("go", ["build", "-o", binary, "./cmd/ttscgraph"], ttscDir, goEnv);

// 2. Clone the target repo (shallow) if absent.
if (!fs.existsSync(repoDir)) {
  fs.mkdirSync(corpus, { recursive: true });
  console.log(`Cloning ${spec.url} (shallow) -> ${repoDir} ...`);
  runOrThrow("git", ["clone", "--depth", "1", spec.url, repoDir], corpus, process.env);
}

// 3. WITH = @ttsc/graph MCP server; WITHOUT = empty config. Both --strict-mcp-config.
const withCfg = path.join(os.tmpdir(), `mcp-graph-${process.pid}.json`);
const emptyCfg = path.join(os.tmpdir(), `mcp-empty-${process.pid}.json`);
fs.writeFileSync(withCfg, JSON.stringify({ mcpServers: { "ttsc-graph": { command: binary, args: ["--stdio", "--cwd", repoDir, "--tsconfig", tsconfig] } } }));
fs.writeFileSync(emptyCfg, JSON.stringify({ mcpServers: {} }));

const arms = [
  { name: "baseline", cfg: emptyCfg },
  { name: "graph", cfg: withCfg },
];

console.log(`\ncodegraph A/B on ${repoKey} — model ${model}, ${runs} run(s) x 2 arms`);
console.log(`Q: ${spec.question}\n`);

const samples = { baseline: [], graph: [] };
let spent = 0;
for (const arm of arms) {
  for (let r = 0; r < runs; r++) {
    const m = runClaude(spec.question, arm.cfg);
    samples[arm.name].push(m);
    spent += m.cost;
    console.log(
      `  ${arm.name.padEnd(8)} run ${r + 1}: $${m.cost.toFixed(3)}, ${m.tokens} tok, ${m.tools} tools ` +
        `(read ${m.reads}, grep ${m.grep}, graph ${m.graph}), ${(m.durMs / 1000).toFixed(0)}s` +
        (m.ok ? "" : "  [FAILED]") + `  [running $${spent.toFixed(2)}]`,
    );
  }
}

const med = (arm, k) => median(samples[arm].filter((m) => m.ok).map((m) => m[k]));
const pct = (g, b) => (b === 0 ? 0 : Math.round((1 - g / b) * 100));
const line = (label, k, fmt = (x) => x) => {
  const b = med("baseline", k), g = med("graph", k);
  console.log(`  ${label.padEnd(12)} baseline ${fmt(b)}  ->  graph ${fmt(g)}  (${pct(g, b)}% saved)`);
};

console.log(`\nMedian of ${runs} run(s), graph vs empty-MCP baseline (codegraph metrics):`);
line("tokens", "tokens");
line("tool calls", "tools");
line("cost", "cost", (x) => `$${x.toFixed(3)}`);
line("wall time", "durMs", (x) => `${(x / 1000).toFixed(0)}s`);
console.log(`\nTotal spend this run: $${spent.toFixed(2)}`);

fs.writeFileSync(path.join(here, "agent-ab-report.json"), `${JSON.stringify({ repo: repoKey, model, runs, question: spec.question, samples }, null, 2)}\n`);
try { fs.rmSync(binary, { force: true }); fs.rmSync(withCfg, { force: true }); fs.rmSync(emptyCfg, { force: true }); } catch { /* best effort */ }

function runClaude(question, cfg) {
  const result = cp.spawnSync(
    "claude",
    ["-p", "--output-format", "stream-json", "--verbose", "--permission-mode", "bypassPermissions", "--model", model, "--effort", "high", "--max-budget-usd", "4", "--strict-mcp-config", "--mcp-config", cfg],
    { cwd: repoDir, input: question, encoding: "utf8", windowsHide: true, shell: true, maxBuffer: 256 * 1024 * 1024, timeout: 900_000 },
  );
  if (result.error) throw result.error;
  return parseStream(result.stdout ?? "");
}

// parseStream mirrors codegraph's parse-bench-readme.mjs: tokens are summed over
// every assistant turn's usage (not the last-turn result.usage), and tool calls
// are counted across assistant events (ToolSearch excluded).
function parseStream(text) {
  let tokens = 0, tools = 0, reads = 0, grep = 0, graph = 0, other = 0, result = null;
  for (const raw of text.split("\n")) {
    if (!raw.trim()) continue;
    let e;
    try { e = JSON.parse(raw); } catch { continue; }
    if (e.type === "assistant") {
      const u = e.message?.usage;
      if (u) tokens += (u.input_tokens || 0) + (u.output_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0);
      for (const b of e.message?.content || []) {
        if (b.type !== "tool_use") continue;
        if (b.name === "ToolSearch") continue;
        tools++;
        if (b.name === "Read") reads++;
        else if (b.name === "Grep" || b.name === "Glob") grep++;
        else if (/graph|ttsc/i.test(b.name)) graph++;
        else other++;
      }
    } else if (e.type === "result") {
      result = e;
    }
  }
  return { tokens, tools, reads, grep, graph, other, cost: result?.total_cost_usd || 0, durMs: result?.duration_ms || 0, ok: result?.subtype === "success" };
}

function runOrThrow(command, commandArgs, cwd, env) {
  const result = cp.spawnSync(command, commandArgs, { cwd, env, encoding: "utf8", windowsHide: true, shell: command === "claude" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${commandArgs.join(" ")} failed (${result.status})\n${result.stderr ?? ""}`);
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
