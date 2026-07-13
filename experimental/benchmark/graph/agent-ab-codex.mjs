// Agent-cost A/B for @ttsc/graph driven by OpenAI's `codex` CLI, the
// cross-model companion to agent-ab.mjs (which drives Claude). Same codegraph
// methodology: one structural question per repo, run twice — once with the
// @ttsc/graph MCP server, once with no MCP — and report tokens (summed per turn),
// tool calls, and wall time, median over N runs.
//
// codex is configured through a MINIMAL temp CODEX_HOME per arm (a copied
// auth.json plus a generated config.toml) so the user's real AGENTS.md / hooks /
// personality do not leak into the measurement and the only difference between
// the two arms is the MCP server. The default model is gpt-5.4-mini, and
// reasoning effort is pinned high.
//
// The MCP server is the @ttsc/graph TypeScript launcher (packages/graph/lib/bin.js),
// which runs `ttscgraph dump` once for the project (the Go binary is dump-only now)
// and serves one planned graph-inspection tool over stdio.
// Tool guidance comes from the server's MCP descriptions. The manifest question
// is sent unchanged; graph-arm validity is enforced after the run from the trace
// instead of by adding prompt text.
//
// codex --json has no cost field, so this reports tokens + tool calls + wall
// time (not dollars). A "tool call" is a codex command_execution (shell read or
// grep) or an mcp_tool_call (a graph_* tool); "graph" counts only the latter.
//
// Each sample also captures the agent's final answer text (the last
// agent_message) for manual inspection. The benchmark itself measures runtime
// behavior only: tokens, tool calls, and wall time.
//
// Spends real codex credits; non-deterministic; not wired into CI. Requires
// `codex` (logged in) and `go` on PATH, and a built `@ttsc/graph` (packages/graph/lib).
//
// Usage:
//   node experimental/benchmark/graph/agent-ab-codex.mjs --prompt-family=dedicated --repo=excalidraw --runs=4
//   node experimental/benchmark/graph/agent-ab-codex.mjs --prompt-family=common --repo=vscode --runs=4
//   node experimental/benchmark/graph/agent-ab-codex.mjs --prompt-id=typeorm-dedicated-v1 --runs=4
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

// The manifest (questions/manifest.json) selects reusable prompt files. The
// benchmark records runtime metrics only: tokens, tools, and time.
function loadManifest() {
  const manifestPath = path.join(here, "questions", "manifest.json");
  if (!fs.existsSync(manifestPath)) return { prompts: [] };
  return JSON.parse(fs.readFileSync(manifestPath, "utf8"));
}

// Resolve a manifest prompt by --prompt-id (exact), else the first prompt of a
// --prompt-family, scoped to --repo when given. Returns the prompt entry and its
// question text, or null when neither flag was passed.
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
// question and pins the repo, fixtureBranch, and tsconfig. Resolve it first so it
// can fill --repo when only --prompt-id is given.
const manifestPrompt = resolveManifestPrompt(args);
const repoKey = args.repo ?? manifestPrompt?.entry.repo ?? "excalidraw";
const spec = REPOS[repoKey];
if (!spec)
  throw new Error(
    `unknown --repo ${repoKey}; choose ${Object.keys(REPOS).join(" | ")}`,
  );
