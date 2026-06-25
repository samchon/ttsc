#!/usr/bin/env node
/**
 * One-shot AI token benchmark for @ttsc/graph and codegraph on the
 * performance fixtures.
 *
 * This runner intentionally stays separate from performance.mjs: it spends real
 * Claude/Codex credits, so it only runs when called explicitly. It reuses the
 * performance fixture setup (.work/<repo>@ttsc or @ttsc-lint), then drives the
 * agent-cost harnesses sequentially by project and model. No parallelism: large
 * projects such as VS Code already consume enough memory while their graph is
 * built.
 */
import cp from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../..");
const workDir =
  process.env.TTSC_BENCH_WORK ?? path.resolve(here, ".work");
const tgzDir =
  process.env.TTSC_BENCH_TGZ ?? path.join(os.tmpdir(), "ttsc-tgz");
const performanceScript = path.join(here, "performance.mjs");
const websiteJson = path.join(
  repoRoot,
  "website",
  "public",
  "benchmark",
  "graph.json",
);
const questionsDir = path.join(repoRoot, "experimental", "graph-bench", "questions");
const claudeHarness = path.join(repoRoot, "experimental/graph-bench/agent-ab.mjs");
const codexHarness = path.join(
  repoRoot,
  "experimental/graph-bench/agent-ab-codex.mjs",
);
const PROMPT_FAMILIES = {
  "project-specific": null,
  "shared-onboarding": path.join(questionsDir, "shared-onboarding.md"),
};

const PROJECTS = {
  excalidraw: {
    repoName: "excalidraw",
    sourceRepo: "https://github.com/excalidraw/excalidraw.git",
    tsconfig: "tsconfig.json",
  },
  vue: {
    repoName: "ttsc-benchmark-vue",
    tsconfig: "tsconfig.graph.json",
  },
  rxjs: {
    repoName: "ttsc-benchmark-rxjs",
    tsconfig: "tsconfig.graph.json",
  },
  typeorm: {
    repoName: "ttsc-benchmark-typeorm",
    tsconfig: "tsconfig.json",
  },
  zod: {
    repoName: "ttsc-benchmark-zod",
    tsconfig: "tsconfig.graph.json",
  },
  nestjs: {
    repoName: "ttsc-benchmark-nestjs",
    tsconfig: "tsconfig.graph.json",
  },
  vscode: {
    repoName: "ttsc-benchmark-vscode",
    tsconfig: "src/tsconfig.json",
  },
  "shopping-backend": {
    repoName: "shopping-backend",
    tsconfig: "tsconfig.json",
  },
};

const parsed = parseArgs(process.argv.slice(2));
const branch = parsed.values.branch ?? parsed.values["fixture-branch"] ?? "ttsc";
if (branch !== "ttsc" && branch !== "ttsc-lint")
  throw new Error("--branch must be 'ttsc' or 'ttsc-lint'");

const selected = selectProjects(parsed);
const models = splitList(parsed.values.models ?? parsed.values.model ?? "sonnet,opus,codex");
const tools = selectTools(parsed.values.tools ?? parsed.values.tool ?? "ttsc-graph,codegraph");
const promptFamilies = selectPromptFamilies(
  parsed.values["prompt-family"] ??
    parsed.values["prompt-families"] ??
    (parsed.values.question ? "custom" : "project-specific"),
);
const runs = parsed.values.runs ?? "1";
const daemon = parsed.values.daemon ?? "0";
const effort = "high";
const codexModel = parsed.values["codex-model"] ?? "gpt-5.5";
const platformKey = `${process.platform}-${process.arch}`;
const ttscVersion = JSON.parse(
  fs.readFileSync(path.join(repoRoot, "packages", "ttsc", "package.json"), "utf8"),
).version;
const outDir = path.resolve(
  parsed.values.out ??
    process.env.TTSC_GRAPH_BENCH_OUT ??
    path.join(workDir, "graph", timestamp()),
);
let resetWebsite = parsed.flags.has("--reset");

if (parsed.flags.has("--list")) {
  for (const project of Object.keys(PROJECTS)) {
    const spec = PROJECTS[project];
    process.stdout.write(
      `${project}: ${projectDir(spec, branch)} (${spec.tsconfig})\n`,
    );
  }
  process.exit(0);
}

if (selected.length === 0) {
  throw new Error("graph benchmark requires --project <name> or --all");
}

fs.mkdirSync(outDir, { recursive: true });

