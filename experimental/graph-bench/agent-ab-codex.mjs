// Agent-cost A/B for @ttsc/graph driven by OpenAI's `codex` CLI (GPT-5.5), the
// cross-model companion to agent-ab.mjs (which drives Claude). Same codegraph
// methodology: one structural question per repo, run twice — once with the
// @ttsc/graph MCP server, once with no MCP — and report tokens (summed per turn),
// tool calls, and wall time, median over N runs.
//
// codex is configured through a MINIMAL temp CODEX_HOME per arm (a copied
// auth.json plus a generated config.toml) so the user's real AGENTS.md / hooks /
// personality do not leak into the measurement and the only difference between
// the two arms is the MCP server. Model and reasoning effort are pinned to
// gpt-5.5 / high to line up with the Claude harness's --effort high.
//
// codex --json has no cost field, so this reports tokens + tool calls + wall
// time (not dollars). A "tool call" is a codex command_execution (shell read or
// grep) or an mcp_tool_call (graph_explore / graph_diagnostics); "graph" counts
// only the latter.
//
// Spends real codex credits; non-deterministic; not wired into CI. Requires
// `codex` (logged in) and `go` on PATH.
//
// Usage:
//   node experimental/graph-bench/agent-ab-codex.mjs --repo=excalidraw --runs=4
//   node experimental/graph-bench/agent-ab-codex.mjs --repo=vscode --runs=4
//   node experimental/graph-bench/agent-ab-codex.mjs --repo=typeorm --repo-dir=experimental/benchmark/.work/ttsc-benchmark-typeorm@ttsc
import cp from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");
const ttscDir = path.join(repoRoot, "packages", "ttsc");
// The shared structural question, kept as a markdown task spec so both harnesses
// pose an identical prompt. It is deliberately tool-neutral: it demands a
// complete, verified call path (traced to the real work, no guessed hops), not
// our graph's output shape, so neither grep nor the graph is handed the answer's
// format. The rigor stops a shallow guess from passing; the neutrality keeps the
// token comparison honest.
const ARCHITECTURE_QUESTION = fs
  .readFileSync(path.join(here, "questions", "architecture-callpath.md"), "utf8")
  .trim();

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
const model = args.model ?? "gpt-5.5";
const effort = "high";
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

const toolSetupMs =
  args["tool-setup-ms"] === undefined
    ? undefined
    : Number(args["tool-setup-ms"]);
// --cg points the graph arm at codegraph instead of @ttsc/graph (repo must be
// indexed with `codegraph init`), for an apples-to-apples comparison on codex.
const cg = args.cg === "1" || args.cg === "true";

const goRoot = path.join(os.homedir(), "go-sdk", "go", "bin");
const goEnv = {
  ...process.env,
  PATH: fs.existsSync(goRoot)
    ? `${goRoot}${path.delimiter}${process.env.PATH ?? ""}`
    : process.env.PATH,
};

