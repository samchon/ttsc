#!/usr/bin/env node
/**
 * One-shot AI token benchmark for @ttsc/graph, codegraph, codebase-memory, and
 * Serena on the graph benchmark fixtures.
 *
 * It stays separate from performance.mjs in every respect: it spends real
 * Claude/Codex credits, so it only runs when called explicitly, and it owns its
 * own fixtures — the `graph` branch of each benchmark repo, cloned into
 * `../graph-benchmark-work` beside this repo, installed from the fixture's own
 * lockfile. Two reasons the fixtures are not shared with the performance sweep:
 * a graph-only fixture edit would change what the tsc-vs-ttsc cells compile,
 * and a fixture under this repo hands the measured agent ttsc's own CLAUDE.md /
 * AGENTS.md through the parent-directory walk both CLIs do.
 *
 * Projects run sequentially: a large fixture such as VS Code already consumes
 * enough memory while its graph is built.
 */
import cp from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../..");
// Outside the repo on purpose: the measured agent's cwd is the fixture clone,
// and both CLIs walk the parent chain for CLAUDE.md / AGENTS.md, so a fixture
// under `experimental/benchmark/.work` loaded ttsc's own agent instructions into
// every cell — a vscode graph run was caught reading this repo's AGENTS.md
// instead of touring vscode.
const workDir =
  process.env.TTSC_GRAPH_BENCH_WORK ??
  path.resolve(repoRoot, "..", "graph-benchmark-work");
const websiteJson = path.join(
  repoRoot,
  "website",
  "public",
  "benchmark",
  "graph.json",
);
const graphHarnessDir = path.join(here, "graph");
const claudeHarness = path.join(graphHarnessDir, "agent-ab.mjs");
const codexHarness = path.join(graphHarnessDir, "agent-ab-codex.mjs");
const DEFAULT_PROMPT_FAMILIES = ["dedicated", "common"];
const TOOL_TTSC = "ttsc-graph";
const TOOL_CODEGRAPH = "codegraph";
const TOOL_CODEBASE_MEMORY = "codebase-memory";
const TOOL_SERENA = "serena";
const TOOL_BASELINE = "baseline";
const PUBLISHED_SAMPLE_KEYS = [
  "tokens",
  "cached",
  "reasoning",
  "tokensWithReasoning",
  "turns",
  "tools",
  "reads",
  "grep",
  "shell",
  "web",
  "graph",
  "other",
  "sourceTouches",
  "shellSource",
  "cost",
  "durMs",
  "run",
  "attempts",
];

// Each fixture is the `graph` branch of its benchmark repo, cloned and installed
// by this runner alone. The graph benchmark used to measure the `ttsc` branch the
// performance sweep compiles, which made the two fight over one tree: a
// graph-only edit — a tsconfig whose program includes the tests, so a tour can
// cite them — would have changed what the tsc-vs-ttsc cells compile. The `graph`
// branch carries those edits and nothing else; the folder an agent sees is the
// plain project name, because a `ttsc-benchmark-` cwd makes it hunt for harness
// code instead of touring the source.
const PROJECTS = {
  excalidraw: graphFixture("excalidraw", "ttsc-benchmark-excalidraw", {
    tsconfig: "tsconfig.json",
  }),
  vue: graphFixture("vue", "ttsc-benchmark-vue"),
  rxjs: graphFixture("rxjs", "ttsc-benchmark-rxjs"),
  typeorm: graphFixture("typeorm", "ttsc-benchmark-typeorm", {
    tsconfig: "tsconfig.json",
  }),
  zod: graphFixture("zod", "ttsc-benchmark-zod"),
  nestjs: graphFixture("nestjs", "ttsc-benchmark-nestjs"),
  vscode: graphFixture("vscode", "ttsc-benchmark-vscode", {
    tsconfig: "src/tsconfig.json",
  }),
  "shopping-backend": graphFixture("shopping-backend", "shopping-backend"),
};