const fixtureProjects = selected.filter((project) =>
  usesPerformanceFixture(PROJECTS[project]),
);
const graphOnlyProjects = selected.filter((project) =>
  isGraphOnlyProject(PROJECTS[project]),
);

if (!parsed.flags.has("--no-setup")) {
  if (fixtureProjects.length > 0) {
    if (
      !parsed.flags.has("--no-pack") &&
      process.env.TTSC_BENCH_SKIP_PACK !== "1"
    ) {
      packGraphTarballs();
    }
    runSetup(fixtureProjects, branch);
  }
  ensureGraphOnlyRepos(graphOnlyProjects);
}

if (parsed.flags.has("--setup-only")) {
  process.stdout.write(`Graph benchmark setup complete in ${workDir}\n`);
  process.exit(0);
}

const report = {
  date: new Date().toISOString(),
  branch,
  tools,
  promptFamilies,
  runs: Number(runs),
  daemon: daemon === "1" || daemon === "true",
  outDir,
  cells: [],
};

for (const project of selected) {
  const spec = PROJECTS[project];
  const branchLabel = projectBranch(spec, branch);
  const repoDir = projectDir(spec, branch);
  if (!fs.existsSync(repoDir))
    throw new Error(`missing graph benchmark clone: ${repoDir}`);
  if (!fs.existsSync(path.join(repoDir, spec.tsconfig)))
    throw new Error(`missing graph tsconfig: ${path.join(repoDir, spec.tsconfig)}`);

  for (const tool of tools) {
    let codegraphIndexMs = null;
    try {
      if (tool === "codegraph") {
        codegraphIndexMs = ensureCodegraphIndex(project, repoDir);
      }

      for (const promptFamily of promptFamilies) {
        for (const model of models) {
          const { cell, websiteCell } = runAgentCell({
            project,
            spec,
            repoDir,
            tool,
            codegraphIndexMs,
            model,
            branch: branchLabel,
            promptFamily,
            runs,
            daemon,
            effort,
            codexModel,
            outDir,
          });
          report.cells.push(cell);
          writeJson(path.join(outDir, "report.json"), report);
          publishWebsiteCells([websiteCell]);
          printCellSummary(cell);
        }
      }
    } finally {
      if (tool === "codegraph") cleanupCodegraphIndex(repoDir);
    }
  }
}

writeJson(path.join(outDir, "report.json"), report);
process.stdout.write(`\nGraph benchmark report: ${path.relative(repoRoot, path.join(outDir, "report.json"))}\n`);
if (!parsed.flags.has("--no-website")) {
  process.stdout.write(
    `Graph benchmark website JSON: ${path.relative(repoRoot, websiteJson)}\n`,
  );
}

function runSetup(projects, targetBranch) {
  const args = [
    performanceScript,
    "--setup-only",
    "--no-pack",
    `--project=${projects.join(",")}`,
    `--cell-filter=:${targetBranch}:`,
  ];
  for (const flag of [
    "--no-pack",
    "--no-install",
    "--force-install",
    "--allow-missing",
    "--verbose",
  ]) {
    if (parsed.flags.has(flag)) args.push(flag);
  }
  runChecked("node", args, {
    label: "performance fixture setup",
    logBase: path.join(outDir, "setup"),
  });
}

// agentLabel turns a concrete model into a stable, harness-qualified cell label:
// the agent that ran it plus the model tier, with the churny version number
// dropped so a release does not fork the grid. The tier keeps every non-numeric
// token of the id, so family and size survive without a hardcoded size list:
// gpt-5.5 -> codex-gpt, gpt-5.4-mini -> codex-gpt-mini, gpt-6-nano ->
// codex-gpt-nano. Claude tiers (sonnet, opus) carry no version, so they pass
// through. The exact id is recorded separately as modelVersion.
function agentLabel(resolvedModel) {
  if (!resolvedModel.startsWith("gpt-"))
    return `claude-code-${resolvedModel}`;
  const tier = resolvedModel
    .split("-")
    .filter((token) => token && !/^[0-9.]+$/.test(token))
    .join("-");
  return `codex-${tier}`;
}

