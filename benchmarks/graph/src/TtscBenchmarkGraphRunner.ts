/**
 * One-shot AI token benchmark for @ttsc/graph, codegraph, codebase-memory, and
 * Serena on the graph benchmark fixtures.
 *
 * It stays separate from the performance benchmark in every respect: it spends
 * real Claude/Codex credits, so it only runs when called explicitly, and it
 * owns its own fixtures — the `graph` branch of each benchmark repo, cloned
 * into `../graph-benchmark-work` beside this repo, installed from the fixture's
 * own lockfile. Two reasons the fixtures are not shared with the performance
 * sweep: a graph-only fixture edit would change what the tsc-vs-ttsc cells
 * compile, and a fixture under this repo hands the measured agent ttsc's own
 * CLAUDE.md / AGENTS.md through the parent-directory walk both CLIs do.
 *
 * Projects run sequentially: a large fixture such as VS Code already consumes
 * enough memory while its graph is built.
 */
import cp from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { TtscBenchmarkCommandLine } from "./TtscBenchmarkCommandLine.ts";
import { TtscBenchmarkConstant } from "./TtscBenchmarkConstant.ts";
import { TtscBenchmarkGraph } from "./TtscBenchmarkGraph.ts";
import { TtscBenchmarkGraphWebsiteCell } from "./TtscBenchmarkGraphWebsiteCell.ts";
import { TtscBenchmarkNumber } from "./TtscBenchmarkNumber.ts";
import type { ITtscBenchmarkAgentSample } from "./structures/ITtscBenchmarkAgentSample.ts";
import type { ITtscBenchmarkGraphProject } from "./structures/ITtscBenchmarkGraphProject.ts";
import { ITtscBenchmarkGraphWebsiteAgentCell } from "./structures/ITtscBenchmarkGraphWebsiteAgentCell.ts";

/**
 * Runs the complete graph-agent benchmark while keeping its executable a
 * location-only bootstrap.
 *
 * Every child entrypoint it launches is derived from the supplied executable
 * directory, so relocating this implementation never changes which bootstrap
 * runs. Roots the harness reads or writes — the repository, the fixture work
 * directory, the report directory, the website JSON — come from
 * `TtscBenchmarkConstant` instead and are unaffected either way.
 */