function graphFixture(name, repo, { tsconfig = "tsconfig.graph.json" } = {}) {
  return {
    repoName: name,
    sourceRepo: `https://github.com/samchon/${repo}.git`,
    sourceBranch: "graph",
    tsconfig,
  };
}

const parsed = parseArgs(process.argv.slice(2));
// Every fixture is measured on its repo's `graph` branch; there is no branch
// axis here (the tsc-vs-ttsc sweep owns `legacy` / `ttsc` / `ttsc-lint`).
const branch = "graph";

const selected = selectProjects(parsed);
const arm = selectArm(parsed.values.arm ?? "both");
const models = splitList(
  parsed.values.models ?? parsed.values.model ?? "gpt-5.4-mini",
);
const tools = selectTools(
  parsed.values.tools ??
    parsed.values.tool ??
    (arm === "baseline" ? "baseline" : "ttsc-graph,codegraph,codebase-memory"),
  arm,
);
const promptFamilies = selectPromptFamilies(
  parsed.values["prompt-family"] ??
    parsed.values["prompt-families"] ??
    "dedicated",
);
const runs = parsed.values.runs ?? "1";
const maxRunRetries = parseNonNegativeInteger(
  parsed.values["max-run-retries"] ?? "4",
  "--max-run-retries",
);
const daemon = parsed.values.daemon ?? "0";
const effort = "high";
const codexModel = parsed.values["codex-model"] ?? "gpt-5.4-mini";
const outDir = path.resolve(
  parsed.values.out ??
    process.env.TTSC_GRAPH_BENCH_OUT ??
    path.join(workDir, "graph", timestamp()),
);
const reportPath = path.join(outDir, "report.json");
let resetWebsite = parsed.flags.has("--reset");

if (parsed.flags.has("--list")) {
  for (const project of Object.keys(PROJECTS)) {
    const spec = PROJECTS[project];
    process.stdout.write(
      `${project}: ${projectDir(spec)} (${spec.tsconfig})\n`,
    );
  }
  process.exit(0);
}

if (selected.length === 0) {
  throw new Error("graph benchmark requires --project <name> or --all");
}

fs.mkdirSync(outDir, { recursive: true });

if (!parsed.flags.has("--no-setup")) {
  ensureFixtures(selected);
}

if (parsed.flags.has("--setup-only")) {
  process.stdout.write(`Graph benchmark setup complete in ${workDir}\n`);
  process.exit(0);
}

const report = {
  date: new Date().toISOString(),
  branch,
  arm,
  tools,
  promptFamilies,
  runs: Number(runs),
  maxRunRetries,
  daemon: daemon === "1" || daemon === "true",
  outDir,
  cells: [],
};

for (const project of selected) {
  const spec = PROJECTS[project];
  const branchLabel = spec.sourceBranch;
  const repoDir = projectDir(spec);
  if (!fs.existsSync(repoDir))
    throw new Error(`missing graph benchmark clone: ${repoDir}`);
  if (!fs.existsSync(path.join(repoDir, spec.tsconfig)))
    throw new Error(
      `missing graph tsconfig: ${path.join(repoDir, spec.tsconfig)}`,
    );

  for (const tool of tools) {
    let toolSetupMs = null;
    let codebaseMemoryCacheDir = null;
    try {
      if (arm !== "baseline") {
        if (tool === TOOL_CODEGRAPH) {
          toolSetupMs = ensureCodegraphIndex(project, repoDir);
        } else if (tool === TOOL_CODEBASE_MEMORY) {
          const setup = ensureCodebaseMemoryIndex(project, repoDir);
          toolSetupMs = setup?.ms ?? null;
          codebaseMemoryCacheDir = setup?.cacheDir ?? null;
        } else if (tool === TOOL_SERENA) {
          ensureSerenaIgnored(repoDir);
        }
      }

      for (const promptFamily of promptFamilies) {
        for (const model of models) {
          const { cell, websiteCell } = runAgentCell({
            project,
            spec,
            repoDir,
            tool,
            toolSetupMs,
            codebaseMemoryCacheDir,
            model,
            branch: branchLabel,
            promptFamily,
            arm,
            runs,
            daemon,
            effort,
            codexModel,
            outDir,
          });
          report.cells.push(cell);
          writeJson(reportPath, report);
          refreshCodexTraceAudit(cell, reportPath, report);
          printCellSummary(cell);
          const invalidReason = invalidWebsiteCellReason(websiteCell);
          if (invalidReason !== null) {
            throw new Error(`${project} ${tool} ${model}: ${invalidReason}`);
          }
          publishWebsiteCells([websiteCell]);
        }
      }
    } finally {
      if (tool === TOOL_CODEGRAPH) cleanupCodegraphIndex(repoDir);
      if (tool === TOOL_CODEBASE_MEMORY)
        cleanupCodebaseMemoryIndex(repoDir, codebaseMemoryCacheDir);
      if (tool === TOOL_SERENA) cleanupSerenaProject(repoDir);
    }
  }
}