function runAgentCell({
  project,
  spec,
  repoDir,
  tool,
  codegraphIndexMs,
  model,
  branch,
  promptFamily,
  runs,
  daemon,
  effort,
  codexModel,
  outDir,
}) {
  const codex = model === "codex" || model.startsWith("gpt-");
  const harness = codex ? codexHarness : claudeHarness;
  const resolvedModel = codex ? (model === "codex" ? codexModel : model) : model;
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
  ];
  const question = promptFamilyQuestion(promptFamily);
  if (question) args.push(`--question=${question}`);
  const sourceReport = path.join(outDir, `${logStem}.raw.json`);
  args.push(`--report=${sourceReport}`);
  if (tool === "codegraph") args.push("--cg=1");
  if (codex) args.push(`--effort=${effort}`);

  runChecked("node", args, {
    label: `${project} ${branch} ${tool} ${resolvedModel}`,
    logBase: path.join(outDir, logStem),
  });

  const data = JSON.parse(fs.readFileSync(sourceReport, "utf8"));
  const copyPath = path.join(outDir, `${logStem}.json`);
  writeJson(copyPath, data);
  const harnessName = codex ? "codex" : "claude-code";
  const websiteCell = {
    harness: harnessName,
    tool,
    ...(tool === "codegraph" && codegraphIndexMs != null
      ? { toolSetupMs: codegraphIndexMs }
      : {}),
    repo: data.repo ?? project,
    model: label,
    modelVersion: data.model ?? resolvedModel,
    ...(data.effort ? { effort: data.effort } : {}),
    promptFamily: data.promptFamily ?? promptFamily,
    ...(data.fixtureBranch
      ? { fixtureBranch: data.fixtureBranch }
      : usesPerformanceFixture(spec)
        ? { fixtureBranch: branch }
        : {}),
    daemon: daemon === "1" || daemon === "true",
    runs: data.runs ?? Number(runs),
    question: data.question,
    samples: data.samples,
  };
  return {
    cell: {
      project,
      branch,
      tool,
      ...(tool === "codegraph" && codegraphIndexMs != null
        ? { toolSetupMs: codegraphIndexMs }
        : {}),
      harness: harnessName,
      model: label,
      modelVersion: resolvedModel,
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
    !resetWebsite && fs.existsSync(websiteJson)
      ? loadJson(websiteJson)
      : null;
  resetWebsite = false;
  const out = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    structural: prior?.structural ?? null,
    agent: { cells: [...(prior?.agent?.cells ?? [])] },
  };
  for (const cell of cells) {
    const key = websiteCellKey(cell);
    const at = out.agent.cells.findIndex((old) => websiteCellKey(old) === key);
    if (at >= 0) out.agent.cells[at] = cell;
    else out.agent.cells.push(cell);
  }
  fs.mkdirSync(path.dirname(websiteJson), { recursive: true });
  writeJson(websiteJson, out);
}

