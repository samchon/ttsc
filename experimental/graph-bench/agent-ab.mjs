// Agent-cost A/B for @ttsc/graph, a faithful port of codegraph's agent-cost
// benchmark (scripts/agent-eval/run-all.sh + parse-bench-readme.mjs). For one
// structural question per repo it runs the Claude Code CLI headless twice, once
// with the @ttsc/graph MCP server and once with an empty MCP config, both under
// --strict-mcp-config, and reports the codegraph metrics: total tokens summed
// per assistant turn, tool-call count, cost, and wall time, median over N runs.
//
// Only codegraph's TWO TypeScript repos are runnable by a checker-resolved graph:
// excalidraw and vscode (the other five are Python/Rust/Java/Go/Swift). The
// questions are intentionally medium difficulty so the benchmark measures
// navigation behavior rather than open-ended architecture spelunking.
//
// Spends real Claude credits; non-deterministic; not wired into CI. Requires
// `claude` and `go` on PATH.
//
// Usage:
//   node experimental/graph-bench/agent-ab.mjs --repo=excalidraw --runs=2
//   node experimental/graph-bench/agent-ab.mjs --repo=vscode --runs=4 --model=opus
//   node experimental/graph-bench/agent-ab.mjs --repo=typeorm --repo-dir=experimental/benchmark/.work/ttsc-benchmark-typeorm@ttsc
import cp from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");
const ttscDir = path.join(repoRoot, "packages", "ttsc");
const ARCHITECTURE_QUESTION =
  "I'm onboarding to this TypeScript project and need a fast call-path briefing, not a directory survey. Pick one common exported API and trace it from the public entry point through the internal implementation using symbol/call relationships. Name key files/classes/functions in order; keep it concise.";

// TypeScript benchmark repos and their medium-difficulty questions.
const REPOS = {
  excalidraw: {
    url: "https://github.com/excalidraw/excalidraw",
    tsconfig: "tsconfig.json",
    question: ARCHITECTURE_QUESTION,
  },
  vscode: {
    url: "https://github.com/microsoft/vscode",
    fixtureUrl: "https://github.com/samchon/ttsc-benchmark-vscode.git",
    tsconfig: "src/tsconfig.json",
    question: ARCHITECTURE_QUESTION,
  },
  nestjs: {
    url: "https://github.com/nestjs/nest",
    fixtureUrl: "https://github.com/samchon/ttsc-benchmark-nestjs.git",
    tsconfig: "tsconfig.graph.json",
    question: ARCHITECTURE_QUESTION,
  },
  vue: {
    url: "https://github.com/vuejs/core",
    fixtureUrl: "https://github.com/samchon/ttsc-benchmark-vue.git",
    tsconfig: "tsconfig.graph.json",
    question: ARCHITECTURE_QUESTION,
  },
  zod: {
    url: "https://github.com/colinhacks/zod",
    fixtureUrl: "https://github.com/samchon/ttsc-benchmark-zod.git",
    tsconfig: "tsconfig.graph.json",
    question: ARCHITECTURE_QUESTION,
  },
  typeorm: {
    url: "https://github.com/typeorm/typeorm",
    fixtureUrl: "https://github.com/samchon/ttsc-benchmark-typeorm.git",
    tsconfig: "tsconfig.graph.json",
    question: ARCHITECTURE_QUESTION,
  },
  rxjs: {
    url: "https://github.com/ReactiveX/rxjs",
    fixtureUrl: "https://github.com/samchon/ttsc-benchmark-rxjs.git",
    tsconfig: "tsconfig.graph.json",
    question: ARCHITECTURE_QUESTION,
  },
  "shopping-backend": {
    url: "https://github.com/samchon/shopping-backend",
    fixtureUrl: "https://github.com/samchon/shopping-backend.git",
    tsconfig: "tsconfig.json",
    question: ARCHITECTURE_QUESTION,
  },
};

const args = parseArgs(process.argv.slice(2));
const repoKey = args.repo ?? "excalidraw";
const spec = REPOS[repoKey];
if (!spec)
  throw new Error(
    `unknown --repo ${repoKey}; choose ${Object.keys(REPOS).join(" | ")}`,
  );
const runs = Number(args.runs ?? 2);
const model = args.model ?? "sonnet";
const tsconfig = args.tsconfig ?? spec.tsconfig;
const question = args.question ?? spec.question;
if (!question) throw new Error(`repo ${repoKey} has no benchmark question`);

const fixtureBranch = args["fixture-branch"];
if (
  fixtureBranch &&
  fixtureBranch !== "ttsc" &&
  fixtureBranch !== "ttsc-lint"
) {
  throw new Error("--fixture-branch must be 'ttsc' or 'ttsc-lint'");
}
if (fixtureBranch && !spec.fixtureUrl) {
  throw new Error(`repo ${repoKey} has no performance fixture repo`);
}