writeJson(reportPath, report);
const codexTraceAudit = report.codexTraceAudit
  ? path.resolve(repoRoot, report.codexTraceAudit)
  : runCodexTraceAudit(reportPath, report);
if (codexTraceAudit !== null) {
  report.codexTraceAudit = path.relative(repoRoot, codexTraceAudit);
  writeJson(reportPath, report);
}
process.stdout.write(
  `\nGraph benchmark report: ${path.relative(repoRoot, reportPath)}\n`,
);
if (codexTraceAudit !== null) {
  process.stdout.write(
    `Codex trace audit: ${path.relative(repoRoot, codexTraceAudit)}\n`,
  );
}
if (!parsed.flags.has("--no-website")) {
  process.stdout.write(
    `Graph benchmark website JSON: ${path.relative(repoRoot, websiteJson)}\n`,
  );
}

function refreshCodexTraceAudit(cell, currentReportPath, currentReport) {
  if (cell.harness !== "codex") return null;
  const auditPath = runCodexTraceAudit(currentReportPath, currentReport);
  if (auditPath !== null) {
    currentReport.codexTraceAudit = path.relative(repoRoot, auditPath);
    writeJson(currentReportPath, currentReport);
  }
  return auditPath;
}

function runCodexTraceAudit(currentReportPath, currentReport) {
  if (!currentReport.cells.some((cell) => cell.harness === "codex")) {
    return null;
  }
  const auditPath = path.join(outDir, "codex-trace-audit.json");
  runChecked(
    "node",
    [
      path.join(graphHarnessDir, "audit-codex-traces.mjs"),
      `--report=${currentReportPath}`,
      `--out=${auditPath}`,
    ],
    {
      label: "codex trace audit",
      logBase: path.join(outDir, "codex-trace-audit"),
    },
  );
  return auditPath;
}

// agentLabel turns a concrete model into a stable, harness-qualified cell label:
// the agent that ran it plus the model tier, with the churny version number
// dropped so a release does not fork the grid. The tier keeps every non-numeric
// token of the id, so family and size survive without a hardcoded size list:
// gpt-5.5 -> codex-gpt, gpt-5.4-mini -> codex-gpt-mini, gpt-6-nano ->
// codex-gpt-nano. Claude CLI aliases are normalized to the stable Claude Code
// tier, while the exact published id stays in modelVersion.
function agentLabel(resolvedModel) {
  if (resolvedModel === "sonnet" || resolvedModel.startsWith("claude-sonnet-"))
    return "claude-code-sonnet";
  if (resolvedModel === "opus" || resolvedModel.startsWith("claude-opus-"))
    return "claude-code-opus";
  if (!resolvedModel.startsWith("gpt-")) return `claude-code-${resolvedModel}`;
  const tier = resolvedModel
    .split("-")
    .filter((token) => token && !/^[0-9.]+$/.test(token))
    .join("-");
  return `codex-${tier}`;
}