function websiteCellKey(cell) {
  return JSON.stringify([
    cell.harness,
    cell.tool ?? "ttsc-graph",
    cell.repo,
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
    throw new Error(`refusing to remove codegraph index outside fixture: ${target}`);
  }
  fs.rmSync(target, { recursive: true, force: true });
}

function selectTools(value) {
  const names = splitList(value);
  const expanded = names.includes("all") ? ["ttsc-graph", "codegraph"] : names;
  const allowed = new Set(["ttsc-graph", "codegraph"]);
  if (expanded.length === 0)
    throw new Error("--tools must contain ttsc-graph, codegraph, or all");
  for (const name of expanded) {
    if (!allowed.has(name))
      throw new Error("--tools must contain ttsc-graph, codegraph, or all");
  }
  return [...new Set(expanded)];
}

function selectPromptFamilies(value) {
  const names = splitList(value);
  const expanded = names.includes("all")
    ? Object.keys(PROMPT_FAMILIES)
    : names;
  const allowed = new Set([...Object.keys(PROMPT_FAMILIES), "custom"]);
  if (expanded.length === 0)
    throw new Error("--prompt-family must contain project-specific, shared-onboarding, custom, or all");
  for (const name of expanded) {
    if (!allowed.has(name))
      throw new Error("--prompt-family must contain project-specific, shared-onboarding, custom, or all");
  }
  return [...new Set(expanded)];
}

function promptFamilyQuestion(promptFamily) {
  if (parsed.values.question) return parsed.values.question;
  if (promptFamily === "custom")
    throw new Error("--prompt-family=custom requires --question");
  const file = PROMPT_FAMILIES[promptFamily];
  return file ? fs.readFileSync(file, "utf8").trim() : null;
}

function codegraphCommand(args) {
  if (process.platform !== "win32") return ["codegraph", args];
  return ["cmd.exe", ["/d", "/s", "/c", "codegraph", ...args]];
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

function packGraphTarballs() {
  fs.mkdirSync(tgzDir, { recursive: true });
  runPnpm(["--filter", "ttsc", "build"], "build ttsc");
  runPnpm(["--filter", "@ttsc/lint", "build"], "build @ttsc/lint");
  runPnpm(
    ["--dir", path.join(repoRoot, "packages", `ttsc-${platformKey}`), "build"],
    `build @ttsc/${platformKey}`,
  );
  for (const target of graphTarballTargets()) {
    const out = path.join(tgzDir, target.file);
    fs.rmSync(out, { force: true });
    runPnpm(["pack", "--out", out], `pack ${target.name}`, target.dir);
  }
}

function graphTarballTargets() {
  return [
    {
      name: "ttsc",
      dir: path.join(repoRoot, "packages", "ttsc"),
      file: `ttsc-${ttscVersion}.tgz`,
    },
    {
      name: "@ttsc/lint",
      dir: path.join(repoRoot, "packages", "lint"),
      file: `ttsc-lint-${ttscVersion}.tgz`,
    },
    {
      name: `@ttsc/${platformKey}`,
      dir: path.join(repoRoot, "packages", `ttsc-${platformKey}`),
      file: `ttsc-${platformKey}-${ttscVersion}.tgz`,
    },
  ];
}

function summarize(data) {
  const baseline = armSummary(data.samples.baseline);
  const graph = armSummary(data.samples.graph);
  return {
    baseline,
    graph,
    graphSavedPct: savedPct(baseline.tokens, graph.tokens),
  };
}

function armSummary(samples) {
  return {
    tokens: median(samples.map((sample) => sample.tokens)),
    tools: median(samples.map((sample) => sample.tools)),
    seconds: median(samples.map((sample) => sample.durMs)) / 1000,
  };
}

function printCellSummary(cell) {
  const { summary } = cell;
  process.stdout.write(
    `[graph] ${cell.project}@${cell.branch} ${cell.promptFamily} ${cell.tool} ${cell.model}: ` +
      `baseline ${Math.round(summary.baseline.tokens)} tok, ` +
      `graph ${Math.round(summary.graph.tokens)} tok (${summary.graphSavedPct}%)\n`,
  );
}

function runChecked(command, args, { label, logBase, cwd = repoRoot }) {
  process.stdout.write(`[graph] ${label}\n`);
  const result = cp.spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, TTSC_BENCH_TGZ: tgzDir },
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

function runPnpm(args, label, cwd = repoRoot) {
  runChecked(...pnpmCommand(args), {
    label,
    logBase: path.join(outDir, label.replace(/[^a-z0-9_.-]+/gi, "-")),
    cwd,
  });
}

function pnpmCommand(args) {
  if (process.platform !== "win32") return ["pnpm", args];
  return ["cmd.exe", ["/d", "/s", "/c", "pnpm", ...args]];
}

function fixtureDir(spec, targetBranch) {
  return path.join(workDir, `${spec.repoName}@${targetBranch}`);
}

function projectDir(spec, targetBranch) {
  return isGraphOnlyProject(spec)
    ? path.join(workDir, "graph-source", spec.repoName)
    : fixtureDir(spec, targetBranch);
}

function projectBranch(spec, targetBranch) {
  return isGraphOnlyProject(spec) ? "source" : targetBranch;
}

function usesPerformanceFixture(spec) {
  return !isGraphOnlyProject(spec);
}

function isGraphOnlyProject(spec) {
  return typeof spec.sourceRepo === "string" && spec.sourceRepo.length > 0;
}

function ensureGraphOnlyRepos(projects) {
  for (const project of projects) {
    const spec = PROJECTS[project];
    const repoDir = projectDir(spec);
    if (fs.existsSync(repoDir)) {
      process.stdout.write(`[graph] reusing graph-only repo ${project}\n`);
      continue;
    }
    fs.mkdirSync(path.dirname(repoDir), { recursive: true });
    runChecked("git", ["clone", "--depth", "1", spec.sourceRepo, repoDir], {
      label: `clone graph-only repo ${project}`,
      logBase: path.join(outDir, `setup-${project}-source`),
    });
  }
}

function selectProjects({ flags, values, positional }) {
  const explicit = [
    ...splitList(values.project ?? ""),
    ...positional,
  ];
  const names = flags.has("--all") ? Object.keys(PROJECTS) : explicit;
  for (const name of names) {
    if (!PROJECTS[name])
      throw new Error(`unknown project ${name}; choose ${Object.keys(PROJECTS).join(", ")}`);
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
      values.project = appendCsv(values.project, arg.slice("--project=".length));
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
