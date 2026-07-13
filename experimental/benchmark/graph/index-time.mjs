#!/usr/bin/env node
/**
 * Cold index build-time benchmark for the graph tool axis: what _readiness_
 * costs before a tool can answer its first question, per (tool × fixture).
 *
 * The agent benchmark (`graph.mjs`) measures what a question costs once a tool
 * is ready; this runner measures the readiness itself. Per cell it deletes the
 * tool's index, runs its build step once, and takes wall time:
 *
 * - `ttsc-graph`: `ttscgraph dump --cwd <fixture> --tsconfig <tsconfig>` — the
 *   MCP launcher runs exactly this at startup, so the agent's first question
 *   waits on it. The dump is stateless, so every run is cold.
 * - `codegraph`: `codegraph init <fixture>` after removing `.codegraph/`.
 * - `codebase-memory`: `codebase-memory-mcp cli index_repository` into an
 *   isolated `CBM_CACHE_DIR` after removing `.codebase-memory/`.
 * - `serena`: `serena project create` (declining, on stdin, every language its
 *   interview detects — VS Code detects twenty-two, and an unanswered prompt
 *   aborts on EOF) and then `serena project index`, which is the step timed.
 *   serena's own docs recommend it for larger projects, and this harness had
 *   never run it: a benchmark that withholds a tool's prescribed setup measures
 *   the withholding.
 *
 * One run per cell, sequentially, on a QUIET host — never beside the agent
 * benchmark, whose parallel cells would corrupt every wall-clock number.
 * Results land under a top-level `index` key in
 * `website/public/benchmark/graph.json`, beside `structural` and `agent`, which
 * this runner must not disturb.
 */
import cp from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PROJECTS, projectDir, resolveWorkDir } from "./corpus.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../..");
const ttscDir = path.join(repoRoot, "packages", "ttsc");
const workDir = resolveWorkDir(repoRoot);
const websiteJson = path.join(
  repoRoot,
  "website",
  "public",
  "benchmark",
  "graph.json",
);

const TOOL_TTSC = "ttsc-graph";
const TOOL_CODEGRAPH = "codegraph";
const TOOL_CODEBASE_MEMORY = "codebase-memory";
const TOOL_SERENA = "serena";
const ALL_TOOLS = [
  TOOL_TTSC,
  TOOL_CODEGRAPH,
  TOOL_CODEBASE_MEMORY,
  TOOL_SERENA,
];

// `serena project create` interviews the operator about every language it
// detects, one prompt each, and VS Code detects twenty-two of them. Decline them
// all: the fixture is TypeScript, and an unanswered prompt aborts the command on
// EOF.
const SERENA_DECLINE_ALL = "n\n".repeat(80);

const parsed = parseArgs(process.argv.slice(2));
const selected = selectProjects(parsed);
const tools = selectTools(parsed.values.tools ?? parsed.values.tool ?? "all");
const outDir = path.resolve(
  parsed.values.out ?? path.join(workDir, "graph-index", timestamp()),
);
const reportPath = path.join(outDir, "report.json");

if (parsed.flags.has("--list")) {
  for (const project of Object.keys(PROJECTS)) {
    const spec = PROJECTS[project];
    process.stdout.write(
      `${project}: ${projectDir(workDir, spec)} (${spec.tsconfig})\n`,
    );
  }
  process.exit(0);
}

if (selected.length === 0) {
  throw new Error("index-time benchmark requires --project <name> or --all");
}

// Quiet-host gate, mirrored from performance.mjs: a cold build is one sample
// with no median to hide behind, so a noisy host corrupts the cell outright.
// Warns by default, aborts under TTSC_BENCH_REQUIRE_QUIET=1 (set it for every
// publication run), and is silenced by TTSC_BENCH_SKIP_LOAD_CHECK=1. Note
// os.loadavg() reports zeros on Windows, so the gate only bites on POSIX
// hosts; on Windows quietness stays the operator's responsibility.
if (process.env.TTSC_BENCH_SKIP_LOAD_CHECK !== "1") {
  const cpuCount = Math.max(os.cpus().length, 1);
  const load1 = os.loadavg()[0];
  const ratio = load1 / cpuCount;
  if (ratio > 0.5) {
    const msg =
      `host load is high (1-min loadavg ${load1.toFixed(2)} on ` +
      `${cpuCount} CPUs, ratio ${ratio.toFixed(2)}); a one-shot cold build ` +
      `may drift far from a quiet baseline. ` +
      `Set TTSC_BENCH_SKIP_LOAD_CHECK=1 to ignore.`;
    if (process.env.TTSC_BENCH_REQUIRE_QUIET === "1") {
      throw new Error(`index-time: ${msg}`);
    }
    process.stderr.write(`[index-time] warning: ${msg}\n`);
  }
}