function modelVersionId(resolvedModel) {
  if (resolvedModel.startsWith("claude-") || resolvedModel.startsWith("gpt-"))
    return resolvedModel;
  return undefined;
}

function runAgentCell({
  project,
  spec,
  repoDir,
  tool,
  toolSetupMs,
  codebaseMemoryCacheDir,
  model,
  branch,
  promptFamily,
  arm,
  runs,
  daemon,
  effort,
  codexModel,
  outDir,
}) {
  const codex = model === "codex" || model.startsWith("gpt-");
  const harness = codex ? codexHarness : claudeHarness;
  const resolvedModel = codex
    ? model === "codex"
      ? codexModel
      : model
    : model;
  // The cell is keyed by tier, not by the exact model string, so the benchmark
  // grid and website stay stable as OpenAI bumps versions (gpt-5.5 -> gpt-5.6
  // overwrites the same cell instead of forking a new one). The precise id is
  // kept in modelVersion below.
  const label = agentLabel(resolvedModel);
  const logStem = `${project}-${branch}-${promptFamily}-${filenamePart(`${tool}-${label}`)}`;
  const args = [
    harness,
    `--repo=${project}`,
    `--repo-dir=${repoDir}`,
    `--tsconfig=${spec.tsconfig}`,
    `--runs=${runs}`,
    `--daemon=${daemon}`,
    `--model=${resolvedModel}`,
    `--prompt-family=${promptFamily}`,
    `--arm=${arm}`,
    `--max-run-retries=${maxRunRetries}`,
  ];
  const question = promptFamilyQuestion(promptFamily);
  if (question) args.push(`--question=${question}`);
  const sourceReport = path.join(outDir, `${logStem}.raw.json`);
  args.push(`--report=${sourceReport}`);
  if (tool === TOOL_CODEGRAPH) args.push("--cg=1");
  if (tool === TOOL_CODEBASE_MEMORY) {
    args.push("--cbm=1");
    args.push(`--cbm-binary=${codebaseMemoryBinaryForChild()}`);
    if (codebaseMemoryCacheDir)
      args.push(`--cbm-cache-dir=${codebaseMemoryCacheDir}`);
  }
  if (tool === TOOL_SERENA) {
    args.push("--serena=1");
    if (parsed.values["serena-command"])
      args.push(`--serena-command=${parsed.values["serena-command"]}`);
    if (parsed.values["serena-args"])
      args.push(`--serena-args=${parsed.values["serena-args"]}`);
  }
  if (codex) args.push(`--effort=${effort}`);

  runChecked("node", args, {
    label: `${project} ${branch} ${tool} ${resolvedModel}`,
    logBase: path.join(outDir, logStem),
  });

  const data = JSON.parse(fs.readFileSync(sourceReport, "utf8"));
  const copyPath = path.join(outDir, `${logStem}.json`);
  writeJson(copyPath, data);
  const harnessName = codex ? "codex" : "claude-code";
  const version = modelVersionId(
    data.modelVersion ?? data.model ?? resolvedModel,
  );
  const websiteCell = {
    harness: harnessName,
    tool,
    ...(toolSetupMs != null ? { toolSetupMs } : {}),
    repo: data.repo ?? project,
    model: label,
    ...(version ? { modelVersion: version } : {}),
    ...(data.effort ? { effort: data.effort } : {}),
    ...(data.promptId ? { promptId: data.promptId } : {}),
    promptFamily: data.promptFamily ?? promptFamily,
    ...(data.questionSha256 ? { questionSha256: data.questionSha256 } : {}),
    fixtureBranch: data.fixtureBranch ?? branch,
    daemon: daemon === "1" || daemon === "true",
    runs: data.runs ?? Number(runs),
    question: data.question,
    samples: sanitizeSamples(data.samples),
  };
  return {
    cell: {
      project,
      branch,
      tool,
      ...(toolSetupMs != null ? { toolSetupMs } : {}),
      harness: harnessName,
      model: label,
      ...(modelVersionId(data.modelVersion ?? resolvedModel)
        ? { modelVersion: modelVersionId(data.modelVersion ?? resolvedModel) }
        : {}),
      promptFamily,
      repoDir,
      tsconfig: spec.tsconfig,
      log: path.relative(repoRoot, `${path.join(outDir, logStem)}.out.log`),
      report: path.relative(repoRoot, copyPath),
      summary: summarize(data),
    },
    websiteCell,
  };
}

