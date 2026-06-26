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
// and serves graph_index / graph_overview / graph_query / graph_trace /
// graph_expand over stdio.
// All tool guidance comes from the server's MCP initialize/tool descriptions; the
// user prompt is the manifest question verbatim, tool-neutral, so the token
// comparison stays honest. No graph-specific instruction is appended.
//
// Each sample also captures the agent's final answer text and, after the run,
// grades it against the prompt's gold via grade.mjs, so a token saving is never
// reported as a win while the answer is wrong (quality.pass === false).
//
// Spends real Claude credits; non-deterministic; not wired into CI. Requires
// `claude` and `go` on PATH, and a built `@ttsc/graph` (packages/graph/lib).
//
// Usage:
//   node experimental/benchmark/agent-ab.mjs --repo=excalidraw --runs=2
//   node experimental/benchmark/agent-ab.mjs --repo=vscode --runs=4 --model=opus
//   node experimental/benchmark/agent-ab.mjs --prompt-id=typeorm-overview-v1 --runs=2
//   node experimental/benchmark/agent-ab.mjs --repo=typeorm --repo-dir=experimental/benchmark/.work/ttsc-benchmark-typeorm@ttsc
import cp from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { gradeAnswer, questionSha256 } from "./grade.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");
const ttscDir = path.join(repoRoot, "packages", "ttsc");
const graphLauncher = path.join(repoRoot, "packages", "graph", "lib", "bin.js");
// The question per repo, in codegraph's agent-eval style: a specific "how does
// this concrete mechanism work" trace that names a real public API. A narrow,
// mechanism-level question is what makes the comparison bite: a reader must dig
// deep through the layers to answer it, while one targeted graph query pins the
// cluster. resolveQuestion prefers an explicit --prompt-id (manifest-driven),
// then an explicit override, then a per-repo file (questions/<repo>.md), then the
// generic fallback.
const ARCHITECTURE_QUESTION = fs
  .readFileSync(
    path.join(here, "questions", "architecture-callpath.md"),
    "utf8",
  )
  .trim();

// The manifest (questions/manifest.json) is the source of truth for graded
// prompts: each entry pins a question .md, a gold .json, and the question's
// SHA-256. resolveManifestPrompt loads it on demand so a plain --repo run that
// does not use a manifest prompt still works with no manifest present.
function loadManifest() {
  const manifestPath = path.join(here, "questions", "manifest.json");
  if (!fs.existsSync(manifestPath)) return { prompts: [] };
  return JSON.parse(fs.readFileSync(manifestPath, "utf8"));
}

// Resolve a manifest prompt by --prompt-id (exact), else the first prompt of a
// --prompt-family, scoped to --repo when given. Returns the prompt entry plus the
// loaded question text, the integrity-verified questionSha256, and the goldSha256,
// or null when neither flag was passed.
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
  const goldFile = path.resolve(here, "questions", entry.gold);
  const text = fs.readFileSync(questionFile, "utf8").trim();
  const actualSha = questionSha256(questionFile);
  if (entry.questionSha256 && entry.questionSha256 !== actualSha) {
    console.warn(
      `warning: ${entry.id} question sha mismatch (manifest ${entry.questionSha256.slice(0, 12)} != file ${actualSha.slice(0, 12)})`,
    );
  }
  return {
    entry,
    text,
    questionSha256: actualSha,
    goldSha256: questionSha256(goldFile),
    gold: JSON.parse(fs.readFileSync(goldFile, "utf8")),
  };
}

