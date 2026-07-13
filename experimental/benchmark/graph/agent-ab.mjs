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
// The MCP server is the @ttsc/graph TypeScript launcher (packages/graph/lib/bin.js),
// which runs `ttscgraph dump` once for the project (the Go binary is now dump-only)
// and serves one planned graph-inspection tool over stdio.
// All tool guidance comes from the server's MCP initialize/tool descriptions.
// The manifest question is sent unchanged; graph-arm validity is enforced after
// the run from the trace instead of by adding prompt text.
//
// Each sample also captures the agent's final answer text for manual
// inspection. The benchmark itself measures runtime behavior only: tokens, tool
// calls, cost, and wall time.
//
// Spends real Claude credits; non-deterministic; not wired into CI. Requires
// `claude` and `go` on PATH, and a built `@ttsc/graph` (packages/graph/lib).
//
// Usage:
//   node experimental/benchmark/graph/agent-ab.mjs --prompt-family=dedicated --repo=excalidraw --runs=2
//   node experimental/benchmark/graph/agent-ab.mjs --prompt-family=common --repo=vscode --runs=4 --model=opus
//   node experimental/benchmark/graph/agent-ab.mjs --prompt-id=typeorm-dedicated-v1 --runs=2
import cp from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { GROUNDING, TOOL_NUDGE } from "./prompt.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..", "..");
const ttscDir = path.join(repoRoot, "packages", "ttsc");
const graphLauncher = path.join(repoRoot, "packages", "graph", "lib", "bin.js");
const SOURCE_FILE = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/i;

// The manifest (questions/manifest.json) selects reusable prompt files. The
// benchmark records runtime metrics only: tokens, tools, cost, and time.
function loadManifest() {
  const manifestPath = path.join(here, "questions", "manifest.json");
  if (!fs.existsSync(manifestPath)) return { prompts: [] };
  return JSON.parse(fs.readFileSync(manifestPath, "utf8"));
}

// Resolve a manifest prompt by --prompt-id (exact), else the first prompt of a
// --prompt-family, scoped to --repo when given. Returns the prompt entry plus
// the loaded question text, or null when neither flag was passed.
function resolveManifestPrompt(args) {
  const id = args["prompt-id"];
  const family = args["prompt-family"];
  if (!id && !family) return null;
  const manifest = loadManifest();
  const prompts = manifest.prompts ?? [];
  const repoFilter = args.repo;
  const entry = id
    ? prompts.find((p) => p.id === id)
    : prompts.find(
        (p) => p.family === family && (!repoFilter || p.repo === repoFilter),
      );
  if (!entry) {
    throw new Error(
      id
        ? `unknown --prompt-id ${id}; manifest has ${prompts.map((p) => p.id).join(", ")}`
        : `no manifest prompt for --prompt-family ${family}${repoFilter ? ` repo ${repoFilter}` : ""}`,
    );
  }
  const questionFile = path.resolve(here, "questions", entry.file);
  const text = fs.readFileSync(questionFile, "utf8").trim();
  return {
    entry,
    text,
    questionSha256: entry.questionSha256,
  };
}

// TypeScript benchmark repos and their fixture metadata.
const REPOS = {
  excalidraw: {
    url: "https://github.com/excalidraw/excalidraw",
    fixtureUrl: "https://github.com/samchon/ttsc-benchmark-excalidraw.git",
    fixtureBranch: "ttsc",
    tsconfig: "tsconfig.json",
  },
  vscode: {
    url: "https://github.com/microsoft/vscode",
    fixtureUrl: "https://github.com/samchon/ttsc-benchmark-vscode.git",
    tsconfig: "src/tsconfig.json",
  },
  nestjs: {
    url: "https://github.com/nestjs/nest",
    fixtureUrl: "https://github.com/samchon/ttsc-benchmark-nestjs.git",
    tsconfig: "tsconfig.json",
  },
  vue: {
    url: "https://github.com/vuejs/core",
    fixtureUrl: "https://github.com/samchon/ttsc-benchmark-vue.git",
    tsconfig: "tsconfig.json",
  },
  zod: {
    url: "https://github.com/colinhacks/zod",
    fixtureUrl: "https://github.com/samchon/ttsc-benchmark-zod.git",
    tsconfig: "tsconfig.json",
  },
  typeorm: {
    url: "https://github.com/typeorm/typeorm",
    fixtureUrl: "https://github.com/samchon/ttsc-benchmark-typeorm.git",
    tsconfig: "tsconfig.json",
  },
  rxjs: {
    url: "https://github.com/ReactiveX/rxjs",
    fixtureUrl: "https://github.com/samchon/ttsc-benchmark-rxjs.git",
    tsconfig: "tsconfig.json",
  },
  "shopping-backend": {
    url: "https://github.com/samchon/shopping-backend",
    fixtureUrl: "https://github.com/samchon/shopping-backend.git",
    tsconfig: "tsconfig.json",
  },
};