function publishWebsiteCells(cells) {
  if (parsed.flags.has("--no-website")) return;
  const prior =
    !resetWebsite && fs.existsSync(websiteJson) ? loadJson(websiteJson) : null;
  resetWebsite = false;
  const out = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    structural: prior?.structural ?? null,
    agent: { cells: [...(prior?.agent?.cells ?? [])] },
  };
  for (const cell of cells) {
    if (
      !cell ||
      ((cell.samples?.baseline?.length ?? 0) === 0 &&
        (cell.samples?.graph?.length ?? 0) === 0)
    ) {
      continue;
    }
    const key = websiteCellKey(cell);
    const at = out.agent.cells.findIndex((old) => websiteCellKey(old) === key);
    if (at >= 0) {
      const existing = out.agent.cells[at];
      const existingBaseline = existing.samples?.baseline?.length ?? 0;
      const existingGraph = existing.samples?.graph?.length ?? 0;
      const nextBaseline = cell.samples?.baseline?.length ?? 0;
      const nextGraph = cell.samples?.graph?.length ?? 0;
      if (nextBaseline < existingBaseline || nextGraph < existingGraph) {
        console.warn(
          `skip thinner agent cell: ${cell.tool ?? "ttsc-graph"} / ${
            cell.repo
          } / ${cell.modelVersion ?? cell.model} / ${
            cell.promptFamily ?? "project-specific"
          } (${nextBaseline}/${nextGraph} < ${existingBaseline}/${existingGraph})`,
        );
        continue;
      }
      out.agent.cells[at] = cell;
    } else out.agent.cells.push(cell);
  }
  fs.mkdirSync(path.dirname(websiteJson), { recursive: true });
  fs.writeFileSync(websiteJson, `${JSON.stringify(out)}\n`);
}

function sanitizeSamples(samples) {
  return {
    baseline: (samples?.baseline ?? [])
      .filter(validMeasuredSample)
      .map(sanitizeSample),
    graph: (samples?.graph ?? [])
      .filter(validMeasuredSample)
      .map(sanitizeSample),
  };
}

function validMeasuredSample(sample) {
  return Number(sample?.tokens ?? 0) > 0;
}

function sanitizeSample(sample) {
  const out = {};
  for (const key of PUBLISHED_SAMPLE_KEYS) {
    if (sample[key] !== undefined) out[key] = sample[key];
  }
  return out;
}

function websiteCellKey(cell) {
  return JSON.stringify([
    cell.harness,
    cell.tool ?? "ttsc-graph",
    cell.repo,
    cell.promptId ?? "",
    cell.promptFamily ?? "project-specific",
    cell.model,
    cell.effort ?? "",
    cell.fixtureBranch ?? "ttsc",
    cell.daemon === true ? "daemon" : "single",
  ]);
}

function ensureCodegraphIndex(project, repoDir) {
  if (parsed.flags.has("--no-codegraph-index")) return null;
  ensureCodegraphIgnored(repoDir);
  cleanupCodegraphIndex(repoDir);
  const start = process.hrtime.bigint();
  const logStem = `codegraph-index-${project}`;
  runChecked(...codegraphCommand(["init", repoDir]), {
    label: `codegraph index ${project}`,
    logBase: path.join(outDir, logStem),
    cwd: repoRoot,
  });
  return Number(process.hrtime.bigint() - start) / 1e6;
}