fs.mkdirSync(outDir, { recursive: true });

if (!parsed.flags.has("--no-setup")) {
  ensureFixtures(selected);
}

// The dump binary is built once, untimed: compiling the Go tool is packaging
// cost paid when @ttsc/graph is installed, not readiness cost a project pays.
// What IS timed per fixture is the dump run the launcher performs at startup.
const dumpBinary = tools.includes(TOOL_TTSC) ? buildDumpBinary() : null;

const report = {
  date: new Date().toISOString(),
  outDir,
  tools,
  projects: selected,
  host: hostSpec(),
  scale: {},
  cells: [],
};

for (const project of selected) {
  const spec = PROJECTS[project];
  const repoDir = projectDir(workDir, spec);
  if (!fs.existsSync(repoDir))
    throw new Error(`missing graph benchmark clone: ${repoDir}`);
  if (!fs.existsSync(path.join(repoDir, spec.tsconfig)))
    throw new Error(
      `missing graph tsconfig: ${path.join(repoDir, spec.tsconfig)}`,
    );

  // Project scale, so a build time can be read against the work it had to do:
  // forty seconds on VS Code and one second on a small backend are the same
  // tool, not two. Tracked TypeScript/TSX sources (git ls-files) naturally
  // exclude node_modules, build output, and anything else the fixture
  // ignores; `.d.ts` is excluded because it is shipped output, not source.
  report.scale[project] = measureScale(project, repoDir);
  writeJson(reportPath, report);

  for (const tool of tools) {
    const cell = runIndexCell({ project, spec, repoDir, tool });
    report.cells.push(cell);
    writeJson(reportPath, report);
    printCellSummary(project, cell);
    publishWebsiteIndex(report);
  }
}

writeJson(reportPath, report);
process.stdout.write(
  `\nIndex-time benchmark report: ${path.relative(repoRoot, reportPath)}\n`,
);
if (!parsed.flags.has("--no-website")) {
  process.stdout.write(
    `Index-time benchmark website JSON: ${path.relative(repoRoot, websiteJson)}\n`,
  );
}

function runIndexCell({ project, spec, repoDir, tool }) {
  if (tool === TOOL_SERENA) {
    // serena does ship a build step -- `serena project index`, which its own
    // docs recommend for larger projects -- and the harness had never run it.
    // A benchmark that withholds a tool's prescribed setup measures the
    // withholding, so it is timed here like every other tool.
    //
    // `project create` comes first because `index` needs a project config, and
    // it interviews the operator about every language it detects (VS Code
    // detects twenty-two). Headless, that interview is an EOF and the command
    // aborts, so every optional language is declined on stdin. Only the index
    // itself is timed; the interview is setup, not work.
    ensureLocalIgnored(repoDir, ".serena/");
    cleanupInsideFixture(repoDir, ".serena");
    try {
      runChecked(...serenaCommand(["project", "create", repoDir]), {
        label: `serena project create ${project}`,
        logBase: path.join(outDir, `serena-create-${project}`),
        cwd: repoDir,
        input: SERENA_DECLINE_ALL,
      });
      const ms = timeChecked(...serenaCommand(["project", "index"]), {
        label: `serena project index ${project}`,
        logBase: path.join(outDir, `serena-index-${project}`),
        cwd: repoDir,
        input: SERENA_DECLINE_ALL,
      });
      return { project, tool, buildMs: ms };
    } finally {
      cleanupInsideFixture(repoDir, ".serena");
    }
  }
  if (tool === TOOL_TTSC) {
    const logStem = path.join(outDir, `ttsc-graph-index-${project}`);
    const ms = timeChecked(
      dumpBinary,
      ["dump", "--cwd", repoDir, "--tsconfig", spec.tsconfig],
      {
        label: `ttsc-graph dump ${project}`,
        logBase: logStem,
        // The dump JSON reaches hundreds of MB on vscode; the payload is the
        // wire benchmark's concern, not this one's, so stdout is discarded.
        discardStdout: true,
      },
    );
    return { project, tool, buildMs: ms };
  }
  if (tool === TOOL_CODEGRAPH) {
    ensureLocalIgnored(repoDir, ".codegraph/");
    cleanupInsideFixture(repoDir, ".codegraph");
    try {
      const ms = timeChecked(...codegraphCommand(["init", repoDir]), {
        label: `codegraph init ${project}`,
        logBase: path.join(outDir, `codegraph-index-${project}`),
      });
      return { project, tool, buildMs: ms };
    } finally {
      cleanupInsideFixture(repoDir, ".codegraph");
    }
  }
  if (tool === TOOL_CODEBASE_MEMORY) {
    ensureLocalIgnored(repoDir, ".codebase-memory/");
    cleanupInsideFixture(repoDir, ".codebase-memory");
    const cacheDir = path.join(
      outDir,
      "codebase-memory-cache",
      filenamePart(project),
    );
    fs.rmSync(cacheDir, { recursive: true, force: true });
    fs.mkdirSync(cacheDir, { recursive: true });
    try {
      const ms = timeChecked(
        ...codebaseMemoryCommand([
          "cli",
          "index_repository",
          JSON.stringify({
            repo_path: repoDir,
            // codebase-memory-mcp index mode: full (default) | moderate |
            // fast. `fast` is the only mode that can index large repos
            // (vscode) on a 64 GB host without the full mode's blowup.
            ...(process.env.TTSC_BENCH_CBM_MODE
              ? { mode: process.env.TTSC_BENCH_CBM_MODE }
              : {}),
          }),
        ]),
        {
          label: `codebase-memory index ${project}`,
          logBase: path.join(outDir, `codebase-memory-index-${project}`),
          env: {
            CBM_CACHE_DIR: cacheDir,
            CBM_LOG_LEVEL: process.env.CBM_LOG_LEVEL ?? "warn",
          },
        },
      );
      return {
        project,
        tool,
        buildMs: ms,
        ...(process.env.TTSC_BENCH_CBM_MODE
          ? { mode: process.env.TTSC_BENCH_CBM_MODE }
          : {}),
      };
    } finally {
      cleanupInsideFixture(repoDir, ".codebase-memory");
      fs.rmSync(cacheDir, { recursive: true, force: true });
    }
  }
  throw new Error(`unknown tool ${tool}`);
}