const corpus = args.corpus ?? path.join(os.tmpdir(), "graph-corpus");
const cloneKey = fixtureBranch ? `${repoKey}@${fixtureBranch}` : repoKey;
const repoUrl = fixtureBranch ? spec.fixtureUrl : spec.url;
const repoDir = args["repo-dir"]
  ? path.resolve(args["repo-dir"])
  : path.join(corpus, cloneKey);

// --guidance=1 adds a fairness condition: a neutral project instruction telling
// the agent to prefer the code-graph MCP over grep. It names no specific tool and
// leaks no answer, and the SAME text is used for @ttsc/graph and codegraph, so it
// favors neither. Written as both CLAUDE.md and AGENTS.md so every agent reads it
// in its own convention. The point is to measure each model with and without the
// nudge, since a tool-conservative harness (codex) ignores MCP instructions but
// honors a project file.
const guidance = args.guidance === "1" || args.guidance === "true";
const toolSetupMs =
  args["tool-setup-ms"] === undefined
    ? undefined
    : Number(args["tool-setup-ms"]);
// --cg points the "graph" arm at codegraph (colbymchenry/codegraph) instead of
// @ttsc/graph, so the exact same A/B and guidance condition can be run against the
// tool we ported, for an apples-to-apples comparison. The repo must already be
// indexed (`codegraph init`).
const cg = args.cg === "1" || args.cg === "true";
const GUIDANCE = `# Code navigation

For architecture/code-flow questions, prefer the code-graph MCP before grep/read.
Query named symbols, files, or domain nouns; avoid generic words.
Re-query when following returned symbols/files, narrowing, or after edits.
Avoid duplicate graph calls; answer from graph when it has source/edges.
Read only for no match, non-TS files, edited source, or missing context.
`;
// The guided arm models how a normal user actually works: they keep an AGENTS.md
// and, in the prompt, tell the agent to follow it. That elevates the project file
// to the authority of the user's own words — the channel a tool-conservative
// harness (codex) honors most — so it is added to the question ONLY in the guided
// arm, leaving baseline/graph as the bare question.
const GUIDED_PREFIX =
  "Follow this project's AGENTS.md instructions when answering.\n\n";
let guidanceSnapshot = null;
function snapshotGuidanceFiles() {
  return ["CLAUDE.md", "AGENTS.md"].map((name) => {
    const file = path.join(repoDir, name);
    if (!fs.existsSync(file)) return { file, existed: false };
    return { file, existed: true, content: fs.readFileSync(file, "utf8") };
  });
}
function setGuidance(on) {
  guidanceSnapshot ??= snapshotGuidanceFiles();
  for (const entry of guidanceSnapshot) {
    if (on) fs.writeFileSync(entry.file, GUIDANCE);
    else if (entry.existed) fs.writeFileSync(entry.file, entry.content);
    else fs.rmSync(entry.file, { force: true });
  }
}

const goRoot = path.join(os.homedir(), "go-sdk", "go", "bin");
const goEnv = {
  ...process.env,
  PATH: fs.existsSync(goRoot)
    ? `${goRoot}${path.delimiter}${process.env.PATH ?? ""}`
    : process.env.PATH,
};

// 1. Build the MCP server binary (skipped for codegraph, which is a global CLI).
const binary = path.join(
  os.tmpdir(),
  `ttscgraph-ab-${process.pid}${process.platform === "win32" ? ".exe" : ""}`,
);
if (!cg) {
  console.log("Building ttscgraph...");
  runOrThrow("go", ["build", "-o", binary, "./cmd/ttscgraph"], ttscDir, goEnv);
}

// 2. Clone the target repo (shallow) if absent.
if (args["repo-dir"] && !fs.existsSync(repoDir)) {
  throw new Error(`--repo-dir does not exist: ${repoDir}`);
}
if (!args["repo-dir"] && !fs.existsSync(repoDir)) {
  fs.mkdirSync(corpus, { recursive: true });
  console.log(
    `Cloning ${repoUrl}${fixtureBranch ? `#${fixtureBranch}` : ""} (shallow) -> ${repoDir} ...`,
  );
  runOrThrow(
    "git",
    [
      "clone",
      "--depth",
      "1",
      ...(fixtureBranch ? ["--branch", fixtureBranch] : []),
      repoUrl,
      repoDir,
    ],
    corpus,
    process.env,
  );
}