function ensureCodegraphIgnored(repoDir) {
  const exclude = path.join(repoDir, ".git", "info", "exclude");
  if (!fs.existsSync(exclude)) return;
  const text = fs.readFileSync(exclude, "utf8");
  if (/^\.codegraph\/$/m.test(text)) return;
  fs.appendFileSync(
    exclude,
    `${text.endsWith("\n") ? "" : "\n"}# generated by graph benchmark\n.codegraph/\n`,
  );
}

function cleanupCodegraphIndex(repoDir) {
  if (parsed.flags.has("--keep-codegraph-index")) return;
  const root = path.resolve(repoDir);
  const target = path.resolve(repoDir, ".codegraph");
  const relative = path.relative(root, target);
  if (
    relative === "" ||
    relative.startsWith("..") ||
    path.isAbsolute(relative)
  ) {
    throw new Error(
      `refusing to remove codegraph index outside fixture: ${target}`,
    );
  }
  fs.rmSync(target, { recursive: true, force: true });
}

function ensureCodebaseMemoryIndex(project, repoDir) {
  if (parsed.flags.has("--no-codebase-memory-index")) {
    return {
      ms: null,
      cacheDir: codebaseMemoryCacheDir(project),
    };
  }
  ensureCodebaseMemoryIgnored(repoDir);
  const cacheDir = codebaseMemoryCacheDir(project);
  cleanupCodebaseMemoryIndex(repoDir, cacheDir);
  fs.mkdirSync(cacheDir, { recursive: true });
  const start = process.hrtime.bigint();
  const logStem = `codebase-memory-index-${project}`;
  runChecked(
    ...codebaseMemoryCommand([
      "cli",
      "index_repository",
      JSON.stringify({
        repo_path: repoDir,
        // codebase-memory-mcp index mode: full (default) | moderate | fast.
        // `fast` skips semantic/similarity extraction, so its index "dump" fits
        // in far less memory — the only mode that can index large repos (vscode)
        // on this host without the full mode's ~30GB blowup.
        ...(process.env.TTSC_BENCH_CBM_MODE
          ? { mode: process.env.TTSC_BENCH_CBM_MODE }
          : {}),
      }),
    ]),
    {
      label: `codebase-memory index ${project}`,
      logBase: path.join(outDir, logStem),
      cwd: repoRoot,
      env: codebaseMemoryEnv(cacheDir),
    },
  );
  return {
    ms: Number(process.hrtime.bigint() - start) / 1e6,
    cacheDir,
  };
}

function codebaseMemoryCacheDir(project) {
  return path.join(outDir, "codebase-memory-cache", filenamePart(project));
}

function ensureCodebaseMemoryIgnored(repoDir) {
  const exclude = path.join(repoDir, ".git", "info", "exclude");
  if (!fs.existsSync(exclude)) return;
  const text = fs.readFileSync(exclude, "utf8");
  if (/^\.codebase-memory\/$/m.test(text)) return;
  fs.appendFileSync(
    exclude,
    `${text.endsWith("\n") ? "" : "\n"}# generated by graph benchmark\n.codebase-memory/\n`,
  );
}

function cleanupCodebaseMemoryIndex(repoDir, cacheDir) {
  if (parsed.flags.has("--keep-codebase-memory-index")) return;
  safeRemoveInside(repoDir, path.join(repoDir, ".codebase-memory"));
  if (cacheDir) safeRemoveInside(outDir, cacheDir);
}

function ensureSerenaIgnored(repoDir) {
  const exclude = path.join(repoDir, ".git", "info", "exclude");
  if (!fs.existsSync(exclude)) return;
  const text = fs.readFileSync(exclude, "utf8");
  if (/^\.serena\/$/m.test(text)) return;
  fs.appendFileSync(
    exclude,
    `${text.endsWith("\n") ? "" : "\n"}# generated by graph benchmark\n.serena/\n`,
  );
}