export namespace TtscBenchmarkGraphRunner {
  /**
   * Parses the current process arguments and executes one graph benchmark
   * invocation.
   *
   * @param entrypointDirectory Absolute directory containing the graph
   *   executable bootstraps used as child-process entrypoints.
   */
  export function main(entrypointDirectory: string): void {
    type BenchmarkArm = ITtscBenchmarkAgentSample.Arm | "both";
    type BenchmarkTool =
      | "baseline"
      | "ttsc-graph"
      | "codegraph"
      | "codebase-memory"
      | "serena";
    type PromptFamily = "dedicated" | "common";
    type Command = [command: string, arguments_: string[]];

    interface IAgentHarnessReport {
      effort?: string;
      fixtureBranch?: string;
      model?: string;
      modelVersion?: string;
      promptFamily?: string;
      promptId?: string;
      question?: string;
      questionSha256?: string;
      repo?: string;
      runs?: number;
      samples: Record<
        ITtscBenchmarkAgentSample.Arm,
        ITtscBenchmarkAgentSample[]
      >;
    }

    type PublishedSampleKey = (typeof PUBLISHED_SAMPLE_KEYS)[number];
    type PublishedSample = Record<string, unknown> &
      Partial<Pick<ITtscBenchmarkAgentSample, PublishedSampleKey>>;

    interface IPublishedSamples {
      baseline: PublishedSample[];
      graph: PublishedSample[];
    }

    interface IWebsiteCell extends ITtscBenchmarkGraphWebsiteAgentCell {
      daemon: boolean;
      effort?: string;
      fixtureBranch: string;
      modelVersion?: string;
      promptId?: string;
      question?: string;
      questionSha256?: string;
      runs: number;
      samples: IPublishedSamples;
      tool: BenchmarkTool;
      toolSetupMs?: number;
    }

    interface IArmSummary {
      failedSamples: number;
      samples: number;
      seconds: number;
      tokens: number;
      tools: number;
      validSamples: number;
    }

    type CellSummary =
      | {
          baseline: IArmSummary;
          graph?: never;
          graphSavedPct?: never;
        }
      | {
          baseline: IArmSummary;
          graph: IArmSummary;
          graphSavedPct: number;
        };

    interface IGraphCell {
      branch: string;
      harness: "codex" | "claude-code";
      log: string;
      model: string;
      modelVersion?: string;
      project: string;
      promptFamily: PromptFamily;
      repoDir: string;
      report: string;
      summary: CellSummary;
      tool: BenchmarkTool;
      toolSetupMs?: number;
      tsconfig: string;
    }

    interface IGraphReport {
      arm: BenchmarkArm;
      branch: string;
      cells: IGraphCell[];
      codexTraceAudit?: string;
      daemon: boolean;
      date: string;
      maxRunRetries: number;
      outDir: string;
      promptFamilies: PromptFamily[];
      runs: number;
      tools: BenchmarkTool[];
    }

    interface IRunAgentCellOptions {
      arm: BenchmarkArm;
      branch: string;
      codebaseMemoryCacheDir: string | null;
      codexModel: string;
      daemon: string;
      effort: string;
      model: string;
      outDir: string;
      project: string;
      promptFamily: PromptFamily;
      repoDir: string;
      runs: string;
      spec: ITtscBenchmarkGraphProject;
      tool: BenchmarkTool;
      toolSetupMs: number | null;
    }

    interface IRunAgentCellResult {
      cell: IGraphCell;
      websiteCell: IWebsiteCell;
    }

    interface IRunOptions {
      cwd?: string;
      env?: Readonly<Record<string, string | undefined>>;
      input?: string;
      label: string;
      logBase: string;
    }

    interface IWebsiteReport {
      [key: string]: unknown;
      agent: {
        cells: IWebsiteCell[];
      };
      generatedAt: string;
      index?: unknown;
      schemaVersion: number;
      structural: unknown;
    }

    const here = entrypointDirectory;
    const repoRoot = TtscBenchmarkConstant.REPOSITORY_ROOT;
    // Outside the repo on purpose: the measured agent's cwd is the fixture clone,
    // and both CLIs walk the parent chain for CLAUDE.md / AGENTS.md, so a fixture
    // under `benchmarks/graph/.work` loaded ttsc's own agent instructions into
    // every cell — a vscode graph run was caught reading this repo's AGENTS.md
    // instead of touring vscode.
    const workDir = TtscBenchmarkGraph.resolveWorkDir(repoRoot);
    const websiteJson = path.join(
      repoRoot,
      "website",
      "public",
      "benchmark",
      "graph.json",
    );
    const graphHarnessDir = here;
    const claudeHarness = path.join(graphHarnessDir, "agent-ab.ts");
    const codexHarness = path.join(graphHarnessDir, "agent-ab-codex.ts");
    const DEFAULT_PROMPT_FAMILIES = ["dedicated", "common"] as const;
    const TOOL_TTSC = "ttsc-graph";
    const TOOL_CODEGRAPH = "codegraph";
    const TOOL_CODEBASE_MEMORY = "codebase-memory";
    const TOOL_SERENA = "serena";

    /** Every language serena's project interview offers, declined. */
    const SERENA_DECLINE_ALL = "n\n".repeat(80);
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
    ] as const satisfies readonly (keyof ITtscBenchmarkAgentSample)[];