const runs = Number(args.runs ?? 2);
const model = args.model ?? "gpt-5.4-mini";
const effort = "high";
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
// They use the same prompt and validity gates as @ttsc/graph.
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
const mcpStartupTimeoutSec = optionalNonNegativeInteger(
  args["mcp-startup-timeout-sec"] ?? process.env.CODEX_MCP_STARTUP_TIMEOUT_SEC,
  "--mcp-startup-timeout-sec",
);
const mcpToolTimeoutSec = optionalNonNegativeInteger(
  args["mcp-tool-timeout-sec"] ?? process.env.CODEX_MCP_TOOL_TIMEOUT_SEC,
  "--mcp-tool-timeout-sec",
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
// once to build the resident graph. The Go binary is dump-only now; the MCP server
// is the Node launcher.
const binary = path.join(
  os.tmpdir(),
  `ttscgraph-codex-${process.pid}${process.platform === "win32" ? ".exe" : ""}`,
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

// 3. The graph server is the Node launcher run over stdio; it shells out to the
// dump binary (pointed at via TTSC_GRAPH_BINARY) on the first tool call, then
// answers later tool calls from the resident graph. The launcher has no
// daemon/port mode — its single type-check stays inside the measured cell — so
// there is no --daemon path.
const launcherArgs = [graphLauncher, "--cwd", repoDir, "--tsconfig", tsconfig];

// 4. Two minimal CODEX_HOMEs: identical except the graph one configures the MCP
// server. Both copy the real auth.json so codex stays logged in.
const realHome = path.join(os.homedir(), ".codex");
const withHome = armsRequested.graph
  ? makeCodexHome("with", cg || cbm || serena ? [] : launcherArgs)
  : null;
const withoutHome = armsRequested.baseline
  ? makeCodexHome("without", null)
  : null;
const arms = [
  { name: "baseline", home: withoutHome },
  { name: "graph", home: withHome },
].filter((a) => a.home);

console.log(
  `\ncodegraph A/B on ${repoKey} via codex — model ${model} (effort ${effort}), ${runs} run(s) x ${arms.length} arms` +
    (promptId ? `, prompt ${promptId}` : "") +
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
fs.rmSync(reportPath, { force: true });
fs.rmSync(traceDir, { recursive: true, force: true });
fs.mkdirSync(traceDir, { recursive: true });

const MAX_RUN_RETRIES = parseNonNegativeInteger(
  args["max-run-retries"] ?? "4",
  "--max-run-retries",
);
const samples = Object.fromEntries(arms.map((a) => [a.name, []]));
// Launch arms x runs concurrently, capped at TTSC_BENCH_CONCURRENCY (default
// unlimited). A high cap is fastest for experiment iteration; a low cap keeps the
// host quiet enough that per-run timings and token counts settle. Each invocation
// is its own codex process with its own CODEX_HOME and trace file.
const concurrency = Number(process.env.TTSC_BENCH_CONCURRENCY) || Infinity;
const thunks = arms.flatMap((arm) =>
  Array.from({ length: runs }, (_, r) => async () => {
    // Validity is token-based only: a run that spent tokens is a real measurement
    // and is kept, even if its MCP calls failed or it never produced a clean
    // answer. Those are quality concerns judged out of band, not reasons to
    // re-spend the budget. Only a zero-token run (rate limit / capacity failure /
    // an incomplete turn that never reached the model) is invalid: it carries no
    // usable sample, so retry it in place rather than letting it thin the median.
    // The trace file is keyed by run number, so a retry overwrites the attempt.
    let m;
    let attempts = 0;
    for (let attempt = 0; attempt <= MAX_RUN_RETRIES; attempt++) {
      attempts = attempt + 1;
      m = validateArmSample(
        await runCodex(
          promptForArm(question, arm.name),
          arm.home,
          arm.name,
          r + 1,
        ),
        arm.name,
      );
      if (Number(m?.tokens ?? 0) > 0 && m?.ok !== false) break;
      if (attempt < MAX_RUN_RETRIES)
        console.log(
          `  ${arm.name.padEnd(8)} run ${r + 1}: [FAILED]${m.error ? ` ${m.error}` : ""} retrying (${attempt + 1}/${MAX_RUN_RETRIES})`,
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
    console.log(
      `  ${arm.name.padEnd(8)} run ${r + 1}: ${m.tokens} tok` +
        (m.reasoning ? ` (+${m.reasoning} reasoning)` : "") +
        `, ${m.tools} tools ` +
        `(shell ${m.shell}, source ${m.sourceTouches ?? 0}, graph ${m.graph}, web ${m.web ?? 0}), ${(m.durMs / 1000).toFixed(0)}s` +
        (m.ok ? "" : `  [FAILED${m.error ? `: ${m.error}` : ""}]`),
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

console.log(`\nMedian of ${runs} run(s), codegraph metrics, codex/${model}:`);
const printLine =
  armsRequested.baseline && armsRequested.graph
    ? printComparisonLine
    : armsRequested.baseline
      ? printBaselineLine
      : printGraphLine;
printLine("tokens", "tokens");
printLine("tool calls", "tools");
printLine("wall time", "durMs", (x) => `${(x / 1000).toFixed(0)}s`);

fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(
  reportPath,
  `${JSON.stringify({ tool: graphToolName(), ...(toolSetupMs !== undefined ? { toolSetupMs } : {}), repo: repoKey, fixtureBranch, repoDir, model, effort, ...(promptId ? { promptId } : {}), promptFamily, ...(manifestPrompt?.questionSha256 ? { questionSha256: manifestPrompt.questionSha256 } : {}), daemon: false, runs, question, traceDir, samples }, null, 2)}\n`,
);
cleanup([binary, withHome, withoutHome].filter(Boolean));

// makeCodexHome builds a throwaway CODEX_HOME: the real auth.json plus a minimal
// config.toml pinning the model and effort, and (for the graph arm) the
// @ttsc/graph MCP server. The server is `node <launcher> --cwd ... --tsconfig ...`
// with TTSC_GRAPH_BINARY pointing at the dump binary, so codex spawns the same
// launcher the Claude harness configures. TOML literal strings ('...') carry
// Windows paths verbatim with no escaping.
function makeCodexHome(tag, serverArgs) {
  const home = path.join(os.tmpdir(), `codex-home-${tag}-${process.pid}`);
  fs.mkdirSync(home, { recursive: true });
  fs.copyFileSync(
    path.join(realHome, "auth.json"),
    path.join(home, "auth.json"),
  );
  let toml = `model = '${model}'\nmodel_reasoning_effort = '${effort}'\nweb_search = 'disabled'\n`;
  if (serverArgs) {
    if (cg) {
      const command = process.platform === "win32" ? "cmd.exe" : "codegraph";
      const a = codegraphServerArgs(repoDir)
        .map((x) => `'${x}'`)
        .join(", ");
      toml += `\n[mcp_servers.codegraph]\ncommand = '${command}'\nargs = [${a}]\nenv = { CODEGRAPH_NO_DAEMON = "1" }\nrequired = true\n${mcpTimeoutConfigToml()}`;
    } else if (cbm) {
      const envParts = [`CBM_LOG_LEVEL = "warn"`];
      if (cbmCacheDir) envParts.unshift(`CBM_CACHE_DIR = '${cbmCacheDir}'`);
      toml += `\n[mcp_servers.codebase_memory]\ncommand = '${cbmCommand}'\nargs = []\nenv = { ${envParts.join(", ")} }\nrequired = true\n${mcpTimeoutConfigToml()}`;
    } else if (serena) {
      const argList = serenaServerArgs(repoDir)
        .map((a) => `'${a}'`)
        .join(", ");
      toml += `\n[mcp_servers.serena]\ncommand = '${serenaCommand}'\nargs = [${argList}]\nrequired = true\n${mcpTimeoutConfigToml()}`;
    } else {
      const argList = serverArgs.map((a) => `'${a}'`).join(", ");
      toml += `\n[mcp_servers.ttscgraph]\ncommand = '${process.execPath}'\nargs = [${argList}]\nenv = { TTSC_GRAPH_BINARY = '${binary}' }\nrequired = true\n${mcpTimeoutConfigToml()}`;
    }
  }
  validateMcpConfig(toml);
  fs.writeFileSync(path.join(home, "config.toml"), toml);
  return home;
}

function validateMcpConfig(toml) {
  if ((cg || cbm || serena) && toml.includes("[mcp_servers.ttscgraph]")) {
    throw new Error("comparator Codex config must not include @ttsc/graph");
  }
  if (cg && !toml.includes("[mcp_servers.codegraph]")) {
    throw new Error("codegraph Codex config did not include codegraph");
  }
  if (cbm && !toml.includes("[mcp_servers.codebase_memory]")) {
    throw new Error(
      "codebase-memory Codex config did not include codebase-memory",
    );
  }
  if (serena && !toml.includes("[mcp_servers.serena]")) {
    throw new Error("Serena Codex config did not include Serena");
  }
}

function graphToolName() {
  if (cg) return "codegraph";
  if (cbm) return "codebase-memory";
  if (serena) return "serena";
  return "ttsc-graph";
}

function commandPath(command) {
  return path.isAbsolute(command) || /[\\/]/.test(command)
    ? path.resolve(command)
    : command;
}

function mcpTimeoutConfigToml() {
  return [
    mcpStartupTimeoutSec === undefined
      ? null
      : `startup_timeout_sec = ${mcpStartupTimeoutSec}`,
    mcpToolTimeoutSec === undefined
      ? null
      : `tool_timeout_sec = ${mcpToolTimeoutSec}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function codegraphServerArgs(targetRepoDir) {
  const args = ["serve", "--mcp", "--path", targetRepoDir];
  return process.platform === "win32"
    ? ["/d", "/s", "/c", "codegraph", ...args]
    : args;
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
    "codex",
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

function promptForArm(baseQuestion, armName) {
  // The baseline arm is sent to the code, because memory of a famous repository
  // is not a baseline (see GROUNDING). An arm whose facts come from this
  // checkout's compiler needs no such warning.
  if (armName === "baseline") return `${baseQuestion}\n\n${GROUNDING}`;
  // Every tool arm — this one's graph, codegraph, serena, codebase-memory — gets
  // the same line, and the baseline gets none, because it has no tools to be told
  // about.
  //
  // A model that never opens the tool list cannot be judged on its tools. Asked
  // to tour NestJS with no line, gpt-5.6 spent eleven shell commands and 502k
  // tokens and never mentioned the MCP; with the line it called the graph twice
  // and spent 75k. The tools were mounted and visible in both runs — it simply
  // never went looking, and a benchmark that says nothing measures that instead
  // of the tool.
  //
  // It names no tool and forces nothing.
  return `${baseQuestion}\n\n${TOOL_NUDGE}`;
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

function optionalNonNegativeInteger(value, label) {
  if (value === undefined || value === null || value === "") return undefined;
  return parseNonNegativeInteger(value, label);
}

function sourceInspectionCommand(command) {
  return (
    /\b(git\s+grep|rg|grep|Select-String|findstr)\b/i.test(command) ||
    /\b(Get-Content|gc|cat|type|sed|awk|head|tail)\b/i.test(command) ||
    (/\b(git\s+ls-files|Get-ChildItem|gci|ls|dir)\b/i.test(command) &&
      /\b(src|packages|apps|lib|server|client|test|\.tsx?|\.jsx?)\b/i.test(
        command,
      ))
  );
}

async function runCodex(question, codexHome, armName, runNumber) {
  const start = Date.now();
  const result = await spawnAsync(
    "codex",
    [
      "exec",
      "--json",
      "-c",
      "web_search=disabled",
      "--disable",
      "browser_use",
      "--disable",
      "browser_use_external",
      "--dangerously-bypass-approvals-and-sandbox",
      "--skip-git-repo-check",
      "--ephemeral",
      "--strict-config",
      "-C",
      repoDir,
    ],
    {
      input: question,
      windowsHide: true,
      shell: true,
      env: { ...process.env, CODEX_HOME: codexHome },
    },
  );
  if (result.error) throw result.error;
  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";
  const base = `${armName}-run-${runNumber}`;
  fs.writeFileSync(path.join(traceDir, `${base}.stream.jsonl`), stdout);
  if (stderr)
    fs.writeFileSync(path.join(traceDir, `${base}.stderr.log`), stderr);
  const parsed = parseStream(stdout, Date.now() - start);
  if (result.status && result.status !== 0) {
    parsed.ok = false;
    parsed.error = `codex exited ${result.status}${stderr ? `: ${oneLine(stderr).slice(0, 160)}` : ""}`;
  } else if (!parsed.ok && stderr && !parsed.error) {
    parsed.error = oneLine(stderr).slice(0, 160);
  }
  return parsed;
}

// spawnAsync runs a child to completion and resolves its captured stdout/stderr,
// so many runs can be in flight at once via Promise.all instead of blocking the
// loop the way spawnSync would.
function spawnAsync(command, commandArgs, { input, ...spawnOpts }) {
  return new Promise((resolve) => {
    const child = cp.spawn(command, commandArgs, spawnOpts);
    let stdout = "";
    let stderr = "";
    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (d) => (stdout += d));
    child.stderr?.on("data", (d) => (stderr += d));
    child.on("error", (error) => resolve({ error, stdout, stderr }));
    child.on("close", (status, signal) =>
      resolve({ stdout, stderr, status, signal }),
    );
    if (input) {
      child.stdin?.write(input);
      child.stdin?.end();
    }
  });
}

// parseStream sums per-turn usage (input + output) across turn.completed events,
// and counts tool calls from item.completed events: command_execution (shell
// reads/greps) and mcp_tool_call (graph). It records the item-type histogram so
// the classification can be verified against a real run. It also captures the
// agent's final answer: the text of the LAST agent_message item.
function parseStream(text, durMs) {
  let tokens = 0,
    cached = 0,
    reasoning = 0,
    turns = 0,
    tools = 0,
    shell = 0,
    graph = 0,
    web = 0,
    sourceTouches = 0,
    completed = false,
    answered = false,
    answer = "";
  const usage = [];
  const types = {};
  const shellCommands = [];
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
      const turn = {
        input: u.input_tokens || 0,
        cachedInput: u.cached_input_tokens || 0,
        output: u.output_tokens || 0,
        reasoning: u.reasoning_output_tokens || 0,
      };
      tokens += turn.input + turn.output;
      cached += turn.cachedInput;
      reasoning += turn.reasoning;
      usage.push(turn);
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
        const command = it.command ?? "";
        shellCommands.push(command);
        if (sourceInspectionCommand(command)) sourceTouches++;
      } else if (t === "web_search") {
        tools++;
        web++;
      } else if (t === "agent_message") {
        answered = true;
        // codex emits intermediate agent_message items; the last one carrying
        // text is the final answer, so overwrite as they arrive.
        if (typeof it.text === "string" && it.text.trim()) answer = it.text;
      }
    }
  }
  return {
    tokens,
    cached,
    reasoning,
    tokensWithReasoning: tokens + reasoning,
    turns,
    usage,
    tools,
    shell,
    graph,
    web,
    sourceTouches,
    shellCommands: shellCommands.slice(-20),
    types,
    durMs,
    ok: completed && answered,
    answer,
    error: completed
      ? answered
        ? ""
        : "codex completed without an agent answer"
      : "codex turn did not complete",
  };
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

function oneLine(value) {
  return String(value).replace(/\s+/g, " ").trim();
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