function buildDumpBinary() {
  const binary = path.join(
    outDir,
    `ttscgraph-index${process.platform === "win32" ? ".exe" : ""}`,
  );
  const goRoot = path.join(os.homedir(), "go-sdk", "go", "bin");
  process.stdout.write("[index-time] building ttscgraph dump binary\n");
  timeChecked("go", ["build", "-o", binary, "./cmd/ttscgraph"], {
    label: "go build ttscgraph",
    logBase: path.join(outDir, "go-build-ttscgraph"),
    cwd: ttscDir,
    env: fs.existsSync(goRoot)
      ? { PATH: `${goRoot}${path.delimiter}${process.env.PATH ?? ""}` }
      : {},
  });
  return binary;
}

function measureScale(project, repoDir) {
  const listed = cp.spawnSync(
    "git",
    ["-C", repoDir, "ls-files", "-z", "--", "*.ts", "*.tsx", "*.mts", "*.cts"],
    { encoding: "utf8", windowsHide: true, maxBuffer: 64 * 1024 * 1024 },
  );
  if (listed.error) throw listed.error;
  if (listed.status !== 0) {
    throw new Error(
      `git ls-files failed for ${project}: ${listed.stderr ?? ""}`,
    );
  }
  const files = (listed.stdout ?? "")
    .split("\0")
    .filter(Boolean)
    .filter((file) => !/\.d\.(ts|mts|cts)$/.test(file));
  let lines = 0;
  for (const file of files) {
    const text = fs.readFileSync(path.join(repoDir, file), "utf8");
    // Count lines the way `wc -l` does — newlines, plus one for an
    // unterminated final line — so the scale block is reproducible against
    // standard tooling.
    const newlines = (text.match(/\n/g) ?? []).length;
    lines += newlines + (text.length > 0 && !text.endsWith("\n") ? 1 : 0);
  }
  return { files: files.length, lines };
}

// The same host block shape performance.json publishes — a wall-clock number
// without the machine it ran on is not a measurement.
function hostSpec() {
  const cpus = os.cpus();
  let osName = `${os.type()} ${os.release()}`;
  try {
    const pretty = fs
      .readFileSync("/etc/os-release", "utf8")
      .match(/^PRETTY_NAME="?([^"\n]+)"?/m);
    if (pretty) osName = pretty[1];
  } catch {
    // Keep os.type/os.release fallback.
  }
  return {
    os: osName,
    kernel: os.release(),
    cpu: cpus[0]?.model?.trim() ?? "unknown",
    cores: cpus.length,
    ramGB: Math.round(os.totalmem() / 2 ** 30),
    node: process.version,
  };
}