    // Each fixture is the `graph` branch of its benchmark repo, cloned and installed
    // by this runner alone. The graph benchmark used to measure the `ttsc` branch the
    // performance sweep compiles, which made the two fight over one tree: a
    // graph-only edit — a tsconfig whose program includes the tests, so a tour can
    // cite them — would have changed what the tsc-vs-ttsc cells compile. The `graph`
    // branch carries those edits and nothing else; the folder an agent sees is the
    // plain project name, because a `ttsc-benchmark-` cwd makes it hunt for harness
    // code instead of touring the source.
    function projectSpec(name: string): ITtscBenchmarkGraphProject {
      const spec: ITtscBenchmarkGraphProject | undefined =
        TtscBenchmarkGraph.PROJECTS[name as TtscBenchmarkGraph.ProjectName];
      if (spec === undefined) {
        throw new Error(
          `unknown project ${name}; choose ${Object.keys(TtscBenchmarkGraph.PROJECTS).join(", ")}`,
        );
      }
      return spec;
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
        (arm === "baseline"
          ? "baseline"
          : "ttsc-graph,codegraph,codebase-memory"),
      arm,
    );
    const promptFamilies = selectPromptFamilies(
      parsed.values["prompt-family"] ??
        parsed.values["prompt-families"] ??
        "dedicated",
    );
    const runCount = TtscBenchmarkNumber.parsePositive(
      parsed.values.runs ?? "1",
      "--runs",
    );
    const runs = String(runCount);
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
        path.join(TtscBenchmarkConstant.WORK_ROOT, "graph", timestamp()),
    );
    const reportPath = path.join(outDir, "report.json");
    let resetWebsite = parsed.flags.has("--reset");

    if (parsed.flags.has("--list")) {
      for (const project of Object.keys(TtscBenchmarkGraph.PROJECTS)) {
        const spec = projectSpec(project);
        process.stdout.write(
          `${project}: ${TtscBenchmarkGraph.projectDir(workDir, spec)} (${spec.tsconfig})\n`,
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

    const report: IGraphReport = {
      date: new Date().toISOString(),
      branch,
      arm,
      tools,
      promptFamilies,
      runs: runCount,
      maxRunRetries,
      daemon: daemon === "1" || daemon === "true",
      outDir,
      cells: [],
    };

    for (const project of selected) {
      const spec = projectSpec(project);
      const branchLabel = spec.sourceBranch;
      const repoDir = TtscBenchmarkGraph.projectDir(workDir, spec);
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
              toolSetupMs = ensureSerenaIndex(project, repoDir);
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
                throw new Error(
                  `${project} ${tool} ${model}: ${invalidReason}`,
                );
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

    function refreshCodexTraceAudit(
      cell: IGraphCell,
      currentReportPath: string,
      currentReport: IGraphReport,
    ): string | null {
      if (cell.harness !== "codex") return null;
      const auditPath = runCodexTraceAudit(currentReportPath, currentReport);
      if (auditPath !== null) {
        currentReport.codexTraceAudit = path.relative(repoRoot, auditPath);
        writeJson(currentReportPath, currentReport);
      }
      return auditPath;
    }

    function runCodexTraceAudit(
      currentReportPath: string,
      currentReport: IGraphReport,
    ): string | null {
      if (!currentReport.cells.some((cell) => cell.harness === "codex")) {
        return null;
      }
      const auditPath = path.join(outDir, "codex-trace-audit.json");
      runChecked(
        process.execPath,
        TtscBenchmarkConstant.nodeTypeScriptArguments(
          path.join(graphHarnessDir, "audit-codex-traces.ts"),
          [`--report=${currentReportPath}`, `--out=${auditPath}`],
        ),
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
    function agentLabel(resolvedModel: string): string {
      if (
        resolvedModel === "sonnet" ||
        resolvedModel.startsWith("claude-sonnet-")
      )
        return "claude-code-sonnet";
      if (resolvedModel === "opus" || resolvedModel.startsWith("claude-opus-"))
        return "claude-code-opus";
      if (!resolvedModel.startsWith("gpt-"))
        return `claude-code-${resolvedModel}`;
      const tier = resolvedModel
        .split("-")
        .filter((token) => token && !/^[0-9.]+$/.test(token))
        .join("-");
      return `codex-${tier}`;
    }

    function modelVersionId(resolvedModel: string): string | undefined {
      if (
        resolvedModel.startsWith("claude-") ||
        resolvedModel.startsWith("gpt-")
      )
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
    }: IRunAgentCellOptions): IRunAgentCellResult {
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
        `--repo=${project}`,
        `--repo-dir=${repoDir}`,
        `--tsconfig=${spec.tsconfig}`,
        `--runs=${runs}`,
        `--daemon=${daemon}`,
        `--model=${resolvedModel}`,
        `--prompt-family=${promptFamily}`,
        // The fixture this runner clones is the branch it names, so say so. Left
        // unsaid, the harness falls back to its own per-repo default and stamps the
        // report with a branch the measurement never ran on.
        `--fixture-branch=${branch}`,
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

      runChecked(
        process.execPath,
        TtscBenchmarkConstant.nodeTypeScriptArguments(harness, args),
        {
          label: `${project} ${branch} ${tool} ${resolvedModel}`,
          logBase: path.join(outDir, logStem),
        },
      );

      const data = parseAgentHarnessReport(
        fs.readFileSync(sourceReport, "utf8"),
        sourceReport,
      );
      const copyPath = path.join(outDir, `${logStem}.json`);
      writeJson(copyPath, data);
      const harnessName = codex ? "codex" : "claude-code";
      const version = modelVersionId(
        data.modelVersion ?? data.model ?? resolvedModel,
      );
      const websiteRepo = ITtscBenchmarkGraphWebsiteAgentCell.parseRepo(
        data.repo ?? project,
      );
      const websitePromptFamily =
        ITtscBenchmarkGraphWebsiteAgentCell.parsePromptFamily(
          data.promptFamily ?? promptFamily,
        );
      const websiteCell: IWebsiteCell = {
        harness: harnessName,
        tool,
        ...(toolSetupMs != null ? { toolSetupMs } : {}),
        repo: websiteRepo,
        model: label,
        ...(version ? { modelVersion: version } : {}),
        ...(data.effort ? { effort: data.effort } : {}),
        ...(data.promptId ? { promptId: data.promptId } : {}),
        promptFamily: websitePromptFamily,
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
            ? {
                modelVersion: modelVersionId(
                  data.modelVersion ?? resolvedModel,
                ),
              }
            : {}),
          promptFamily,
          repoDir,
          tsconfig: spec.tsconfig,
          log: path.relative(repoRoot, `${path.join(outDir, logStem)}.out.log`),
          // Absolute, like the suite runner already records the same field.
          // Every reader of a cell report - the publisher, the trace auditor,
          // the suite - then needs no base at all, and a run directory named by
          // `--out` stays readable from whatever directory the publish is typed
          // in. Recorded relative to the repository root it was readable from
          // exactly one place, and only by a reader that knew to try that base.
          // `log` stays repository-relative: it is provenance a human reads,
          // and nothing resolves it.
          report: copyPath,
          summary: summarize(data),
        },
        websiteCell,
      };
    }

    function publishWebsiteCells(cells: readonly IWebsiteCell[]): void {
      if (parsed.flags.has("--no-website")) return;
      const prior = fs.existsSync(websiteJson)
        ? loadWebsiteReport(websiteJson)
        : null;
      const out: IWebsiteReport = {
        ...(prior ?? {}),
        schemaVersion: 1,
        generatedAt: new Date().toISOString(),
        structural: prior?.structural ?? null,
        agent: {
          cells: resetWebsite ? [] : [...(prior?.agent?.cells ?? [])],
        },
      };
      resetWebsite = false;
      for (const cell of cells) {
        if (
          !cell ||
          ((cell.samples?.baseline?.length ?? 0) === 0 &&
            (cell.samples?.graph?.length ?? 0) === 0)
        ) {
          continue;
        }
        const key = TtscBenchmarkGraphWebsiteCell.key(cell);
        const at = out.agent.cells.findIndex(
          (old) => TtscBenchmarkGraphWebsiteCell.key(old) === key,
        );
        if (at >= 0) {
          const existing = out.agent.cells[at]!;
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

    function sanitizeSamples(
      samples: Record<
        ITtscBenchmarkAgentSample.Arm,
        ITtscBenchmarkAgentSample[]
      >,
    ): IPublishedSamples {
      return {
        baseline: (samples?.baseline ?? [])
          .filter(validMeasuredSample)
          .map(sanitizeSample),
        graph: (samples?.graph ?? [])
          .filter(validMeasuredSample)
          .map(sanitizeSample),
      };
    }

    function validMeasuredSample(sample: ITtscBenchmarkAgentSample): boolean {
      return Number(sample?.tokens ?? 0) > 0 && sample.ok !== false;
    }

    function sanitizeSample(
      sample: ITtscBenchmarkAgentSample,
    ): PublishedSample {
      const out: PublishedSample = {};
      for (const key of PUBLISHED_SAMPLE_KEYS) {
        if (sample[key] !== undefined) out[key] = sample[key];
      }
      return out;
    }

    function ensureCodegraphIndex(
      project: string,
      repoDir: string,
    ): number | null {
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

    function ensureCodegraphIgnored(repoDir: string): void {
      const exclude = path.join(repoDir, ".git", "info", "exclude");
      if (!fs.existsSync(exclude)) return;
      const text = fs.readFileSync(exclude, "utf8");
      if (/^\.codegraph\/$/m.test(text)) return;
      fs.appendFileSync(
        exclude,
        `${text.endsWith("\n") ? "" : "\n"}# generated by graph benchmark\n.codegraph/\n`,
      );
    }

    function cleanupCodegraphIndex(repoDir: string): void {
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

    function ensureCodebaseMemoryIndex(
      project: string,
      repoDir: string,
    ): { cacheDir: string; ms: number | null } {
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

    function codebaseMemoryCacheDir(project: string): string {
      return path.join(outDir, "codebase-memory-cache", filenamePart(project));
    }

    function ensureCodebaseMemoryIgnored(repoDir: string): void {
      const exclude = path.join(repoDir, ".git", "info", "exclude");
      if (!fs.existsSync(exclude)) return;
      const text = fs.readFileSync(exclude, "utf8");
      if (/^\.codebase-memory\/$/m.test(text)) return;
      fs.appendFileSync(
        exclude,
        `${text.endsWith("\n") ? "" : "\n"}# generated by graph benchmark\n.codebase-memory/\n`,
      );
    }

    function cleanupCodebaseMemoryIndex(
      repoDir: string,
      cacheDir: string | null,
    ): void {
      if (parsed.flags.has("--keep-codebase-memory-index")) return;
      safeRemoveInside(repoDir, path.join(repoDir, ".codebase-memory"));
      if (cacheDir) safeRemoveInside(outDir, cacheDir);
    }

    /**
     * Build serena's own index before its agent cells run.
     *
     * Serena ships `serena project index` — its docs recommend it for larger
     * projects — and this harness had never run it, so every serena cell
     * answered from an unindexed language server. A benchmark that withholds a
     * tool's own prescribed setup measures the withholding, not the tool.
     *
     * `project create` comes first because `index` needs a project config, and
     * it interviews the operator about every language it detects (VS Code
     * detects twenty-two); headless, an unanswered prompt aborts on EOF, so
     * each is declined on stdin. The index build is timed and reported as
     * `toolSetupMs`, the same field `codegraph` and `codebase-memory` already
     * carry.
     */
    function ensureSerenaIndex(
      project: string,
      repoDir: string,
    ): number | null {
      ensureSerenaIgnored(repoDir);
      if (parsed.flags.has("--no-serena-index")) return null;

      // An index already on disk is reused. serena's cache is keyed by a content
      // hash of each file and re-checked at every lookup, so a cache built from this
      // fixture's unedited source is exactly the cache a fresh build would produce —
      // and building it again costs what the index-time axis says it costs: four and
      // a half minutes on VS Code, once per cell, four models and two prompt
      // families over. It is the same index; measure the questions, not the rebuild.
      if (
        parsed.flags.has("--keep-serena-project") &&
        fs.existsSync(path.join(repoDir, ".serena", "cache"))
      ) {
        process.stdout.write(`[graph] serena index ${project}: reused\n`);
        return null;
      }

      cleanupSerenaProject(repoDir);
      runChecked(...serenaCommand(["project", "create", repoDir]), {
        label: `serena project create ${project}`,
        logBase: path.join(outDir, `serena-create-${project}`),
        cwd: repoDir,
        input: SERENA_DECLINE_ALL,
      });
      const start = process.hrtime.bigint();
      runChecked(...serenaCommand(["project", "index"]), {
        label: `serena project index ${project}`,
        logBase: path.join(outDir, `serena-index-${project}`),
        cwd: repoDir,
        input: SERENA_DECLINE_ALL,
      });
      return Number(process.hrtime.bigint() - start) / 1e6;
    }

    /**
     * Serena is launched through `uvx` from its git source, as the agent cells
     * do.
     */
    function serenaCommand(args: string[]): Command {
      const binary =
        parsed.values["serena-command"] ??
        process.env.SERENA_MCP_COMMAND ??
        "uvx";
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

    function ensureSerenaIgnored(repoDir: string): void {
      const exclude = path.join(repoDir, ".git", "info", "exclude");
      if (!fs.existsSync(exclude)) return;
      const text = fs.readFileSync(exclude, "utf8");
      if (/^\.serena\/$/m.test(text)) return;
      fs.appendFileSync(
        exclude,
        `${text.endsWith("\n") ? "" : "\n"}# generated by graph benchmark\n.serena/\n`,
      );
    }

    function cleanupSerenaProject(repoDir: string): void {
      if (parsed.flags.has("--keep-serena-project")) return;
      safeRemoveInside(repoDir, path.join(repoDir, ".serena"));
    }

    function safeRemoveInside(root: string, target: string): void {
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

    function selectArm(value: string): BenchmarkArm {
      if (value !== "baseline" && value !== "graph" && value !== "both") {
        throw new Error("--arm must be baseline, graph, or both");
      }
      return value;
    }

    function selectTools(value: string, arm: BenchmarkArm): BenchmarkTool[] {
      const names = splitList(value);
      const expanded = names.includes("all")
        ? [TOOL_TTSC, TOOL_CODEGRAPH, TOOL_CODEBASE_MEMORY, TOOL_SERENA]
        : names.map((name) =>
            name === "codebase-memory-mcp" ? TOOL_CODEBASE_MEMORY : name,
          );
      if (expanded.length === 0)
        throw new Error(
          "--tools must contain baseline, ttsc-graph, codegraph, codebase-memory, serena, or all",
        );
      const selected: BenchmarkTool[] = [];
      for (const name of expanded) {
        if (!isBenchmarkTool(name))
          throw new Error(
            "--tools must contain baseline, ttsc-graph, codegraph, codebase-memory, serena, or all",
          );
        selected.push(name);
      }
      if (selected.includes(TOOL_BASELINE)) {
        if (arm !== "baseline")
          throw new Error("--tools=baseline requires --arm=baseline");
        if (selected.length !== 1)
          throw new Error(
            "--tools=baseline cannot be combined with graph tools",
          );
      }
      return [...new Set(selected)];
    }

    function isBenchmarkTool(value: string): value is BenchmarkTool {
      return (
        value === TOOL_BASELINE ||
        value === TOOL_TTSC ||
        value === TOOL_CODEGRAPH ||
        value === TOOL_CODEBASE_MEMORY ||
        value === TOOL_SERENA
      );
    }

    function selectPromptFamilies(value: string): PromptFamily[] {
      const names = splitList(value);
      const expanded: readonly string[] = names.includes("all")
        ? DEFAULT_PROMPT_FAMILIES
        : names;
      if (expanded.length === 0)
        throw new Error(
          "--prompt-family must contain dedicated, common, or all",
        );
      const selected: PromptFamily[] = [];
      for (const name of expanded) {
        if (!isPromptFamily(name))
          throw new Error(
            "--prompt-family must contain dedicated, common, or all",
          );
        selected.push(name);
      }
      return [...new Set(selected)];
    }

    function isPromptFamily(value: string): value is PromptFamily {
      return value === "dedicated" || value === "common";
    }

    function promptFamilyQuestion(promptFamily: PromptFamily): string | null {
      void promptFamily;
      if (parsed.values.question) return parsed.values.question;
      return null;
    }

    function codegraphCommand(args: string[]): Command {
      if (process.platform !== "win32") return ["codegraph", args];
      return ["cmd.exe", ["/d", "/s", "/c", "codegraph", ...args]];
    }

    function codebaseMemoryCommand(args: string[]): Command {
      const binary = codebaseMemoryBinaryForChild();
      if (process.platform !== "win32") return [binary, args];
      return ["cmd.exe", ["/d", "/s", "/c", binary, ...args]];
    }

    function codebaseMemoryBinary(): string {
      return (
        parsed.values["codebase-memory-binary"] ??
        parsed.values["cbm-binary"] ??
        process.env.CODEBASE_MEMORY_MCP_BINARY ??
        "codebase-memory-mcp"
      );
    }

    function codebaseMemoryBinaryForChild(): string {
      const binary = codebaseMemoryBinary();
      return path.isAbsolute(binary) || /[\\/]/.test(binary)
        ? path.resolve(binary)
        : binary;
    }

    function codebaseMemoryEnv(
      cacheDir: string,
    ): Readonly<Record<string, string | undefined>> {
      return {
        CBM_CACHE_DIR: cacheDir,
        CBM_LOG_LEVEL: process.env.CBM_LOG_LEVEL ?? "warn",
      };
    }

    function filenamePart(value: string): string {
      return String(value).replace(/[^a-zA-Z0-9._-]+/g, "_");
    }

    function loadJson(file: string): unknown {
      try {
        return JSON.parse(fs.readFileSync(file, "utf8"));
      } catch {
        return null;
      }
    }

    function parseAgentHarnessReport(
      text: string,
      file: string,
    ): IAgentHarnessReport {
      const value: unknown = JSON.parse(text);
      if (!isAgentHarnessReport(value)) {
        throw new TypeError(`invalid graph agent report: ${file}`);
      }
      return value;
    }

    function isAgentHarnessReport(
      value: unknown,
    ): value is IAgentHarnessReport {
      if (!isRecord(value) || !isAgentSamples(value.samples)) return false;
      const optionalStrings = [
        "effort",
        "fixtureBranch",
        "model",
        "modelVersion",
        "promptFamily",
        "promptId",
        "question",
        "questionSha256",
        "repo",
      ] as const;
      return (
        optionalStrings.every((key) => isOptionalString(value[key])) &&
        isOptionalNumber(value.runs)
      );
    }

    function isAgentSamples(
      value: unknown,
    ): value is Record<
      ITtscBenchmarkAgentSample.Arm,
      ITtscBenchmarkAgentSample[]
    > {
      return (
        isRecord(value) &&
        Array.isArray(value.baseline) &&
        value.baseline.every(isAgentBenchmarkSample) &&
        Array.isArray(value.graph) &&
        value.graph.every(isAgentBenchmarkSample)
      );
    }

    function isAgentBenchmarkSample(
      value: unknown,
    ): value is ITtscBenchmarkAgentSample {
      if (!isRecord(value)) return false;
      const requiredNumbers = [
        "durMs",
        "graph",
        "shell",
        "tokens",
        "tools",
        "web",
      ] as const;
      const optionalNumbers = [
        "attempts",
        "cached",
        "cost",
        "grep",
        "other",
        "reads",
        "reasoning",
        "run",
        "shellSource",
        "sourceTouches",
        "tokensWithReasoning",
        "turns",
      ] as const;
      return (
        requiredNumbers.every((key) => typeof value[key] === "number") &&
        optionalNumbers.every((key) => isOptionalNumber(value[key])) &&
        typeof value.ok === "boolean" &&
        typeof value.answer === "string" &&
        typeof value.error === "string" &&
        Array.isArray(value.shellCommands) &&
        value.shellCommands.every((command) => typeof command === "string") &&
        isOptionalString(value.modelVersion) &&
        isOptionalString(value.promptId) &&
        isOptionalString(value.questionSha256) &&
        isOptionalNumberRecord(value.types) &&
        isOptionalUsageList(value.usage)
      );
    }

    function isOptionalNumberRecord(value: unknown): boolean {
      return (
        value === undefined ||
        (isRecord(value) &&
          Object.values(value).every((entry) => typeof entry === "number"))
      );
    }

    function isOptionalUsageList(value: unknown): boolean {
      return (
        value === undefined ||
        (Array.isArray(value) &&
          value.every(
            (entry) =>
              isRecord(entry) &&
              typeof entry.input === "number" &&
              typeof entry.cachedInput === "number" &&
              typeof entry.output === "number" &&
              typeof entry.reasoning === "number",
          ))
      );
    }

    function loadWebsiteReport(file: string): IWebsiteReport {
      const value = loadJson(file);
      if (
        !isRecord(value) ||
        typeof value.schemaVersion !== "number" ||
        typeof value.generatedAt !== "string" ||
        !isRecord(value.agent) ||
        !Array.isArray(value.agent.cells) ||
        !value.agent.cells.every(isWebsiteCell)
      ) {
        throw new TypeError(`invalid graph website report: ${file}`);
      }
      return {
        ...value,
        schemaVersion: value.schemaVersion,
        generatedAt: value.generatedAt,
        structural: value.structural,
        agent: { cells: value.agent.cells },
      };
    }

    function isWebsiteCell(value: unknown): value is IWebsiteCell {
      return (
        isRecord(value) &&
        typeof value.harness === "string" &&
        typeof value.repo === "string" &&
        typeof value.model === "string" &&
        typeof value.tool === "string" &&
        isBenchmarkTool(value.tool) &&
        typeof value.fixtureBranch === "string" &&
        typeof value.daemon === "boolean" &&
        typeof value.runs === "number" &&
        isPublishedSamples(value.samples) &&
        isOptionalString(value.effort) &&
        isOptionalString(value.modelVersion) &&
        isOptionalString(value.promptFamily) &&
        isOptionalString(value.promptId) &&
        isOptionalString(value.question) &&
        isOptionalString(value.questionSha256) &&
        isOptionalNumber(value.toolSetupMs)
      );
    }

    function isPublishedSamples(value: unknown): value is IPublishedSamples {
      return (
        isRecord(value) &&
        Array.isArray(value.baseline) &&
        value.baseline.every(isRecord) &&
        Array.isArray(value.graph) &&
        value.graph.every(isRecord)
      );
    }

    function isRecord(value: unknown): value is Record<string, unknown> {
      return (
        typeof value === "object" && value !== null && !Array.isArray(value)
      );
    }

    function isOptionalNumber(value: unknown): boolean {
      return value === undefined || typeof value === "number";
    }

    function isOptionalString(value: unknown): boolean {
      return value === undefined || typeof value === "string";
    }

    function summarize(data: IAgentHarnessReport): CellSummary {
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

    function armSummary(
      samples: readonly ITtscBenchmarkAgentSample[],
    ): IArmSummary {
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

    function invalidWebsiteCellReason(cell: IWebsiteCell): string | null {
      if (arm !== "graph" && cell.samples.baseline.length !== runCount) {
        return (
          `baseline arm produced ${cell.samples.baseline.length}/${runCount} ` +
          "valid samples"
        );
      }
      if (arm !== "baseline" && cell.samples.graph.length !== runCount) {
        return (
          `graph arm produced ${cell.samples.graph.length}/${runCount} ` +
          "valid samples"
        );
      }
      return null;
    }

    function printCellSummary(cell: IGraphCell): void {
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
      command: string,
      args: readonly string[],
      { label, logBase, cwd = repoRoot, env = {}, input }: IRunOptions,
    ): void {
      process.stdout.write(`[graph] ${label}\n`);
      const result = cp.spawnSync(command, args, {
        cwd,
        encoding: "utf8",
        // A tool that interviews the operator (serena, on every language it detects)
        // would otherwise hit EOF and abort in a headless run.
        ...(input === undefined ? {} : { input }),
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

    function ensureFixtures(projects: readonly string[]): void {
      for (const project of projects) {
        const spec = projectSpec(project);
        const repoDir = TtscBenchmarkGraph.projectDir(workDir, spec);
        if (fs.existsSync(repoDir)) {
          if (!fs.existsSync(path.join(repoDir, ".git")))
            throw new Error(`${repoDir} exists but is not a git checkout`);
          process.stdout.write(`[graph] reusing fixture ${project}\n`);
          refreshFixture(project, spec, repoDir);
        } else {
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
        ensureFixtureInstalled(project, repoDir);
      }
    }

    function refreshFixture(
      project: string,
      spec: ITtscBenchmarkGraphProject,
      repoDir: string,
    ): void {
      runChecked("git", ["fetch", "--depth=1", "origin", spec.sourceBranch], {
        label: `refresh graph fixture ${project}`,
        logBase: path.join(outDir, `setup-${project}-fetch`),
        cwd: repoDir,
      });
      runChecked("git", ["reset", "--hard", "FETCH_HEAD"], {
        label: `reset graph fixture ${project}`,
        logBase: path.join(outDir, `setup-${project}-reset`),
        cwd: repoDir,
      });
      runChecked(
        "git",
        ["clean", "-fdx", "-e", "node_modules", "-e", "**/node_modules"],
        {
          label: `clean graph fixture ${project}`,
          logBase: path.join(outDir, `setup-${project}-clean`),
          cwd: repoDir,
        },
      );
    }

    function ensureFixtureInstalled(project: string, repoDir: string): void {
      if (parsed.flags.has("--no-install")) return;
      const plan = fixtureInstallPlan(repoDir);
      if (plan === null) return;
      runChecked(plan.command, plan.args, {
        label: `install graph fixture ${project} (${plan.label})`,
        logBase: path.join(outDir, `setup-${project}-install`),
        cwd: repoDir,
      });
    }

    function fixtureInstallPlan(
      repoDir: string,
    ): { args: string[]; command: string; label: string } | null {
      if (fs.existsSync(path.join(repoDir, "pnpm-lock.yaml")))
        return packageCommand("pnpm", [
          "install",
          "--frozen-lockfile",
          "--ignore-scripts",
        ]);
      if (fs.existsSync(path.join(repoDir, "package-lock.json")))
        return packageCommand("npm", ["ci", "--ignore-scripts"]);
      if (fs.existsSync(path.join(repoDir, "yarn.lock")))
        return packageCommand("yarn", [
          "install",
          "--frozen-lockfile",
          "--ignore-scripts",
        ]);
      if (fs.existsSync(path.join(repoDir, "package.json")))
        return packageCommand("npm", ["install", "--ignore-scripts"]);
      return null;
    }

    function packageCommand(
      command: string,
      args: string[],
    ): { args: string[]; command: string; label: string } {
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

    function selectProjects({
      flags,
      values,
      positional,
    }: TtscBenchmarkCommandLine.IArguments): string[] {
      const explicit = [...splitList(values.project ?? ""), ...positional];
      const names = flags.has("--all")
        ? Object.keys(TtscBenchmarkGraph.PROJECTS)
        : explicit;
      for (const name of names) {
        if (Object.hasOwn(TtscBenchmarkGraph.PROJECTS, name) === false)
          throw new Error(
            `unknown project ${name}; choose ${Object.keys(TtscBenchmarkGraph.PROJECTS).join(", ")}`,
          );
      }
      return [...new Set(names)];
    }

    function parseArgs(
      argv: readonly string[],
    ): TtscBenchmarkCommandLine.IArguments {
      return TtscBenchmarkCommandLine.parse(argv, {
        repeatable: ["project"],
        values: [
          "project",
          "question",
          "arm",
          "models",
          "model",
          "tools",
          "tool",
          "prompt-family",
          "prompt-families",
          "runs",
          "max-run-retries",
          "daemon",
          "codex-model",
          "out",
          "serena-command",
          "serena-args",
          "serena-source",
          "codebase-memory-binary",
          "cbm-binary",
        ],
      });
    }

    function splitList(value: string): string[] {
      return String(value)
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
    }

    function parseNonNegativeInteger(value: string, label: string): number {
      const out = Number(value);
      if (!Number.isInteger(out) || out < 0) {
        throw new Error(`${label} must be a non-negative integer`);
      }
      return out;
    }

    function savedPct(baseline: number, value: number): number {
      if (!baseline) return 0;
      return Math.round((1 - value / baseline) * 100);
    }

    function median(values: readonly number[]): number {
      if (values.length === 0) return 0;
      const sorted = [...values].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2
        ? sorted[mid]!
        : (sorted[mid - 1]! + sorted[mid]!) / 2;
    }

    function timestamp(): string {
      return new Date().toISOString().replace(/[-:]/g, "").replace(/\..+$/, "");
    }

    function writeJson(file: string, value: unknown): void {
      fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
    }
  }
}