const args = parseArgs(process.argv.slice(2));
// A manifest prompt (--prompt-id / --prompt-family) overrides the per-repo
// question and pins the repo, fixtureBranch, and tsconfig. Resolve it first so
// it can fill --repo when only --prompt-id is given.
const manifestPrompt = resolveManifestPrompt(args);
const repoKey = args.repo ?? manifestPrompt?.entry.repo ?? "excalidraw";
const spec = REPOS[repoKey];
if (!spec)
  throw new Error(
    `unknown --repo ${repoKey}; choose ${Object.keys(REPOS).join(" | ")}`,
  );
const runs = Number(args.runs ?? 2);
const model = args.model ?? "sonnet";
const effort = "high";
const claudeStartupGraceMs = parseNonNegativeInteger(
  args["claude-startup-grace-ms"] ??
    process.env.TTSC_CLAUDE_STARTUP_GRACE_MS ??
    "5000",
  "--claude-startup-grace-ms",
);
const claudeRunTimeoutMs = parseNonNegativeInteger(
  args["claude-run-timeout-ms"] ??
    process.env.TTSC_CLAUDE_RUN_TIMEOUT_MS ??
    "900000",
  "--claude-run-timeout-ms",
);
const tsconfig =
  args.tsconfig ?? manifestPrompt?.entry.tsconfig ?? spec.tsconfig;
const question = args.question ?? manifestPrompt?.text;
const promptId = manifestPrompt?.entry.id;
const promptFamily =
  manifestPrompt?.entry.family ?? (args.question ? "custom" : undefined);
if (!question) {
  throw new Error(
    "benchmark question required; pass --prompt-id, --prompt-family, or --question",
  );
}

const fixtureBranch =
  args["fixture-branch"] ??
  manifestPrompt?.entry.fixtureBranch ??
  spec.fixtureBranch;