function publishWebsiteIndex(currentReport) {
  if (parsed.flags.has("--no-website")) return;
  const prior = fs.existsSync(websiteJson) ? loadJson(websiteJson) : null;
  const keepPrior = !parsed.flags.has("--reset-index");
  const priorIndex = keepPrior ? (prior?.index ?? null) : null;
  const scale = { ...(priorIndex?.scale ?? {}), ...currentReport.scale };
  const cells = [...(priorIndex?.cells ?? [])];
  for (const cell of currentReport.cells) {
    const at = cells.findIndex(
      (old) => old.project === cell.project && old.tool === cell.tool,
    );
    if (at >= 0) cells[at] = cell;
    else cells.push(cell);
  }
  const out = {
    schemaVersion: prior?.schemaVersion ?? 1,
    generatedAt: new Date().toISOString(),
    structural: prior?.structural ?? null,
    agent: prior?.agent ?? { cells: [] },
    // One host panel per publication, like performance.json: merged cells are
    // only comparable when a full sweep re-measures them on one machine, so
    // the panel always names the machine of the latest write.
    index: { host: currentReport.host, scale, cells },
  };
  fs.mkdirSync(path.dirname(websiteJson), { recursive: true });
  fs.writeFileSync(websiteJson, `${JSON.stringify(out)}\n`);
}

function printCellSummary(project, cell) {
  if (cell.hasBuildStep === false) {
    process.stdout.write(
      `[index-time] ${project} ${cell.tool}: no build step\n`,
    );
    return;
  }
  process.stdout.write(
    `[index-time] ${project} ${cell.tool}: ${(cell.buildMs / 1000).toFixed(1)} s\n`,
  );
}

function timeChecked(command, args, options) {
  const start = process.hrtime.bigint();
  runChecked(command, args, options);
  return Number(process.hrtime.bigint() - start) / 1e6;
}

function runChecked(
  command,
  args,
  { label, logBase, cwd = repoRoot, env = {}, discardStdout = false, input },
) {
  process.stdout.write(`[index-time] ${label}\n`);
  const devNull = discardStdout ? fs.openSync(os.devNull, "w") : null;
  let result;
  try {
    result = cp.spawnSync(command, args, {
      cwd,
      encoding: "utf8",
      // A tool that interviews the operator (serena, on every language it
      // detects) would otherwise hit EOF and abort in a headless run.
      ...(input === undefined ? {} : { input }),
      env: { ...process.env, ...env },
      windowsHide: true,
      maxBuffer: 512 * 1024 * 1024,
      timeout: Number(process.env.TTSC_GRAPH_BENCH_TIMEOUT_MS ?? 1_800_000),
      ...(devNull !== null ? { stdio: ["ignore", devNull, "pipe"] } : {}),
    });
  } finally {
    if (devNull !== null) fs.closeSync(devNull);
  }
  fs.writeFileSync(`${logBase}.out.log`, result.stdout ?? "");
  fs.writeFileSync(`${logBase}.err.log`, result.stderr ?? "");
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `${label} failed (${result.status}); see ${path.relative(repoRoot, `${logBase}.err.log`)}`,
    );
  }
}

function codegraphCommand(args) {
  if (process.platform !== "win32") return ["codegraph", args];
  return ["cmd.exe", ["/d", "/s", "/c", "codegraph", ...args]];
}

// serena is launched the way the agent harness launches it: through uvx, from
// its git source, so the measured tool is the one the agent cells talked to.
function serenaCommand(args) {
  const binary =
    parsed.values["serena-command"] ?? process.env.SERENA_MCP_COMMAND ?? "uvx";
  const full = [
    "--from",
    parsed.values["serena-source"] ??
      process.env.SERENA_SOURCE ??
      "git+https://github.com/oraios/serena",
    "serena",
    ...args,
  ];
  if (process.platform !== "win32") return [binary, full];
  return ["cmd.exe", ["/d", "/s", "/c", binary, ...full]];
}

function codebaseMemoryCommand(args) {
  const binary =
    parsed.values["codebase-memory-binary"] ??
    parsed.values["cbm-binary"] ??
    process.env.CODEBASE_MEMORY_MCP_BINARY ??
    "codebase-memory-mcp";
  const resolved =
    path.isAbsolute(binary) || /[\\/]/.test(binary)
      ? path.resolve(binary)
      : binary;
  if (process.platform !== "win32") return [resolved, args];
  return ["cmd.exe", ["/d", "/s", "/c", resolved, ...args]];
}

function ensureLocalIgnored(repoDir, entry) {
  const exclude = path.join(repoDir, ".git", "info", "exclude");
  if (!fs.existsSync(exclude)) return;
  const text = fs.readFileSync(exclude, "utf8");
  if (new RegExp(`^${entry.replace(/[.\\/]/g, "\\$&")}$`, "m").test(text))
    return;
  fs.appendFileSync(
    exclude,
    `${text.endsWith("\n") ? "" : "\n"}# generated by graph benchmark\n${entry}\n`,
  );
}