function cleanupSerenaProject(repoDir) {
  if (parsed.flags.has("--keep-serena-project")) return;
  safeRemoveInside(repoDir, path.join(repoDir, ".serena"));
}

function safeRemoveInside(root, target) {
  const resolvedRoot = path.resolve(root);
  const resolvedTarget = path.resolve(target);
  const relative = path.relative(resolvedRoot, resolvedTarget);
  if (
    relative === "" ||
    relative.startsWith("..") ||
    path.isAbsolute(relative)
  ) {
    throw new Error(
      `refusing to remove path outside ${resolvedRoot}: ${target}`,
    );
  }
  fs.rmSync(resolvedTarget, { recursive: true, force: true });
}

function selectArm(value) {
  if (value !== "baseline" && value !== "graph" && value !== "both") {
    throw new Error("--arm must be baseline, graph, or both");
  }
  return value;
}

function selectTools(value, arm) {
  const names = splitList(value);
  const expanded = names.includes("all")
    ? [TOOL_TTSC, TOOL_CODEGRAPH, TOOL_CODEBASE_MEMORY, TOOL_SERENA]
    : names.map((name) =>
        name === "codebase-memory-mcp" ? TOOL_CODEBASE_MEMORY : name,
      );
  const allowed = new Set([
    TOOL_BASELINE,
    TOOL_TTSC,
    TOOL_CODEGRAPH,
    TOOL_CODEBASE_MEMORY,
    TOOL_SERENA,
  ]);
  if (expanded.length === 0)
    throw new Error(
      "--tools must contain baseline, ttsc-graph, codegraph, codebase-memory, serena, or all",
    );
  for (const name of expanded) {
    if (!allowed.has(name))
      throw new Error(
        "--tools must contain baseline, ttsc-graph, codegraph, codebase-memory, serena, or all",
      );
  }
  if (expanded.includes(TOOL_BASELINE)) {
    if (arm !== "baseline")
      throw new Error("--tools=baseline requires --arm=baseline");
    if (expanded.length !== 1)
      throw new Error("--tools=baseline cannot be combined with graph tools");
  }
  return [...new Set(expanded)];
}

function selectPromptFamilies(value) {
  const names = splitList(value);
  const expanded = names.includes("all") ? DEFAULT_PROMPT_FAMILIES : names;
  const allowed = new Set(DEFAULT_PROMPT_FAMILIES);
  if (expanded.length === 0)
    throw new Error("--prompt-family must contain dedicated, common, or all");
  for (const name of expanded) {
    if (!allowed.has(name))
      throw new Error("--prompt-family must contain dedicated, common, or all");
  }
  return [...new Set(expanded)];
}

function promptFamilyQuestion(promptFamily) {
  if (parsed.values.question) return parsed.values.question;
  return null;
}

function codegraphCommand(args) {
  if (process.platform !== "win32") return ["codegraph", args];
  return ["cmd.exe", ["/d", "/s", "/c", "codegraph", ...args]];
}

function codebaseMemoryCommand(args) {
  const binary = codebaseMemoryBinaryForChild();
  if (process.platform !== "win32") return [binary, args];
  return ["cmd.exe", ["/d", "/s", "/c", binary, ...args]];
}

function codebaseMemoryBinary() {
  return (
    parsed.values["codebase-memory-binary"] ??
    parsed.values["cbm-binary"] ??
    process.env.CODEBASE_MEMORY_MCP_BINARY ??
    "codebase-memory-mcp"
  );
}

function codebaseMemoryBinaryForChild() {
  const binary = codebaseMemoryBinary();
  return path.isAbsolute(binary) || /[\\/]/.test(binary)
    ? path.resolve(binary)
    : binary;
}