// 1. Build the MCP server binary.
const binary = path.join(
  os.tmpdir(),
  `ttscgraph-codex-${process.pid}${process.platform === "win32" ? ".exe" : ""}`,
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

// 3. Default runs stay single-process so setup/build cost remains part of the
// measured cell. Pass --daemon=1 only for an explicitly amortized large-repo run.
// codegraph manages its own indexing/daemon, so the ttscgraph daemon path (which
// spawns the unbuilt `binary`) must be skipped under --cg.
const useDaemon = !cg && (args.daemon === "1" || args.daemon === "true");
let daemon = null;
let mcpArgs;
if (useDaemon) {
  const portFile = path.join(
    os.tmpdir(),
    `ttscgraph-codex-daemon-${process.pid}.port`,
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
  mcpArgs = ["--connect", addr];
} else {
  mcpArgs = ["--stdio", "--cwd", repoDir, "--tsconfig", tsconfig];
}

// 4. Two minimal CODEX_HOMEs: identical except the graph one configures the MCP
// server. Both copy the real auth.json so codex stays logged in.
const realHome = path.join(os.homedir(), ".codex");
const withHome = makeCodexHome("with", mcpArgs);
const withoutHome = makeCodexHome("without", null);

const arms = [
  { name: "baseline", home: withoutHome },
  { name: "graph", home: withHome },
];

console.log(
  `\ncodegraph A/B on ${repoKey} via codex — model ${model} (effort ${effort}), ${runs} run(s) x ${arms.length} arms` +
    (fixtureBranch ? `, fixture ${fixtureBranch}` : ""),
);
console.log(`Q: ${question}\n`);

const reportName = "agent-ab-codex-report.json";
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

const MAX_RUN_RETRIES = 4;
const samples = Object.fromEntries(arms.map((a) => [a.name, []]));
// Run-major, not arm-major: for each run index do every arm back to back, so a
// baseline/graph pair shares the same wall-clock window and a time-varying
// condition (a rate-limit spell) cannot land on one arm and not the other. Still
// strictly sequential, one invocation at a time, so the arms never contend.
for (let r = 0; r < runs; r++) {
  for (const arm of arms) {
    // A failed run (rate limit or an incomplete turn) carries no usable sample,
    // so retry it in place rather than letting it thin the median. The trace file
    // is keyed by run number, so a successful retry overwrites the failed attempt.
    let m;
    for (let attempt = 0; attempt <= MAX_RUN_RETRIES; attempt++) {
      m = runCodex(question, arm.home, arm.name, r + 1);
      if (m.ok) break;
      if (attempt < MAX_RUN_RETRIES)
        console.log(
          `  ${arm.name.padEnd(8)} run ${r + 1}: [FAILED] retrying (${attempt + 1}/${MAX_RUN_RETRIES})`,
        );
    }
    samples[arm.name].push(m);
    console.log(
      `  ${arm.name.padEnd(8)} run ${r + 1}: ${m.tokens} tok, ${m.tools} tools ` +
        `(shell ${m.shell}, graph ${m.graph}), ${(m.durMs / 1000).toFixed(0)}s` +
        (m.ok ? "" : "  [FAILED]"),
    );
  }
}

const med = (arm, k) =>
  median(samples[arm].filter((m) => m.ok).map((m) => m[k]));
const pct = (g, b) => (b === 0 ? 0 : Math.round((1 - g / b) * 100));
const line = (label, k, fmt = (x) => x) => {
  const b = med("baseline", k);
  const s = `  ${label.padEnd(12)} baseline ${fmt(b)}  ->  graph ${fmt(med("graph", k))} (${pct(med("graph", k), b)}%)`;
  console.log(s);
};

console.log(
  `\nMedian of ${runs} run(s), vs no-MCP baseline (codegraph metrics, codex/${model}):`,
);
line("tokens", "tokens");
line("tool calls", "tools");
line("wall time", "durMs", (x) => `${(x / 1000).toFixed(0)}s`);

fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(
  reportPath,
  `${JSON.stringify({ tool: cg ? "codegraph" : "ttsc-graph", ...(toolSetupMs !== undefined ? { toolSetupMs } : {}), repo: repoKey, fixtureBranch, repoDir, model, effort, daemon: useDaemon, runs, question, traceDir, samples }, null, 2)}\n`,
);
if (daemon) daemon.kill();
cleanup([binary, withHome, withoutHome]);

// makeCodexHome builds a throwaway CODEX_HOME: the real auth.json plus a minimal
// config.toml pinning the model and effort, and (for the graph arm) the
// @ttsc/graph MCP server. TOML literal strings ('...') carry Windows paths
// verbatim with no escaping.
function makeCodexHome(tag, serverArgs) {
  const home = path.join(os.tmpdir(), `codex-home-${tag}-${process.pid}`);
  fs.mkdirSync(home, { recursive: true });
  fs.copyFileSync(
    path.join(realHome, "auth.json"),
    path.join(home, "auth.json"),
  );
  let toml = `model = '${model}'\nmodel_reasoning_effort = '${effort}'\n`;
  if (serverArgs) {
    if (cg) {
      const command = process.platform === "win32" ? "cmd.exe" : "codegraph";
      const a = codegraphServerArgs(repoDir)
        .map((x) => `'${x}'`)
        .join(", ");
      toml += `\n[mcp_servers.codegraph]\ncommand = '${command}'\nargs = [${a}]\nenv = { CODEGRAPH_NO_DAEMON = "1" }\n`;
    } else {
      const argList = serverArgs.map((a) => `'${a}'`).join(", ");
      toml += `\n[mcp_servers.ttscgraph]\ncommand = '${binary}'\nargs = [${argList}]\n`;
    }
  }
  fs.writeFileSync(path.join(home, "config.toml"), toml);
  return home;
}

function codegraphServerArgs(targetRepoDir) {
  const args = ["serve", "--mcp", "--path", targetRepoDir];
  return process.platform === "win32"
    ? ["/d", "/s", "/c", "codegraph", ...args]
    : args;
}

function runCodex(question, codexHome, armName, runNumber) {
  const start = Date.now();
  const result = cp.spawnSync(
    "codex",
    [
      "exec",
      "--json",
      "--dangerously-bypass-approvals-and-sandbox",
      "--skip-git-repo-check",
      "--ephemeral",
      "-C",
      repoDir,
    ],
    {
      input: question,
      encoding: "utf8",
      windowsHide: true,
      shell: true,
      env: { ...process.env, CODEX_HOME: codexHome },
      maxBuffer: 256 * 1024 * 1024,
      timeout: 1_200_000,
    },
  );
  if (result.error) throw result.error;
  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";
  const base = `${armName}-run-${runNumber}`;
  fs.writeFileSync(path.join(traceDir, `${base}.stream.jsonl`), stdout);
  if (stderr) fs.writeFileSync(path.join(traceDir, `${base}.stderr.log`), stderr);
  return parseStream(stdout, Date.now() - start);
}

// parseStream sums per-turn usage (input + output) across turn.completed events,
// and counts tool calls from item.completed events: command_execution (shell
// reads/greps) and mcp_tool_call (graph). It records the item-type histogram so
// the classification can be verified against a real run.
function parseStream(text, durMs) {
  let tokens = 0,
    cached = 0,
    turns = 0,
    tools = 0,
    shell = 0,
    graph = 0,
    completed = false,
    answered = false;
  const types = {};
  for (const raw of text.split("\n")) {
    if (!raw.trim()) continue;
    let e;
    try {
      e = JSON.parse(raw);
    } catch {
      continue;
    }
    if (e.type === "turn.completed") {
      completed = true;
      const u = e.usage || {};
      tokens += (u.input_tokens || 0) + (u.output_tokens || 0);
      cached += u.cached_input_tokens || 0;
      turns++;
    } else if (e.type === "item.completed") {
      const it = e.item || {};
      const t = it.type || "?";
      types[t] = (types[t] || 0) + 1;
      if (t === "mcp_tool_call") {
        tools++;
        graph++;
      } else if (t === "command_execution") {
        tools++;
        shell++;
      } else if (t === "agent_message") {
        answered = true;
      }
    }
  }
  return {
    tokens,
    cached,
    turns,
    tools,
    shell,
    graph,
    types,
    durMs,
    ok: completed && answered,
  };
}

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

function syncSleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function runOrThrow(command, commandArgs, cwd, env) {
  const result = cp.spawnSync(command, commandArgs, {
    cwd,
    env,
    encoding: "utf8",
    windowsHide: true,
    shell: command === "codex",
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

function cleanup(paths) {
  for (const p of paths) {
    try {
      fs.rmSync(p, { recursive: true, force: true });
    } catch {
      /* best effort */
    }
  }
}

function parseArgs(argv) {
  const out = {};
  for (const arg of argv) {
    const match = /^--([^=]+)=(.*)$/.exec(arg);
    if (match) out[match[1]] = match[2];
  }
  return out;
}