function cleanupInsideFixture(repoDir, name) {
  const root = path.resolve(repoDir);
  const target = path.resolve(repoDir, name);
  const relative = path.relative(root, target);
  if (
    relative === "" ||
    relative.startsWith("..") ||
    path.isAbsolute(relative)
  ) {
    throw new Error(`refusing to remove path outside fixture: ${target}`);
  }
  fs.rmSync(target, { recursive: true, force: true });
}

function ensureFixtures(projects) {
  for (const project of projects) {
    const spec = PROJECTS[project];
    const repoDir = projectDir(workDir, spec);
    if (!fs.existsSync(repoDir)) {
      fs.mkdirSync(path.dirname(repoDir), { recursive: true });
      runChecked(
        "git",
        [
          "clone",
          "--depth",
          "1",
          "--branch",
          spec.sourceBranch,
          spec.sourceRepo,
          repoDir,
        ],
        {
          label: `clone graph fixture ${project}`,
          logBase: path.join(outDir, `setup-${project}-source`),
        },
      );
    } else {
      process.stdout.write(`[index-time] reusing fixture ${project}\n`);
    }
    // ttsc-graph resolves modules through node_modules; an uninstalled
    // fixture loads a different (smaller) program and times a different job.
    ensureInstalled(repoDir);
  }
}

function ensureInstalled(repoDir) {
  if (parsed.flags.has("--no-install")) return;
  if (fs.existsSync(path.join(repoDir, "node_modules"))) return;
  const plan = installPlan(repoDir);
  if (!plan) return;
  runChecked(plan.command, plan.args, {
    label: `install fixture dependencies (${plan.label})`,
    logBase: path.join(outDir, `setup-${path.basename(repoDir)}-install`),
    cwd: repoDir,
  });
}

function installPlan(repoDir) {
  if (fs.existsSync(path.join(repoDir, "pnpm-lock.yaml"))) {
    return packageCommand("pnpm", [
      "install",
      "--frozen-lockfile",
      "--ignore-scripts",
    ]);
  }
  if (fs.existsSync(path.join(repoDir, "package-lock.json"))) {
    return packageCommand("npm", ["ci", "--ignore-scripts"]);
  }
  if (fs.existsSync(path.join(repoDir, "yarn.lock"))) {
    return packageCommand("yarn", [
      "install",
      "--frozen-lockfile",
      "--ignore-scripts",
    ]);
  }
  if (fs.existsSync(path.join(repoDir, "package.json"))) {
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

function selectTools(value) {
  const names = splitList(value);
  const expanded = names.includes("all")
    ? ALL_TOOLS
    : names.map((name) =>
        name === "codebase-memory-mcp" ? TOOL_CODEBASE_MEMORY : name,
      );
  const allowed = new Set(ALL_TOOLS);
  if (expanded.length === 0)
    throw new Error(
      "--tools must contain ttsc-graph, codegraph, codebase-memory, serena, or all",
    );
  for (const name of expanded) {
    if (!allowed.has(name))
      throw new Error(
        "--tools must contain ttsc-graph, codegraph, codebase-memory, serena, or all",
      );
  }
  return [...new Set(expanded)];
}

function selectProjects({ flags, values, positional }) {
  const explicit = [...splitList(values.project ?? ""), ...positional];
  const names = flags.has("--all") ? Object.keys(PROJECTS) : explicit;
  for (const name of names) {
    if (!PROJECTS[name])
      throw new Error(
        `unknown project ${name}; choose ${Object.keys(PROJECTS).join(", ")}`,
      );
  }
  return [...new Set(names)];
}

function parseArgs(argv) {
  const values = {};
  const flags = new Set();
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--project") {
      values.project = appendCsv(values.project, argv[++i]);
    } else if (arg.startsWith("--project=")) {
      values.project = appendCsv(
        values.project,
        arg.slice("--project=".length),
      );
    } else if (arg.startsWith("--")) {
      const match = /^--([^=]+)=(.*)$/.exec(arg);
      if (match) values[match[1]] = match[2];
      else flags.add(arg);
    } else {
      positional.push(arg);
    }
  }
  return { values, flags, positional };
}

function appendCsv(left, right) {
  return [left, right].filter(Boolean).join(",");
}

function splitList(value) {
  return String(value)
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function filenamePart(value) {
  return String(value).replace(/[^a-zA-Z0-9._-]+/g, "_");
}

function loadJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function timestamp() {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\..+$/, "");
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}