function codebaseMemoryEnv(cacheDir) {
  return {
    CBM_CACHE_DIR: cacheDir,
    CBM_LOG_LEVEL: process.env.CBM_LOG_LEVEL ?? "warn",
  };
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

function summarize(data) {
  const baseline = armSummary(data.samples?.baseline ?? []);
  const graphSamples = data.samples?.graph ?? [];
  const graph = graphSamples.length > 0 ? armSummary(graphSamples) : null;
  return graph
    ? {
        baseline,
        graph,
        graphSavedPct: savedPct(baseline.tokens, graph.tokens),
      }
    : { baseline };
}

function armSummary(samples) {
  // A run the harness could not carry to an answer is not a cheap run, it is no
  // run: an unparseable tool call ends the turn after one prompt, spends 70k
  // tokens and zero tools, and lands in the table as a 96% saving the tool never
  // earned. Tokens alone cannot tell that apart from a model that answered in one
  // shot, so the run's own verdict is what counts it.
  const valid = samples.filter(
    (sample) => Number(sample?.tokens ?? 0) > 0 && sample?.ok !== false,
  );
  return {
    samples: samples.length,
    validSamples: valid.length,
    failedSamples: samples.length - valid.length,
    tokens: median(valid.map((sample) => sample.tokens)),
    tools: median(valid.map((sample) => sample.tools)),
    seconds: median(valid.map((sample) => sample.durMs)) / 1000,
  };
}

function invalidWebsiteCellReason(cell) {
  void cell;
  return null;
}

function printCellSummary(cell) {
  const { summary } = cell;
  const prefix = `[graph] ${cell.project}@${cell.branch} ${cell.promptFamily} ${cell.tool} ${cell.model}: `;
  if (!summary.graph) {
    process.stdout.write(
      `${prefix}baseline ${Math.round(summary.baseline.tokens)} tok\n`,
    );
    return;
  }
  process.stdout.write(
    `${prefix}baseline ${Math.round(summary.baseline.tokens)} tok, ` +
      `graph ${Math.round(summary.graph.tokens)} tok (${summary.graphSavedPct}%)\n`,
  );
}

function runChecked(
  command,
  args,
  { label, logBase, cwd = repoRoot, env = {} },
) {
  process.stdout.write(`[graph] ${label}\n`);
  const result = cp.spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, ...env },
    windowsHide: true,
    maxBuffer: 512 * 1024 * 1024,
    timeout: Number(process.env.TTSC_GRAPH_BENCH_TIMEOUT_MS ?? 1_800_000),
  });
  fs.writeFileSync(`${logBase}.out.log`, result.stdout ?? "");
  fs.writeFileSync(`${logBase}.err.log`, result.stderr ?? "");
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `${label} failed (${result.status}); see ${path.relative(repoRoot, `${logBase}.err.log`)}`,
    );
  }
}

function projectDir(spec) {
  return path.join(workDir, `${spec.repoName}@${spec.sourceBranch}`);
}

function ensureFixtures(projects) {
  for (const project of projects) {
    const spec = PROJECTS[project];
    const repoDir = projectDir(spec);
    if (fs.existsSync(repoDir)) {
      process.stdout.write(`[graph] reusing fixture ${project}\n`);
      continue;
    }
    fs.mkdirSync(path.dirname(repoDir), { recursive: true });
    const cloneArgs = [
      "clone",
      "--depth",
      "1",
      "--branch",
      spec.sourceBranch,
      spec.sourceRepo,
      repoDir,
    ];
    runChecked("git", cloneArgs, {
      label: `clone graph fixture ${project}`,
      logBase: path.join(outDir, `setup-${project}-source`),
    });
  }
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
    } else if (arg === "--question") {
      values.question = argv[++i];
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

function parseNonNegativeInteger(value, label) {
  const out = Number(value);
  if (!Number.isInteger(out) || out < 0) {
    throw new Error(`${label} must be a non-negative integer`);
  }
  return out;
}

function savedPct(baseline, value) {
  if (!baseline) return 0;
  return Math.round((1 - value / baseline) * 100);
}

function median(values) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function timestamp() {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\..+$/, "");
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}