function resolveQuestion(repoKey) {
  if (process.env.TTSC_BENCH_QUESTION_FILE)
    return fs.readFileSync(process.env.TTSC_BENCH_QUESTION_FILE, "utf8").trim();
  const perRepo = path.join(here, "questions", `${repoKey}.md`);
  if (fs.existsSync(perRepo)) return fs.readFileSync(perRepo, "utf8").trim();
  return ARCHITECTURE_QUESTION;
}

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
    tsconfig: "tsconfig.json",
    question: ARCHITECTURE_QUESTION,
  },
  vue: {
    url: "https://github.com/vuejs/core",
    fixtureUrl: "https://github.com/samchon/ttsc-benchmark-vue.git",
    tsconfig: "tsconfig.json",
    question: ARCHITECTURE_QUESTION,
  },
  zod: {
    url: "https://github.com/colinhacks/zod",
    fixtureUrl: "https://github.com/samchon/ttsc-benchmark-zod.git",
    tsconfig: "tsconfig.json",
    question: ARCHITECTURE_QUESTION,
  },
  typeorm: {
    url: "https://github.com/typeorm/typeorm",
    fixtureUrl: "https://github.com/samchon/ttsc-benchmark-typeorm.git",
    tsconfig: "tsconfig.json",
    question: ARCHITECTURE_QUESTION,
  },
  rxjs: {
    url: "https://github.com/ReactiveX/rxjs",
    fixtureUrl: "https://github.com/samchon/ttsc-benchmark-rxjs.git",
    tsconfig: "tsconfig.json",
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
// A manifest prompt (--prompt-id / --prompt-family) overrides the per-repo
// question and pins the repo, fixtureBranch, tsconfig, and the gold to grade
// against. Resolve it first so it can fill --repo when only --prompt-id is given.
const manifestPrompt = resolveManifestPrompt(args);
const repoKey = args.repo ?? manifestPrompt?.entry.repo ?? "excalidraw";
const spec = REPOS[repoKey];
if (!spec)
  throw new Error(
    `unknown --repo ${repoKey}; choose ${Object.keys(REPOS).join(" | ")}`,
  );
const runs = Number(args.runs ?? 2);
const model = args.model ?? "sonnet";
const tsconfig =
  args.tsconfig ?? manifestPrompt?.entry.tsconfig ?? spec.tsconfig;
const question =
  args.question ?? manifestPrompt?.text ?? resolveQuestion(repoKey);
const promptId = manifestPrompt?.entry.id;
const promptFamily =
  manifestPrompt?.entry.family ??
  args["prompt-family"] ??
  (args.question ? "custom" : "project-specific");
// The gold + integrity stamps travel with the report so grading is reproducible
// from the report alone (also used to grade each sample in-process after capture).
const gold = manifestPrompt?.gold ?? null;
const goldThreshold = Number(args.threshold ?? 0.8);
if (!question) throw new Error(`repo ${repoKey} has no benchmark question`);

const fixtureBranch =
  args["fixture-branch"] ?? manifestPrompt?.entry.fixtureBranch;
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
// --cg points the "graph" arm at codegraph (colbymchenry/codegraph) instead of
// @ttsc/graph, so the exact same A/B can be run against the tool we ported, for an
// apples-to-apples comparison. The repo must already be indexed (`codegraph init`).
const cg = args.cg === "1" || args.cg === "true";

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
if (!cg) {
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
if (!cg && !fs.existsSync(path.join(repoDir, tsconfig))) {
  throw new Error(`missing tsconfig: ${path.join(repoDir, tsconfig)}`);
}
if (!cg) ensureInstalled(repoDir);

// 3. WITH = @ttsc/graph; WITHOUT = empty config. Both --strict-mcp-config. The
// graph server is the Node launcher run over stdio; it shells out to the dump
// binary (pointed at via TTSC_GRAPH_BINARY) once at startup, then answers tool
// calls from the resident graph. The launcher has no daemon/port mode; its
// single type-check stays inside the measured cell, so there is no --daemon path.
const withCfg = path.join(os.tmpdir(), `mcp-graph-${process.pid}.json`);
const emptyCfg = path.join(os.tmpdir(), `mcp-empty-${process.pid}.json`);
const serverCfg = cg
  ? { codegraph: codegraphServerConfig(repoDir) }
  : {
      "ttsc-graph": {
        command: process.execPath,
        args: [graphLauncher, "--cwd", repoDir, "--tsconfig", tsconfig],
        env: { TTSC_GRAPH_BINARY: binary },
      },
    };
fs.writeFileSync(withCfg, JSON.stringify({ mcpServers: serverCfg }));
fs.writeFileSync(emptyCfg, JSON.stringify({ mcpServers: {} }));

// --arm selects which arms to run: `baseline` and `graph` can be measured
// separately so a fixed n=5 baseline is cached once and every later iteration
// runs only the graph arm against it. Default `both` is the original behavior.
const armFilter = args.arm ?? "both";
const arms = [
  { name: "baseline", cfg: emptyCfg },
  { name: "graph", cfg: withCfg },
].filter((a) => armFilter === "both" || a.name === armFilter);
if (arms.length === 0)
  throw new Error(`--arm must be baseline | graph | both, got ${armFilter}`);

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
fs.mkdirSync(traceDir, { recursive: true });

const samples = Object.fromEntries(arms.map((a) => [a.name, []]));
let spent = 0;
const MAX_RUN_RETRIES = 4;
// Launch arms x runs concurrently, capped at TTSC_BENCH_CONCURRENCY (default
// unlimited). A high cap is fastest for experiment iteration; a low cap (a handful)
// keeps the host quiet enough that per-run timings and token counts settle, which
// matters when comparing close conditions. Each invocation is its own process with
// its own MCP server and trace file, so they never share state.
const concurrency = Number(process.env.TTSC_BENCH_CONCURRENCY) || Infinity;
const thunks = arms.flatMap((arm) =>
  Array.from({ length: runs }, (_, r) => async () => {
    // A failed run (a 529 overload, mostly) carries no usable sample, so retry it
    // in place rather than letting it thin the median. The trace file is keyed by
    // run number, so a successful retry overwrites the failed attempt.
    let m;
    for (let attempt = 0; attempt <= MAX_RUN_RETRIES; attempt++) {
      m = await runClaude(question, arm.cfg, arm.name, r + 1);
      if (m.ok) break;
      if (attempt < MAX_RUN_RETRIES)
        console.log(
          `  ${arm.name.padEnd(8)} run ${r + 1}: [FAILED] ${m.error || ""} retrying (${attempt + 1}/${MAX_RUN_RETRIES})`,
        );
    }
    // Tag the sample with the manifest provenance and, when a gold is in play,
    // grade the captured answer so a token win is never reported while the answer
    // is wrong. quality is null for an unrated run or one that did not finish.
    if (promptId) m.promptId = promptId;
    if (manifestPrompt) {
      m.questionSha256 = manifestPrompt.questionSha256;
      m.goldSha256 = manifestPrompt.goldSha256;
    }
    // Grade in a guard: a malformed gold must never crash a whole run of real
    // agent calls. A grading failure degrades to an ungraded sample, not a lost
    // benchmark (the traces are already on disk and can be re-graded).
    try {
      m.quality =
        gold && m.ok ? gradeAnswer(m.answer ?? "", gold, goldThreshold) : null;
    } catch (error) {
      console.warn(
        `  grade failed for ${arm.name} run ${r + 1}: ${error instanceof Error ? error.message : String(error)}`,
      );
      m.quality = null;
    }
    samples[arm.name].push(m);
    spent += m.cost;
    console.log(
      `  ${arm.name.padEnd(8)} run ${r + 1}: $${m.cost.toFixed(3)}, ${m.tokens} tok, ${m.tools} tools ` +
        `(read ${m.reads}, grep ${m.grep}, graph ${m.graph}), ${(m.durMs / 1000).toFixed(0)}s` +
        (m.quality ? `, ${m.quality.pass ? "PASS" : "FAIL"}` : "") +
        (m.ok ? "" : "  [FAILED]") +
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
  median((samples[arm] ?? []).filter((m) => m.ok).map((m) => m[k]));
const pct = (g, b) => (b === 0 ? 0 : Math.round((1 - g / b) * 100));
const line = (label, k, fmt = (x) => x) => {
  const b = med("baseline", k);
  const s = `  ${label.padEnd(12)} baseline ${fmt(b)}  ->  graph ${fmt(med("graph", k))} (${pct(med("graph", k), b)}%)`;
  console.log(s);
};

console.log(
  `\nMedian of ${runs} run(s), vs empty-MCP baseline (codegraph metrics):`,
);
line("tokens", "tokens");
line("tool calls", "tools");
line("cost", "cost", (x) => `$${x.toFixed(3)}`);
line("wall time", "durMs", (x) => `${(x / 1000).toFixed(0)}s`);

// Quality gate: a token saving is only a real win if the graph arm still answers
// correctly. Report each arm's pass rate, and refuse to call the saving a win when
// the graph arm's answers fall below threshold.
if (gold) {
  const passRate = (arm) => {
    const graded = (samples[arm] ?? []).filter((m) => m.ok && m.quality);
    const passed = graded.filter((m) => m.quality.pass).length;
    return { passed, graded: graded.length };
  };
  const b = passRate("baseline");
  const g = passRate("graph");
  console.log(
    `\nQuality (threshold ${goldThreshold}): baseline ${b.passed}/${b.graded} pass  ->  graph ${g.passed}/${g.graded} pass`,
  );
  const tokenSaving = pct(med("graph", "tokens"), med("baseline", "tokens"));
  const graphPasses = g.graded > 0 && g.passed * 2 >= g.graded; // majority pass
  if (tokenSaving > 0 && !graphPasses) {
    console.log(
      `  NOTE: ${tokenSaving}% token saving NOT counted as a win: graph answers are below threshold.`,
    );
  }
}
console.log(`\nTotal spend this run: $${spent.toFixed(2)}`);

fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(
  reportPath,
  `${JSON.stringify({ tool: cg ? "codegraph" : "ttsc-graph", ...(toolSetupMs !== undefined ? { toolSetupMs } : {}), repo: repoKey, fixtureBranch, repoDir, model, ...(promptId ? { promptId } : {}), promptFamily, ...(manifestPrompt ? { questionSha256: manifestPrompt.questionSha256, goldSha256: manifestPrompt.goldSha256, gradeThreshold: goldThreshold } : {}), daemon: false, runs, question, traceDir, samples }, null, 2)}\n`,
);
try {
  fs.rmSync(binary, { force: true });
  fs.rmSync(withCfg, { force: true });
  fs.rmSync(emptyCfg, { force: true });
} catch {
  /* best effort */
}

async function runClaude(question, cfg, armName, runNumber) {
  // Prevent Claude's built-in Agent tool from turning an MCP benchmark into
  // subagent IO. Do not use --bare here: it disables OAuth/keychain auth.
  // No --append-system-prompt: tool guidance is tool-neutral now and comes from
  // the @ttsc/graph MCP initialize/tool descriptions, so both arms get the same
  // user prompt and the token comparison stays honest. armName only keys the
  // trace file; it no longer changes the prompt.
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
  const result = await spawnAsync("claude", claudeArgs, {
    cwd: repoDir,
    input: question,
    windowsHide: true,
    shell: true,
    timeout: 900_000,
  });
  if (result.error) throw result.error;
  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";
  const base = `${armName}-run-${runNumber}`;
  fs.writeFileSync(path.join(traceDir, `${base}.stream.jsonl`), stdout);
  if (stderr)
    fs.writeFileSync(path.join(traceDir, `${base}.stderr.log`), stderr);
  return parseStream(stdout);
}

// spawnAsync runs a child to completion and resolves its captured stdout/stderr,
// so many runs can be in flight at once via Promise.all. An async spawn never
// blocks the loop the way spawnSync would, which is what lets every arm and run
// fire concurrently.
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
    child.on("close", () => resolve({ stdout, stderr }));
    if (input) {
      child.stdin?.write(input);
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
        args: ["/d", "/s", "/c", command, ...args],
      }
    : { label: command, command, args };
}

function truthy(value) {
  return value === "1" || value === "true" || value === "yes";
}

// parseStream mirrors codegraph's parse-bench-readme.mjs: tokens are summed over
// every assistant turn's usage (not the last-turn result.usage), and tool calls
// are counted across assistant events (ToolSearch excluded). It also captures the
// agent's final answer text: the `result` event's `result` string is the canonical
// final answer; the concatenated text of the last assistant turn is the fallback
// for a stream that ends without a result event. The captured answer is what
// grade.mjs scores against the prompt's gold.
function parseStream(text) {
  let tokens = 0,
    tools = 0,
    reads = 0,
    grep = 0,
    graph = 0,
    other = 0,
    result = null,
    lastAssistantText = "";
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
      const textBlocks = [];
      for (const b of e.message?.content || []) {
        if (b.type === "text" && typeof b.text === "string") {
          textBlocks.push(b.text);
          continue;
        }
        if (b.type !== "tool_use") continue;
        if (b.name === "ToolSearch") continue;
        tools++;
        if (b.name === "Read") reads++;
        else if (b.name === "Grep" || b.name === "Glob") grep++;
        else if (/graph|ttsc/i.test(b.name)) graph++;
        else other++;
      }
      // Keep the last assistant turn that carried prose, so a trailing tool-only
      // turn does not blank the fallback answer.
      if (textBlocks.length) lastAssistantText = textBlocks.join("\n");
    } else if (e.type === "result") {
      result = e;
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
    graph,
    other,
    cost: result?.total_cost_usd || 0,
    durMs: result?.duration_ms || 0,
    // A 529-overloaded run still reports subtype "success" while carrying
    // is_error: true and zero token usage, so it must be excluded explicitly or
    // its empty sample drags the median down and the comparison goes garbage.
    ok,
    answer,
    error: result?.is_error ? String(result?.result || "").slice(0, 80) : "",
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