// `graph` is the branch the AI-token benchmark measures; `ttsc` / `ttsc-lint`
// remain for a run pointed at a performance fixture branch.
const FIXTURE_BRANCHES = new Set(["graph", "ttsc", "ttsc-lint"]);
if (fixtureBranch && !FIXTURE_BRANCHES.has(fixtureBranch)) {
  throw new Error(
    `--fixture-branch must be one of ${[...FIXTURE_BRANCHES].join(", ")}`,
  );
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
// --cg, --cbm, and --serena point the graph arm at external MCP comparators.
// They use the same A/B prompt and validity gates as @ttsc/graph.
const cg = args.cg === "1" || args.cg === "true";
const cbm = args.cbm === "1" || args.cbm === "true";
const serena = args.serena === "1" || args.serena === "true";
if ([cg, cbm, serena].filter(Boolean).length > 1) {
  throw new Error("--cg, --cbm, and --serena cannot be combined");
}
const cbmBinary =
  args["cbm-binary"] ??
  process.env.CODEBASE_MEMORY_MCP_BINARY ??
  "codebase-memory-mcp";
const cbmCommand = commandPath(cbmBinary);
const cbmCacheDir = args["cbm-cache-dir"];
const serenaCommand = commandPath(
  args["serena-command"] ?? process.env.SERENA_MCP_COMMAND ?? "uvx",
);
// --arm selects which arms to run: `baseline` and `graph` can be measured
// separately so a fixed baseline is cached once and later graph iterations only
// rerun the MCP arm. Baseline-only does not need graph binaries or dependencies.
const armFilter = args.arm ?? "both";
const armsRequested = {
  baseline: armFilter === "both" || armFilter === "baseline",
  graph: armFilter === "both" || armFilter === "graph",
};
if (!armsRequested.baseline && !armsRequested.graph)
  throw new Error(`--arm must be baseline | graph | both, got ${armFilter}`);

const goRoot = path.join(os.homedir(), "go-sdk", "go", "bin");
const goEnv = {
  ...process.env,
  PATH: fs.existsSync(goRoot)
    ? `${goRoot}${path.delimiter}${process.env.PATH ?? ""}`
    : process.env.PATH,
};

// 1. Build the native ttscgraph dump binary, which the @ttsc/graph launcher runs
// once to build the resident graph (skipped for codegraph, which is a global CLI).
// The Go binary is dump-only now; the MCP server itself is the Node launcher.
const binary = path.join(
  os.tmpdir(),
  `ttscgraph-ab-${process.pid}${process.platform === "win32" ? ".exe" : ""}`,
);
if (armsRequested.graph && !cg && !cbm && !serena) {
  if (!fs.existsSync(graphLauncher)) {
    throw new Error(
      `@ttsc/graph launcher not built: ${graphLauncher}\n` +
        "Run `pnpm -C packages/graph build` (or a full workspace build) first.",
    );
  }
  console.log("Building ttscgraph dump binary...");
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
if (
  armsRequested.graph &&
  !cg &&
  !cbm &&
  !serena &&
  !fs.existsSync(path.join(repoDir, tsconfig))
) {
  throw new Error(`missing tsconfig: ${path.join(repoDir, tsconfig)}`);
}
if (armsRequested.graph && !cg && !cbm && !serena) ensureInstalled(repoDir);

// 3. WITH = @ttsc/graph; WITHOUT = empty config. Both --strict-mcp-config. The
// graph server is the Node launcher run over stdio; it shells out to the dump
// binary (pointed at via TTSC_GRAPH_BINARY) once at startup, then answers tool
// calls from the resident graph. The launcher has no daemon/port mode; its
// single type-check stays inside the measured cell, so there is no daemon path.
const withCfg = armsRequested.graph
  ? path.join(os.tmpdir(), `mcp-graph-${process.pid}.json`)
  : null;
const emptyCfg = armsRequested.baseline
  ? path.join(os.tmpdir(), `mcp-empty-${process.pid}.json`)
  : null;
if (withCfg) {
  const serverCfg = cg
    ? { codegraph: codegraphServerConfig(repoDir) }
    : cbm
      ? { "codebase-memory-mcp": codebaseMemoryServerConfig() }
      : serena
        ? { serena: serenaServerConfig(repoDir) }
        : {
            "ttsc-graph": {
              command: process.execPath,
              args: [graphLauncher, "--cwd", repoDir, "--tsconfig", tsconfig],
              env: { TTSC_GRAPH_BINARY: binary },
            },
          };
  validateMcpServerConfig(serverCfg);
  fs.writeFileSync(withCfg, JSON.stringify({ mcpServers: serverCfg }));
}
if (emptyCfg) fs.writeFileSync(emptyCfg, JSON.stringify({ mcpServers: {} }));
const arms = [
  { name: "baseline", cfg: emptyCfg },
  { name: "graph", cfg: withCfg },
].filter((a) => a.cfg);

console.log(
  `\ncodegraph A/B on ${repoKey} - model ${model}, ${runs} run(s) x ${arms.length} arms` +
    (promptId ? `, prompt ${promptId}` : "") +
    (fixtureBranch ? `, fixture ${fixtureBranch}` : ""),
);
console.log(`Q: ${question}\n`);

const reportName = "agent-ab-report.json";
const reportPath = args.report
  ? path.resolve(args.report)
  : path.join(here, reportName);
const traceDir = args["trace-dir"]
  ? path.resolve(args["trace-dir"])
  : path.join(
      path.dirname(reportPath),
      `${path.basename(reportPath, path.extname(reportPath))}.traces`,
    );
fs.rmSync(reportPath, { force: true });
fs.rmSync(traceDir, { recursive: true, force: true });
fs.mkdirSync(traceDir, { recursive: true });

const samples = Object.fromEntries(arms.map((a) => [a.name, []]));
let spent = 0;
const MAX_RUN_RETRIES = parseNonNegativeInteger(
  args["max-run-retries"] ?? "4",
  "--max-run-retries",
);
// Launch arms x runs concurrently, capped at TTSC_BENCH_CONCURRENCY (default
// unlimited). A high cap is fastest for experiment iteration; a low cap (a handful)
// keeps the host quiet enough that per-run timings and token counts settle, which
// matters when comparing close conditions. Each invocation is its own process with
// its own MCP server and trace file, so they never share state.
const concurrency = Number(process.env.TTSC_BENCH_CONCURRENCY) || Infinity;
const thunks = arms.flatMap((arm) =>
  Array.from({ length: runs }, (_, r) => async () => {
    // A run is a measurement when it spent tokens and the harness carried it to
    // an answer. A 529 overload reports subtype "success" with is_error and zero
    // usage; an unparseable tool call ends the turn early with tokens spent, no
    // tools run, and a failure on the record — and counted as a sample it reads
    // as the cheapest cell in the table, a saving the tool never earned. Both are
    // retried. The trace file is keyed by run number, so a successful retry
    // overwrites the failed attempt.
    let m;
    let attempts = 0;
    for (let attempt = 0; attempt <= MAX_RUN_RETRIES; attempt++) {
      attempts = attempt + 1;
      m = validateArmSample(
        await runClaude(
          promptForArm(question, arm.name),
          arm.cfg,
          arm.name,
          r + 1,
        ),
        arm.name,
      );
      if (Number(m?.tokens ?? 0) > 0 && m?.ok !== false) break;
      if (attempt < MAX_RUN_RETRIES)
        console.log(
          `  ${arm.name.padEnd(8)} run ${r + 1}: [FAILED] ${m.error || ""} retrying (${attempt + 1}/${MAX_RUN_RETRIES})`,
        );
    }
    // Tag the sample with prompt provenance only. The benchmark does not judge
    // answer correctness in-process.
    if (promptId) m.promptId = promptId;
    if (manifestPrompt?.questionSha256) {
      m.questionSha256 = manifestPrompt.questionSha256;
    }
    m.run = r + 1;
    m.attempts = attempts;
    samples[arm.name].push(m);
    spent += m.cost;
    console.log(
      `  ${arm.name.padEnd(8)} run ${r + 1}: $${m.cost.toFixed(3)}, ${m.tokens} tok, ${m.tools} tools ` +
        `(read ${m.reads}, grep ${m.grep}, shell ${m.shell ?? 0}, source ${m.sourceTouches ?? 0}, graph ${m.graph}, web ${m.web ?? 0}), ${(m.durMs / 1000).toFixed(0)}s` +
        (m.ok ? "" : `  [FAILED${m.error ? `: ${m.error}` : ""}]`) +
        `  [running $${spent.toFixed(2)}]`,
    );
  }),
);
await runWithConcurrency(thunks, concurrency);

// runWithConcurrency runs thunks with at most `limit` in flight at once, draining a
// shared cursor so a slow run never blocks a free worker.
async function runWithConcurrency(work, limit) {
  let next = 0;
  const worker = async () => {
    while (next < work.length) await work[next++]();
  };
  const lanes = Math.max(1, Math.min(limit, work.length));
  await Promise.all(Array.from({ length: lanes }, worker));
}

const med = (arm, k) =>
  median(
    (samples[arm] ?? [])
      .filter((m) => Number(m?.tokens ?? 0) > 0)
      .map((m) => m[k]),
  );
const pct = (g, b) => (b === 0 ? 0 : Math.round((1 - g / b) * 100));
const printBaselineLine = (label, k, fmt = (x) => x) => {
  console.log(`  ${label.padEnd(12)} baseline ${fmt(med("baseline", k))}`);
};
const printGraphLine = (label, k, fmt = (x) => x) => {
  console.log(`  ${label.padEnd(12)} graph ${fmt(med("graph", k))}`);
};
const printComparisonLine = (label, k, fmt = (x) => x) => {
  const b = med("baseline", k);
  console.log(
    `  ${label.padEnd(12)} baseline ${fmt(b)}  ->  graph ${fmt(med("graph", k))} (${pct(med("graph", k), b)}%)`,
  );
};

console.log(`\nMedian of ${runs} run(s), codegraph metrics:`);
const printLine =
  armsRequested.baseline && armsRequested.graph
    ? printComparisonLine
    : armsRequested.baseline
      ? printBaselineLine
      : printGraphLine;
printLine("tokens", "tokens");
printLine("tool calls", "tools");
printLine("cost", "cost", (x) => `$${x.toFixed(3)}`);
printLine("wall time", "durMs", (x) => `${(x / 1000).toFixed(0)}s`);

console.log(`\nTotal spend this run: $${spent.toFixed(2)}`);

const reportModelVersion = observedModelVersion(samples);
fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(
  reportPath,
  `${JSON.stringify(
    {
      tool: graphToolName(),
      ...(toolSetupMs !== undefined ? { toolSetupMs } : {}),
      ...(claudeStartupGraceMs > 0 ? { claudeStartupGraceMs } : {}),
      repo: repoKey,
      fixtureBranch,
      repoDir,
      model,
      effort,
      ...(reportModelVersion ? { modelVersion: reportModelVersion } : {}),
      ...(promptId ? { promptId } : {}),
      promptFamily,
      ...(manifestPrompt?.questionSha256
        ? { questionSha256: manifestPrompt.questionSha256 }
        : {}),
      daemon: false,
      runs,
      question,
      traceDir,
      samples,
    },
    null,
    2,
  )}\n`,
);
try {
  fs.rmSync(binary, { force: true });
  if (withCfg) fs.rmSync(withCfg, { force: true });
  if (emptyCfg) fs.rmSync(emptyCfg, { force: true });
} catch {
  /* best effort */
}

async function runClaude(question, cfg, armName, runNumber) {
  const delayedInput = armName === "graph" && claudeStartupGraceMs > 0;
  // Prevent Claude's built-in Agent tool from turning an MCP benchmark into
  // subagent IO. Do not use --bare here: it disables OAuth/keychain auth.
  // No --append-system-prompt: graph guidance comes from the MCP descriptions.
  // The benchmark prompt body is sent unchanged.
  const claudeArgs = [
    "-p",
    "--output-format",
    "stream-json",
    "--verbose",
    ...(delayedInput ? ["--input-format", "stream-json"] : []),
    "--no-session-persistence",
    "--permission-mode",
    "bypassPermissions",
    "--disallowedTools",
    "Agent",
    "--model",
    model,
    "--effort",
    effort,
    "--max-budget-usd",
    "4",
    "--strict-mcp-config",
    "--mcp-config",
    cfg,
  ];
  const base = `${armName}-run-${runNumber}`;
  const claudeHome = prepareClaudeHome(path.join(traceDir, `${base}.home`));
  const result = await spawnAsync("claude", claudeArgs, {
    cwd: repoDir,
    env: {
      ...process.env,
      HOME: claudeHome,
      USERPROFILE: claudeHome,
    },
    input: delayedInput ? streamJsonUserInput(question) : question,
    inputDelayMs: delayedInput ? claudeStartupGraceMs : 0,
    windowsHide: true,
    shell: true,
    timeout: claudeRunTimeoutMs,
  });
  if (result.error) throw result.error;
  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";
  fs.writeFileSync(path.join(traceDir, `${base}.stream.jsonl`), stdout);
  if (stderr)
    fs.writeFileSync(path.join(traceDir, `${base}.stderr.log`), stderr);
  return parseStream(stdout);
}

function streamJsonUserInput(text) {
  return (
    JSON.stringify({
      type: "user",
      message: {
        role: "user",
        content: text,
      },
      session_id: "benchmark",
      parent_tool_use_id: null,
    }) + "\n"
  );
}

function prepareClaudeHome(targetHome) {
  fs.rmSync(targetHome, { recursive: true, force: true });
  fs.mkdirSync(path.join(targetHome, ".claude"), { recursive: true });
  copyIfExists(path.join(os.homedir(), ".claude.json"), targetHome);
  copyIfExists(
    path.join(os.homedir(), ".claude", ".credentials.json"),
    path.join(targetHome, ".claude"),
  );
  return targetHome;
}

function copyIfExists(source, targetDir) {
  if (!fs.existsSync(source)) return;
  fs.copyFileSync(source, path.join(targetDir, path.basename(source)));
}

function observedModelVersion(allSamples) {
  for (const armSamples of Object.values(allSamples)) {
    for (const sample of armSamples ?? []) {
      if (sample.modelVersion) return sample.modelVersion;
    }
  }
  return undefined;
}

function promptForArm(baseQuestion, armName) {
  // The baseline arm is told to ground its answer in this checkout, because it
  // has nothing but the repository and its own memory of a famous project, and
  // without the sentence it answers from memory: it skips the files, states what
  // the upstream project does today, and spends nothing doing it. That is not a
  // baseline, it is a recital. An arm holding a tool that only ever returns
  // facts from this checkout's compiler needs no such warning, and giving it one
  // is an order to go verify what the compiler already resolved.
  if (armName === "baseline") return `${baseQuestion}\n\n${GROUNDING}`;
  // Every tool arm carries the same line, and the baseline none: see TOOL_NUDGE.
  // Claude Code defers MCP tool schemas behind ToolSearch, so a model told nothing
  // shell-explores the repo before it discovers the server at all — every graph
  // cell but one opened with two Bash calls before its first graph call.
  return `${baseQuestion}\n\n${TOOL_NUDGE}`;
}

// spawnAsync runs a child to completion and resolves its captured stdout/stderr,
// so many runs can be in flight at once via Promise.all. An async spawn never
// blocks the loop the way spawnSync would, which is what lets every arm and run
// fire concurrently.
function spawnAsync(
  command,
  commandArgs,
  { input, inputDelayMs = 0, ...spawnOpts },
) {
  return new Promise((resolve) => {
    const child = cp.spawn(command, commandArgs, spawnOpts);
    let stdout = "";
    let stderr = "";
    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (d) => (stdout += d));
    child.stderr?.on("data", (d) => (stderr += d));
    child.on("error", (error) => resolve({ error, stdout, stderr }));
    child.on("close", () => resolve({ stdout, stderr }));
    if (input) {
      // Claude Code can begin a print-mode turn before stdio MCP servers finish
      // connecting. The graph arm keeps stdin open briefly so the MCP client can
      // attach before the unchanged benchmark question is delivered.
      const writeInput = () => {
        if (!child.stdin || child.stdin.destroyed || !child.stdin.writable)
          return;
        child.stdin?.write(input);
        child.stdin?.end();
      };
      if (inputDelayMs > 0) {
        setTimeout(writeInput, inputDelayMs);
        return;
      }
      writeInput();
    } else {
      child.stdin?.end();
    }
  });
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

function validateMcpServerConfig(serverCfg) {
  if ((cg || cbm || serena) && serverCfg["ttsc-graph"]) {
    throw new Error("comparator Claude config must not include @ttsc/graph");
  }
  if (cg && !serverCfg.codegraph) {
    throw new Error("codegraph Claude config did not include codegraph");
  }
  if (cbm && !serverCfg["codebase-memory-mcp"]) {
    throw new Error(
      "codebase-memory Claude config did not include codebase-memory",
    );
  }
  if (serena && !serverCfg.serena) {
    throw new Error("Serena Claude config did not include Serena");
  }
}

function codebaseMemoryServerConfig() {
  return {
    command: cbmCommand,
    args: [],
    env: {
      ...(cbmCacheDir ? { CBM_CACHE_DIR: cbmCacheDir } : {}),
      CBM_LOG_LEVEL: "warn",
    },
  };
}

function serenaServerConfig(targetRepoDir) {
  return {
    command: serenaCommand,
    args: serenaServerArgs(targetRepoDir),
  };
}

function serenaServerArgs(targetRepoDir) {
  const configured = args["serena-args"] ?? process.env.SERENA_MCP_ARGS;
  if (configured) return parseConfiguredArgs(configured, targetRepoDir);
  return [
    "--from",
    "git+https://github.com/oraios/serena",
    "serena",
    "start-mcp-server",
    "--context",
    "claude-code",
    "--project",
    targetRepoDir,
    "--enable-web-dashboard",
    "False",
    "--open-web-dashboard",
    "False",
    "--log-level",
    "WARNING",
  ];
}

function parseConfiguredArgs(raw, targetRepoDir) {
  const parsed = raw.trim().startsWith("[")
    ? JSON.parse(raw)
    : raw
        .match(/"[^"]*"|'[^']*'|\S+/g)
        ?.map((part) => part.replace(/^(['"])(.*)\1$/, "$2"));
  if (!Array.isArray(parsed)) {
    throw new Error(
      "--serena-args must be a JSON string array or shell-like list",
    );
  }
  return parsed.map((part) =>
    String(part)
      .replaceAll("{repo}", targetRepoDir)
      .replaceAll("{cwd}", targetRepoDir),
  );
}

function commandPath(command) {
  return path.isAbsolute(command) || /[\\/]/.test(command)
    ? path.resolve(command)
    : command;
}

function graphToolName() {
  if (cg) return "codegraph";
  if (cbm) return "codebase-memory";
  if (serena) return "serena";
  return "ttsc-graph";
}

function ensureInstalled(targetRepoDir) {
  if (truthy(args["no-install"])) return;
  if (fs.existsSync(path.join(targetRepoDir, "node_modules"))) return;
  const plan = installPlan(targetRepoDir);
  if (!plan) return;
  console.log(`Installing dependencies in ${targetRepoDir} (${plan.label})...`);
  runOrThrow(plan.command, plan.args, targetRepoDir, process.env);
}

function installPlan(targetRepoDir) {
  if (fs.existsSync(path.join(targetRepoDir, "pnpm-lock.yaml"))) {
    return packageCommand("pnpm", [
      "install",
      "--frozen-lockfile",
      "--ignore-scripts",
    ]);
  }
  if (fs.existsSync(path.join(targetRepoDir, "package-lock.json"))) {
    return packageCommand("npm", ["ci", "--ignore-scripts"]);
  }
  if (fs.existsSync(path.join(targetRepoDir, "yarn.lock"))) {
    return packageCommand("yarn", [
      "install",
      "--frozen-lockfile",
      "--ignore-scripts",
    ]);
  }
  if (fs.existsSync(path.join(targetRepoDir, "package.json"))) {
    return packageCommand("npm", ["install", "--ignore-scripts"]);
  }
  return null;
}

function packageCommand(command, args) {
  return process.platform === "win32"
    ? {
        label: command,
        command: "cmd.exe",
        args: [
          "/d",
          "/s",
          "/c",
          ...(command === "yarn" ? ["corepack", "yarn"] : [command]),
          ...args,
        ],
      }
    : { label: command, command, args };
}

function truthy(value) {
  return value === "1" || value === "true" || value === "yes";
}

function parseNonNegativeInteger(value, label) {
  const out = Number(value);
  if (!Number.isInteger(out) || out < 0) {
    throw new Error(`${label} must be a non-negative integer`);
  }
  return out;
}

function sourceInspectionCommand(command) {
  return (
    /\b(git\s+grep|rg|grep|Select-String|findstr)\b/i.test(command) ||
    /\b(Get-Content|gc|cat|type|sed|awk|head|tail)\b/i.test(command) ||
    (/\b(git\s+ls-files|Get-ChildItem|gci|ls|dir)\b/i.test(command) &&
      /\b(src|packages|apps|lib|server|client|test|\.[cm]?[tj]sx?)\b/i.test(
        command,
      ))
  );
}

function sourceToolUse(name, input) {
  if (name === "Read") return SOURCE_FILE.test(input.file_path ?? "");
  if (name === "Grep" || name === "Glob") return true;
  if (name === "Bash" || name === "PowerShell" || name === "Shell")
    return sourceInspectionCommand(input.command ?? "");
  return false;
}

// parseStream mirrors codegraph's parse-bench-readme.mjs: tokens are summed over
// every assistant turn's usage (not the last-turn result.usage), and tool calls
// are counted across assistant events (ToolSearch excluded). It also captures the
// agent's final answer text: the `result` event's `result` string is the canonical
// final answer; the concatenated text of the last assistant turn is the fallback
// for a stream that ends without a result event.
function parseStream(text) {
  let tokens = 0,
    tools = 0,
    reads = 0,
    grep = 0,
    shell = 0,
    web = 0,
    graph = 0,
    other = 0,
    sourceTouches = 0,
    shellSource = 0,
    modelVersion = null,
    result = null,
    lastAssistantText = "";
  const shellCommands = [];
  for (const raw of text.split("\n")) {
    if (!raw.trim()) continue;
    let e;
    try {
      e = JSON.parse(raw);
    } catch {
      continue;
    }
    if (typeof e.model === "string") modelVersion ??= e.model;
    if (e.type === "assistant") {
      if (typeof e.message?.model === "string")
        modelVersion ??= e.message.model;
      const u = e.message?.usage;
      if (u)
        tokens +=
          (u.input_tokens || 0) +
          (u.output_tokens || 0) +
          (u.cache_read_input_tokens || 0) +
          (u.cache_creation_input_tokens || 0);
      const textBlocks = [];
      for (const b of e.message?.content || []) {
        if (b.type === "text" && typeof b.text === "string") {
          textBlocks.push(b.text);
          continue;
        }
        if (b.type !== "tool_use") continue;
        if (b.name === "ToolSearch") continue;
        tools++;
        const input = b.input || {};
        if (sourceToolUse(b.name, input)) sourceTouches++;
        if (b.name === "Read") reads++;
        else if (b.name === "Grep" || b.name === "Glob") grep++;
        else if (
          b.name === "Bash" ||
          b.name === "PowerShell" ||
          b.name === "Shell"
        ) {
          shell++;
          shellCommands.push(input.command ?? "");
          if (sourceInspectionCommand(input.command ?? "")) shellSource++;
        } else if (graphToolUseName(b.name)) graph++;
        else if (/web/i.test(b.name)) web++;
        else other++;
      }
      // Keep the last assistant turn that carried prose, so a trailing tool-only
      // turn does not blank the fallback answer.
      if (textBlocks.length) lastAssistantText = textBlocks.join("\n");
    } else if (e.type === "result") {
      result = e;
      // modelUsage also lists helper models (haiku title generation), so pick
      // the claude-* entry that produced the most output: the measured model.
      const usageModel = Object.entries(e.modelUsage ?? {})
        .filter(([key]) => key.startsWith("claude-"))
        .sort(
          ([, a], [, b]) => (b?.outputTokens ?? 0) - (a?.outputTokens ?? 0),
        )[0]?.[0];
      if (usageModel) modelVersion ??= usageModel;
    }
  }
  const ok = result?.subtype === "success" && !result?.is_error;
  // The result event's `result` is the agent's final answer on success; on a
  // 529-overload (is_error) it is the error message, so fall back to the last
  // assistant prose for the answer either way.
  const answer =
    ok && typeof result?.result === "string" && result.result.trim()
      ? result.result
      : lastAssistantText;
  return {
    tokens,
    tools,
    reads,
    grep,
    shell,
    web,
    graph,
    other,
    sourceTouches,
    shellSource,
    shellCommands: shellCommands.slice(-20),
    cost: result?.total_cost_usd || 0,
    durMs: result?.duration_ms || 0,
    ...(modelVersion ? { modelVersion } : {}),
    // A 529-overloaded run still reports subtype "success" while carrying
    // is_error: true and zero token usage, so it must be excluded explicitly or
    // its empty sample drags the median down and the comparison goes garbage.
    ok,
    answer,
    error: result?.is_error ? String(result?.result || "").slice(0, 80) : "",
  };
}

function graphToolUseName(name) {
  return /graph|ttsc|codebase|memory|serena|architecture|trace_path|search_code|semantic_query|index_status|list_projects|find_symbol|references|symbols_overview/i.test(
    name,
  );
}

function validateArmSample(sample, armName) {
  void armName;
  return sample;
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