// 3. WITH = @ttsc/graph; WITHOUT = empty config. Both --strict-mcp-config.
// Default runs stay single-process so setup/build cost remains part of the
// measured cell. Pass --daemon=1 only for an explicitly amortized large-repo run.
// codegraph manages its own indexing/daemon, so the ttscgraph daemon path (which
// spawns the unbuilt `binary`) must be skipped under --cg.
const useDaemon = !cg && (args.daemon === "1" || args.daemon === "true");
let daemon = null;
let withArgs;
if (useDaemon) {
  const portFile = path.join(
    os.tmpdir(),
    `ttscgraph-daemon-${process.pid}.port`,
  );
  console.log("Starting daemon (build once)...");
  daemon = cp.spawn(
    binary,
    [
      "--daemon",
      "--cwd",
      repoDir,
      "--tsconfig",
      tsconfig,
      "--port-file",
      portFile,
      "--idle",
      "0",
    ],
    { stdio: "ignore", windowsHide: true },
  );
  const addr = waitForPort(portFile, 30_000);
  console.log(
    `  daemon at ${addr}; warming (type-checking ${repoKey}, this can take minutes)...`,
  );
  const warmStart = Date.now();
  warmDaemon(binary, addr);
  console.log(`  warm in ${((Date.now() - warmStart) / 1000).toFixed(0)}s`);
  withArgs = ["--connect", addr];
} else {
  withArgs = ["--stdio", "--cwd", repoDir, "--tsconfig", tsconfig];
}

const withCfg = path.join(os.tmpdir(), `mcp-graph-${process.pid}.json`);
const emptyCfg = path.join(os.tmpdir(), `mcp-empty-${process.pid}.json`);
const serverCfg = cg
  ? { codegraph: codegraphServerConfig(repoDir) }
  : { "ttsc-graph": { command: binary, args: withArgs } };
fs.writeFileSync(withCfg, JSON.stringify({ mcpServers: serverCfg }));
fs.writeFileSync(emptyCfg, JSON.stringify({ mcpServers: {} }));

const arms = [
  { name: "baseline", cfg: emptyCfg, guide: false },
  { name: "graph", cfg: withCfg, guide: false },
];
if (guidance) arms.push({ name: "guided", cfg: withCfg, guide: true });

console.log(
  `\ncodegraph A/B on ${repoKey} — model ${model}, ${runs} run(s) x ${arms.length} arms` +
    (fixtureBranch ? `, fixture ${fixtureBranch}` : "") +
    (guidance ? " (+guided = graph with a project instruction to use it)" : ""),
);
console.log(`Q: ${question}\n`);

const reportName = `agent-ab-report${guidance ? "-guided" : ""}.json`;
const reportPath = args.report
  ? path.resolve(args.report)
  : path.join(here, reportName);
const traceDir = args["trace-dir"]
  ? path.resolve(args["trace-dir"])
  : path.join(
      path.dirname(reportPath),
      `${path.basename(reportPath, path.extname(reportPath))}.traces`,
    );
fs.mkdirSync(traceDir, { recursive: true });

const samples = Object.fromEntries(arms.map((a) => [a.name, []]));
let spent = 0;
try {
  for (const arm of arms) {
    setGuidance(arm.guide);
    const prompt = arm.guide ? GUIDED_PREFIX + question : question;
    for (let r = 0; r < runs; r++) {
      const m = runClaude(prompt, arm.cfg, arm.name, r + 1);
      samples[arm.name].push(m);
      spent += m.cost;
      console.log(
        `  ${arm.name.padEnd(8)} run ${r + 1}: $${m.cost.toFixed(3)}, ${m.tokens} tok, ${m.tools} tools ` +
          `(read ${m.reads}, grep ${m.grep}, graph ${m.graph}), ${(m.durMs / 1000).toFixed(0)}s` +
          (m.ok ? "" : "  [FAILED]") +
          `  [running $${spent.toFixed(2)}]`,
      );
    }
  }
} finally {
  // Always strip the guidance files, even on a mid-run throw, so a later
  // no-guidance run cannot inherit them and taint its baseline/graph arms.
  setGuidance(false);
}

const med = (arm, k) =>
  median(samples[arm].filter((m) => m.ok).map((m) => m[k]));
const pct = (g, b) => (b === 0 ? 0 : Math.round((1 - g / b) * 100));
const line = (label, k, fmt = (x) => x) => {
  const b = med("baseline", k);
  let s = `  ${label.padEnd(12)} baseline ${fmt(b)}  ->  graph ${fmt(med("graph", k))} (${pct(med("graph", k), b)}%)`;
  if (guidance)
    s += `  ->  guided ${fmt(med("guided", k))} (${pct(med("guided", k), b)}%)`;
  console.log(s);
};

console.log(
  `\nMedian of ${runs} run(s), vs empty-MCP baseline (codegraph metrics):`,
);
line("tokens", "tokens");
line("tool calls", "tools");
line("cost", "cost", (x) => `$${x.toFixed(3)}`);
line("wall time", "durMs", (x) => `${(x / 1000).toFixed(0)}s`);
console.log(`\nTotal spend this run: $${spent.toFixed(2)}`);

fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(
  reportPath,
  `${JSON.stringify({ tool: cg ? "codegraph" : "ttsc-graph", ...(toolSetupMs !== undefined ? { toolSetupMs } : {}), repo: repoKey, fixtureBranch, repoDir, model, daemon: useDaemon, runs, guidance, question, traceDir, samples }, null, 2)}\n`,
);
if (daemon) daemon.kill();
try {
  fs.rmSync(binary, { force: true });
  fs.rmSync(withCfg, { force: true });
  fs.rmSync(emptyCfg, { force: true });
} catch {
  /* best effort */
}

// waitForPort polls the daemon's port file until it reports a host:port address.
function waitForPort(portFile, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (fs.existsSync(portFile)) {
      const addr = fs.readFileSync(portFile, "utf8").trim();
      if (addr) return addr;
    }
    syncSleep(150);
  }
  throw new Error("daemon did not report a port in time");
}

// warmDaemon drives one graph_explore through the proxy, which blocks until the
// daemon's background type-check lands, so the timed sessions hit a warm server.
function warmDaemon(bin, addr) {
  const init = JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {},
  });
  const call = JSON.stringify({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: { name: "graph_explore", arguments: { query: "main" } },
  });
  const result = cp.spawnSync(bin, ["--connect", addr], {
    input: `${init}\n${call}\n`,
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 64 * 1024 * 1024,
    timeout: 1_200_000,
  });
  if (result.status !== 0)
    throw new Error(
      `daemon warm-up failed: ${(result.stderr || "").slice(0, 300)}`,
    );
}

// syncSleep blocks for ms without async, so the synchronous setup can poll.
function syncSleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function runClaude(question, cfg, armName, runNumber) {
  // Prevent Claude's built-in Agent tool from turning an MCP benchmark into
  // subagent IO. Do not use --bare here: it disables OAuth/keychain auth.
  const claudeArgs = [
    "-p",
    "--output-format",
    "stream-json",
    "--verbose",
    "--permission-mode",
    "bypassPermissions",
    "--disallowedTools",
    "Agent",
    "--model",
    model,
    "--effort",
    "high",
    "--max-budget-usd",
    "4",
    "--strict-mcp-config",
    "--mcp-config",
    cfg,
  ];
  const result = cp.spawnSync(
    "claude",
    claudeArgs,
    {
      cwd: repoDir,
      input: question,
      encoding: "utf8",
      windowsHide: true,
      shell: true,
      maxBuffer: 256 * 1024 * 1024,
      timeout: 900_000,
    },
  );
  if (result.error) throw result.error;
  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";
  const base = `${armName}-run-${runNumber}`;
  fs.writeFileSync(path.join(traceDir, `${base}.stream.jsonl`), stdout);
  if (stderr) fs.writeFileSync(path.join(traceDir, `${base}.stderr.log`), stderr);
  return parseStream(stdout);
}

function codegraphServerConfig(targetRepoDir) {
  const args = ["serve", "--mcp", "--path", targetRepoDir];
  return process.platform === "win32"
    ? {
        command: "cmd.exe",
        args: ["/d", "/s", "/c", "codegraph", ...args],
        env: { CODEGRAPH_NO_DAEMON: "1" },
      }
    : {
        command: "codegraph",
        args,
        env: { CODEGRAPH_NO_DAEMON: "1" },
      };
}

// parseStream mirrors codegraph's parse-bench-readme.mjs: tokens are summed over
// every assistant turn's usage (not the last-turn result.usage), and tool calls
// are counted across assistant events (ToolSearch excluded).
function parseStream(text) {
  let tokens = 0,
    tools = 0,
    reads = 0,
    grep = 0,
    graph = 0,
    other = 0,
    result = null;
  for (const raw of text.split("\n")) {
    if (!raw.trim()) continue;
    let e;
    try {
      e = JSON.parse(raw);
    } catch {
      continue;
    }
    if (e.type === "assistant") {
      const u = e.message?.usage;
      if (u)
        tokens +=
          (u.input_tokens || 0) +
          (u.output_tokens || 0) +
          (u.cache_read_input_tokens || 0) +
          (u.cache_creation_input_tokens || 0);
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
  return {
    tokens,
    tools,
    reads,
    grep,
    graph,
    other,
    cost: result?.total_cost_usd || 0,
    durMs: result?.duration_ms || 0,
    ok: result?.subtype === "success",
  };
}

function runOrThrow(command, commandArgs, cwd, env) {
  const result = cp.spawnSync(command, commandArgs, {
    cwd,
    env,
    encoding: "utf8",
    windowsHide: true,
    shell: command === "claude",
  });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(
      `${command} ${commandArgs.join(" ")} failed (${result.status})\n${result.stderr ?? ""}`,
    );
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
