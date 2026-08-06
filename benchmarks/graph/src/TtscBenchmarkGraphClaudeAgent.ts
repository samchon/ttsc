// Agent-cost A/B for @ttsc/graph, a faithful port of codegraph's agent-cost
// benchmark (scripts/agent-eval/run-all.sh + parse-bench-readme.mjs). For one
// structural question per repo it runs the Claude Code CLI headless twice, once
// with the @ttsc/graph MCP server and once with an empty MCP config, both under
// --strict-mcp-config, and reports the codegraph metrics: total tokens summed
// per assistant turn, tool-call count, cost, and wall time, TtscBenchmarkNumber.median over N runs.
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
//   pnpm --dir benchmarks/graph run agent:claude -- --prompt-family=dedicated --repo=excalidraw --runs=2
//   pnpm --dir benchmarks/graph run agent:claude -- --prompt-family=common --repo=vscode --runs=4 --model=opus
//   pnpm --dir benchmarks/graph run agent:claude -- --prompt-id=typeorm-dedicated-v1 --runs=2
import cp from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { TtscBenchmarkCommandLine } from "./TtscBenchmarkCommandLine.ts";
import { TtscBenchmarkConstant } from "./TtscBenchmarkConstant.ts";
import { TtscBenchmarkGraph } from "./TtscBenchmarkGraph.ts";
import { TtscBenchmarkNumber } from "./TtscBenchmarkNumber.ts";
import type { ITtscBenchmarkAgentSample } from "./structures/ITtscBenchmarkAgentSample.ts";
import type { ITtscBenchmarkGraphPrompt } from "./structures/ITtscBenchmarkGraphPrompt.ts";
import type { ITtscBenchmarkGraphRepository } from "./structures/ITtscBenchmarkGraphRepository.ts";
import type { TtscBenchmarkProcess } from "./structures/TtscBenchmarkProcess.ts";

/**
 * Runs the Claude Code A/B harness for graph benchmark tool arms.
 *
 * The namespace owns the complete harness lifecycle so importing it has no
 * process, filesystem, or credit-spending side effects.
 */
export namespace TtscBenchmarkGraphClaudeAgent {
  /**
   * Executes the Claude graph benchmark with the original CLI and report
   * format.
   */
  export async function main(): Promise<void> {
    const repoRoot = TtscBenchmarkConstant.REPOSITORY_ROOT;
    const ttscDir = path.join(repoRoot, "packages", "ttsc");
    const graphLauncher = path.join(
      repoRoot,
      "packages",
      "graph",
      "lib",
      "bin.js",
    );
    const runRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), "ttsc-benchmark-claude-"),
    );

    function cleanupRunRoot(): void {
      fs.rmSync(runRoot, { recursive: true, force: true });
    }

    process.once("exit", cleanupRunRoot);
    const SOURCE_FILE = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/i;

    /**
     * Loads the reusable graph benchmark prompts from
     * `questions/manifest.json`.
     *
     * The manifest is external JSON rather than trusted TypeScript. Validate
     * every field used to select a repository or read a question file so
     * malformed input stops the benchmark before it can run a different
     * workload.
     */
    function loadManifest(): ITtscBenchmarkGraphPrompt.IManifest {
      const manifestPath = path.join(
        TtscBenchmarkConstant.QUESTIONS_ROOT,
        "manifest.json",
      );
      if (!fs.existsSync(manifestPath))
        return { schemaVersion: 1, prompts: [] };
      const parsed: unknown = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
      if (!isGraphBenchmarkPromptManifest(parsed)) {
        throw new Error(
          `invalid graph benchmark prompt manifest: ${manifestPath}`,
        );
      }
      return parsed;
    }

    /**
     * Tests whether an unknown JSON value is a supported prompt manifest.
     *
     * Schema version one is the only format this runner understands. Every
     * prompt field that affects fixture selection, question loading, or report
     * provenance is checked before the value enters the typed benchmark
     * pipeline.
     */
    function isGraphBenchmarkPromptManifest(
      value: unknown,
    ): value is ITtscBenchmarkGraphPrompt.IManifest {
      return (
        isRecord(value) &&
        value.schemaVersion === 1 &&
        Array.isArray(value.prompts) &&
        value.prompts.every(isGraphBenchmarkPrompt)
      );
    }

    /** Tests whether one unknown manifest entry contains every prompt selector. */
    function isGraphBenchmarkPrompt(
      value: unknown,
    ): value is ITtscBenchmarkGraphPrompt.IManifest["prompts"][number] {
      return (
        isRecord(value) &&
        typeof value.id === "string" &&
        typeof value.repo === "string" &&
        (value.family === "common" || value.family === "dedicated") &&
        typeof value.file === "string" &&
        (value.fixtureBranch === undefined ||
          value.fixtureBranch === "graph") &&
        typeof value.tsconfig === "string" &&
        typeof value.questionSha256 === "string"
      );
    }

    /** Narrows an unknown JSON value to a non-array object. */
    function isRecord(value: unknown): value is Record<string, unknown> {
      return (
        typeof value === "object" && value !== null && !Array.isArray(value)
      );
    }

    /**
     * Resolves one manifest prompt and verifies its pinned question file.
     *
     * Both lexical and canonical containment are checked: `..` traversal and an
     * in-root symlink that targets an external file must not change the
     * measured question. The manifest digest is then compared with the raw file
     * bytes before the text is trimmed for the agent prompt.
     */
    function resolveManifestPrompt(
      args: Readonly<Record<string, string>>,
    ): ITtscBenchmarkGraphPrompt.IResolved | null {
      const id = args["prompt-id"];
      const family = args["prompt-family"];
      if (!id && !family) return null;
      const manifest = loadManifest();
      const prompts = manifest.prompts ?? [];
      const repoFilter = args.repo;
      const entry = id
        ? prompts.find((p) => p.id === id)
        : prompts.find(
            (p) =>
              p.family === family && (!repoFilter || p.repo === repoFilter),
          );
      if (!entry) {
        throw new Error(
          id
            ? `unknown --prompt-id ${id}; manifest has ${prompts.map((p) => p.id).join(", ")}`
            : `no manifest prompt for --prompt-family ${family}${repoFilter ? ` repo ${repoFilter}` : ""}`,
        );
      }
      const questionFile = path.resolve(
        TtscBenchmarkConstant.QUESTIONS_ROOT,
        entry.file,
      );
      if (
        !isContainedPath(TtscBenchmarkConstant.QUESTIONS_ROOT, questionFile)
      ) {
        throw new Error(
          `prompt ${entry.id} escapes the graph benchmark questions root: ${entry.file}`,
        );
      }
      const canonicalQuestionsRoot = fs.realpathSync(
        TtscBenchmarkConstant.QUESTIONS_ROOT,
      );
      const canonicalQuestionFile = fs.realpathSync(questionFile);
      if (!isContainedPath(canonicalQuestionsRoot, canonicalQuestionFile)) {
        throw new Error(
          `prompt ${entry.id} resolves outside the graph benchmark questions root: ${entry.file}`,
        );
      }
      const questionBytes = fs.readFileSync(canonicalQuestionFile);
      const questionSha256 = crypto
        .createHash("sha256")
        .update(questionBytes)
        .digest("hex");
      if (questionSha256 !== entry.questionSha256) {
        throw new Error(
          `prompt ${entry.id} SHA-256 mismatch: expected ${entry.questionSha256}, received ${questionSha256}`,
        );
      }
      const text = questionBytes.toString("utf8").trim();
      return {
        entry,
        text,
        questionSha256,
      };
    }

    /** Tests whether `candidate` is a child path of `root`. */
    function isContainedPath(root: string, candidate: string): boolean {
      const relative = path.relative(root, candidate);
      return (
        relative.length > 0 &&
        relative !== ".." &&
        !relative.startsWith(`..${path.sep}`) &&
        !path.isAbsolute(relative)
      );
    }

    function repositoryOf(name: string): ITtscBenchmarkGraphRepository {
      if (Object.hasOwn(TtscBenchmarkGraph.REPOSITORIES, name) === false)
        throw new Error(
          `unknown --repo ${name}; choose ${Object.keys(TtscBenchmarkGraph.REPOSITORIES).join(" | ")}`,
        );
      return TtscBenchmarkGraph.REPOSITORIES[
        name as TtscBenchmarkGraph.ProjectName
      ];
    }

    const args: Record<string, string> = TtscBenchmarkCommandLine.parseKeyValue(
      process.argv.slice(2),
    );
    // A manifest prompt (--prompt-id / --prompt-family) overrides the per-repo
    // question and pins the repo, fixtureBranch, and tsconfig. Resolve it first so
    // it can fill --repo when only --prompt-id is given.
    const manifestPrompt = resolveManifestPrompt(args);
    const repoKey: string =
      args.repo ?? manifestPrompt?.entry.repo ?? "excalidraw";
    const spec: ITtscBenchmarkGraphRepository = repositoryOf(repoKey);
    const runs: number = TtscBenchmarkNumber.parsePositive(
      args.runs ?? "2",
      "--runs",
    );
    const model = args.model ?? "sonnet";
    const effort = "high";
    const claudeStartupGraceMs = TtscBenchmarkNumber.parseNonNegative(
      args["claude-startup-grace-ms"] ??
        process.env.TTSC_CLAUDE_STARTUP_GRACE_MS ??
        "5000",
      "--claude-startup-grace-ms",
    );
    const claudeRunTimeoutMs = TtscBenchmarkNumber.parseNonNegative(
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
    const FIXTURE_BRANCHES: ReadonlySet<string> = new Set([
      "graph",
      "ttsc",
      "ttsc-lint",
    ]);
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
      throw new Error(
        `--arm must be baseline | graph | both, got ${armFilter}`,
      );

    const goRoot = path.join(os.homedir(), "go-sdk", "go", "bin");
    const goEnv: NodeJS.ProcessEnv = {
      ...process.env,
      GOCACHE: path.join(runRoot, "go-cache"),
      GOTMPDIR: path.join(runRoot, "go-tmp"),
      PATH: fs.existsSync(goRoot)
        ? `${goRoot}${path.delimiter}${process.env.PATH ?? ""}`
        : process.env.PATH,
    };
    fs.mkdirSync(goEnv.GOCACHE!, { recursive: true });
    fs.mkdirSync(goEnv.GOTMPDIR!, { recursive: true });

    // 1. Build the native ttscgraph dump binary, which the @ttsc/graph launcher runs
    // once to build the resident graph (skipped for codegraph, which is a global CLI).
    // The Go binary is dump-only now; the MCP server itself is the Node launcher.
    const binary = path.join(
      runRoot,
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
      runOrThrow(
        "go",
        ["build", "-o", binary, "./cmd/ttscgraph"],
        ttscDir,
        goEnv,
      );
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
    if (armsRequested.graph) ensureInstalled(repoDir);

    // 3. WITH = @ttsc/graph; WITHOUT = empty config. Both --strict-mcp-config. The
    // graph server is the Node launcher run over stdio; it shells out to the dump
    // binary (pointed at via TTSC_GRAPH_BINARY) once at startup, then answers tool
    // calls from the resident graph. The launcher has no daemon/port mode; its
    // single type-check stays inside the measured cell, so there is no daemon path.
    const withCfg = armsRequested.graph
      ? path.join(runRoot, "mcp-graph.json")
      : null;
    const emptyCfg = armsRequested.baseline
      ? path.join(runRoot, "mcp-empty.json")
      : null;
    if (withCfg) {
      const serverCfg: Record<string, TtscBenchmarkProcess.IMcpServer> = cg
        ? { codegraph: codegraphServerConfig(repoDir) }
        : cbm
          ? { "codebase-memory-mcp": codebaseMemoryServerConfig() }
          : serena
            ? { serena: serenaServerConfig(repoDir) }
            : {
                "ttsc-graph": {
                  command: process.execPath,
                  args: [
                    graphLauncher,
                    "--cwd",
                    repoDir,
                    "--tsconfig",
                    tsconfig,
                  ],
                  env: { TTSC_GRAPH_BINARY: binary },
                },
              };
      validateMcpServerConfig(serverCfg);
      // A session that opens before its MCP server has connected is a session whose
      // first turn has no tool: Claude Code reports the server as `pending` in its
      // init event, the model sees a tool name and no schema, and it goes to the
      // shell. `alwaysLoad` holds the session open until the server answers the
      // handshake. Every arm's server gets it — the flag is a property of the
      // benchmark, not of a tool.
      for (const server of Object.values(serverCfg)) server.alwaysLoad = true;
      fs.writeFileSync(withCfg, JSON.stringify({ mcpServers: serverCfg }));
    }
    if (emptyCfg)
      fs.writeFileSync(emptyCfg, JSON.stringify({ mcpServers: {} }));
    const arms: Array<{ name: ITtscBenchmarkAgentSample.Arm; cfg: string }> = [
      { name: "baseline", cfg: emptyCfg },
      { name: "graph", cfg: withCfg },
    ].filter(
      (arm): arm is { name: ITtscBenchmarkAgentSample.Arm; cfg: string } =>
        arm.cfg !== null,
    );

    console.log(
      `\ncodegraph A/B on ${repoKey} - model ${model}, ${runs} run(s) x ${arms.length} arms` +
        (promptId ? `, prompt ${promptId}` : "") +
        (fixtureBranch ? `, fixture ${fixtureBranch}` : ""),
    );
    console.log(`Q: ${question}\n`);

    const reportName = "agent-ab-report.json";
    const reportPath = args.report
      ? path.resolve(args.report)
      : path.join(TtscBenchmarkConstant.WORK_ROOT, "graph", reportName);
    const traceDir = args["trace-dir"]
      ? path.resolve(args["trace-dir"])
      : path.join(
          path.dirname(reportPath),
          `${path.basename(reportPath, path.extname(reportPath))}.traces`,
        );
    fs.rmSync(reportPath, { force: true });
    fs.rmSync(traceDir, { recursive: true, force: true });
    fs.mkdirSync(traceDir, { recursive: true });

    const samples: Record<
      ITtscBenchmarkAgentSample.Arm,
      ITtscBenchmarkAgentSample[]
    > = {
      baseline: [],
      graph: [],
    };
    let spent = 0;
    const MAX_RUN_RETRIES = TtscBenchmarkNumber.parseNonNegative(
      args["max-run-retries"] ?? "4",
      "--max-run-retries",
    );
    // Launch arms x runs concurrently, capped at TTSC_BENCH_CONCURRENCY (default
    // unlimited). A high cap is fastest for experiment iteration; a low cap (a handful)
    // keeps the host quiet enough that per-run timings and token counts settle, which
    // matters when comparing close conditions. Each invocation is its own process with
    // its own MCP server and trace file, so they never share state.
    const concurrency = Number(process.env.TTSC_BENCH_CONCURRENCY) || Infinity;
    const thunks: Array<() => Promise<void>> = arms.flatMap((arm) =>
      Array.from({ length: runs }, (_, r) => async () => {
        // A run is a measurement when it spent tokens and the harness carried it to
        // an answer. A 529 overload reports subtype "success" with is_error and zero
        // usage; an unparseable tool call ends the turn early with tokens spent, no
        // tools run, and a failure on the record — and counted as a sample it reads
        // as the cheapest cell in the table, a saving the tool never earned. Both are
        // retried. The trace file is keyed by run number, so a successful retry
        // overwrites the failed attempt.
        let m: ITtscBenchmarkAgentSample | undefined;
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
              `  ${arm.name.padEnd(8)} run ${r + 1}: [FAILED] ${m?.error || ""} retrying (${attempt + 1}/${MAX_RUN_RETRIES})`,
            );
        }
        // Tag the sample with prompt provenance only. The benchmark does not judge
        // answer correctness in-process.
        if (m === undefined) throw new Error(`${arm.name} produced no sample`);
        if (promptId) m.promptId = promptId;
        if (manifestPrompt?.questionSha256) {
          m.questionSha256 = manifestPrompt.questionSha256;
        }
        m.run = r + 1;
        m.attempts = attempts;
        samples[arm.name].push(m);
        spent += m.cost ?? 0;
        console.log(
          `  ${arm.name.padEnd(8)} run ${r + 1}: $${(m.cost ?? 0).toFixed(3)}, ${m.tokens} tok, ${m.tools} tools ` +
            `(read ${m.reads}, grep ${m.grep}, shell ${m.shell ?? 0}, source ${m.sourceTouches ?? 0}, graph ${m.graph}, web ${m.web ?? 0}), ${(m.durMs / 1000).toFixed(0)}s` +
            (m.ok ? "" : `  [FAILED${m.error ? `: ${m.error}` : ""}]`) +
            `  [running $${spent.toFixed(2)}]`,
        );
      }),
    );
    await runWithConcurrency(thunks, concurrency);

    // runWithConcurrency runs thunks with at most `limit` in flight at once, draining a
    // shared cursor so a slow run never blocks a free worker.
    async function runWithConcurrency(
      work: ReadonlyArray<() => Promise<void>>,
      limit: number,
    ): Promise<void> {
      let next = 0;
      const worker = async (): Promise<void> => {
        while (next < work.length) {
          const current: (() => Promise<void>) | undefined = work[next++];
          if (current !== undefined) await current();
        }
      };
      const lanes = Math.max(1, Math.min(limit, work.length));
      await Promise.all(Array.from({ length: lanes }, worker));
    }

    const med = (
      arm: ITtscBenchmarkAgentSample.Arm,
      key: ITtscBenchmarkAgentSample.Metric,
    ): number =>
      TtscBenchmarkNumber.median(
        (samples[arm] ?? [])
          .filter((m) => Number(m?.tokens ?? 0) > 0)
          .map((sample: ITtscBenchmarkAgentSample): number =>
            Number(sample[key] ?? 0),
          ),
      );
    const pct = (graph: number, baseline: number): number =>
      baseline === 0 ? 0 : Math.round((1 - graph / baseline) * 100);
    type MetricFormatter = (value: number) => string | number;
    type MetricPrinter = (
      label: string,
      key: ITtscBenchmarkAgentSample.Metric,
      format?: MetricFormatter,
    ) => void;
    const identityMetric: MetricFormatter = (value: number): number => value;
    const printBaselineLine: MetricPrinter = (
      label,
      key,
      format = identityMetric,
    ) => {
      console.log(
        `  ${label.padEnd(12)} baseline ${format(med("baseline", key))}`,
      );
    };
    const printGraphLine: MetricPrinter = (
      label,
      key,
      format = identityMetric,
    ) => {
      console.log(`  ${label.padEnd(12)} graph ${format(med("graph", key))}`);
    };
    const printComparisonLine: MetricPrinter = (
      label,
      key,
      format = identityMetric,
    ) => {
      const baseline: number = med("baseline", key);
      console.log(
        `  ${label.padEnd(12)} baseline ${format(baseline)}  ->  graph ${format(med("graph", key))} (${pct(med("graph", key), baseline)}%)`,
      );
    };

    console.log(`\nMedian of ${runs} run(s), codegraph metrics:`);
    const printLine: MetricPrinter =
      armsRequested.baseline && armsRequested.graph
        ? printComparisonLine
        : armsRequested.baseline
          ? printBaselineLine
          : printGraphLine;
    printLine("tokens", "tokens");
    printLine("tool calls", "tools");
    printLine("cost", "cost", (value: number) => `$${value.toFixed(3)}`);
    printLine(
      "wall time",
      "durMs",
      (value: number) => `${(value / 1000).toFixed(0)}s`,
    );

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
    process.off("exit", cleanupRunRoot);
    cleanupRunRoot();

    async function runClaude(
      question: string,
      cfg: string,
      armName: ITtscBenchmarkAgentSample.Arm,
      runNumber: number,
    ): Promise<ITtscBenchmarkAgentSample> {
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
          // Claude Code 2.1.207 defers MCP tool schemas behind a `ToolSearch` call
          // by default. A model that has not searched yet holds a tool name and no
          // schema, and it answers the question from the shell instead — which is a
          // property of the client, not of the tool being measured, and it lands on
          // whichever server is slowest to connect. Every arm therefore runs with
          // the schemas loaded upfront, which is what the tool sees in a session a
          // person opens and keeps.
          ENABLE_TOOL_SEARCH: "false",
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

    function streamJsonUserInput(text: string): string {
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

    function prepareClaudeHome(targetHome: string): string {
      fs.rmSync(targetHome, { recursive: true, force: true });
      fs.mkdirSync(path.join(targetHome, ".claude"), { recursive: true });
      copyIfExists(path.join(os.homedir(), ".claude.json"), targetHome);
      copyIfExists(
        path.join(os.homedir(), ".claude", ".credentials.json"),
        path.join(targetHome, ".claude"),
      );
      return targetHome;
    }

    function copyIfExists(source: string, targetDir: string): void {
      if (!fs.existsSync(source)) return;
      fs.copyFileSync(source, path.join(targetDir, path.basename(source)));
    }

    function observedModelVersion(
      allSamples: Readonly<
        Record<ITtscBenchmarkAgentSample.Arm, ITtscBenchmarkAgentSample[]>
      >,
    ): string | undefined {
      for (const armSamples of Object.values(allSamples)) {
        for (const sample of armSamples ?? []) {
          if (sample.modelVersion) return sample.modelVersion;
        }
      }
      return undefined;
    }

    function promptForArm(
      baseQuestion: string,
      armName: ITtscBenchmarkAgentSample.Arm,
    ): string {
      // The baseline arm is told to ground its answer in this checkout, because it
      // has nothing but the repository and its own memory of a famous project, and
      // without the sentence it answers from memory: it skips the files, states what
      // the upstream project does today, and spends nothing doing it. That is not a
      // baseline, it is a recital. An arm holding a tool that only ever returns
      // facts from this checkout's compiler needs no such warning, and giving it one
      // is an order to go verify what the compiler already resolved.
      if (armName === "baseline")
        return `${baseQuestion}\n\n${TtscBenchmarkGraph.GROUNDING}`;
      // Every tool arm carries the same line, and the baseline none: see TtscBenchmarkGraph.TOOL_NUDGE.
      // Claude Code defers MCP tool schemas behind ToolSearch, so a model told nothing
      // shell-explores the repo before it discovers the server at all — every graph
      // cell but one opened with two Bash calls before its first graph call.
      return `${baseQuestion}\n\n${TtscBenchmarkGraph.TOOL_NUDGE}`;
    }

    // spawnAsync runs a child to completion and resolves its captured stdout/stderr,
    // so many runs can be in flight at once via Promise.all. An async spawn never
    // blocks the loop the way spawnSync would, which is what lets every arm and run
    // fire concurrently.
    function spawnAsync(
      command: string,
      commandArgs: string[],
      {
        input,
        inputDelayMs = 0,
        ...spawnOpts
      }: TtscBenchmarkProcess.ISpawnOptions,
    ): Promise<TtscBenchmarkProcess.ISpawnResult> {
      return new Promise<TtscBenchmarkProcess.ISpawnResult>((resolve) => {
        const child = cp.spawn(command, commandArgs, spawnOpts);
        let stdout = "";
        let stderr = "";
        child.stdout?.setEncoding("utf8");
        child.stderr?.setEncoding("utf8");
        child.stdout?.on("data", (data: string) => (stdout += data));
        child.stderr?.on("data", (data: string) => (stderr += data));
        child.on("error", (error) => resolve({ error, stdout, stderr }));
        child.on("close", () => resolve({ stdout, stderr }));
        if (input) {
          // Nobody speaks the instant a client opens. Claude Code spawns its stdio
          // MCP servers when the CLI starts but only opens the session when the
          // first message arrives, so the question is held back to let the servers
          // finish booting first. Every MCP arm gets the same wait.
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

    function codegraphServerConfig(
      targetRepoDir: string,
    ): TtscBenchmarkProcess.IMcpServer {
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

    function validateMcpServerConfig(
      serverCfg: Record<string, TtscBenchmarkProcess.IMcpServer>,
    ): void {
      if ((cg || cbm || serena) && serverCfg["ttsc-graph"]) {
        throw new Error(
          "comparator Claude config must not include @ttsc/graph",
        );
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

    function codebaseMemoryServerConfig(): TtscBenchmarkProcess.IMcpServer {
      return {
        command: cbmCommand,
        args: [],
        env: {
          ...(cbmCacheDir ? { CBM_CACHE_DIR: cbmCacheDir } : {}),
          CBM_LOG_LEVEL: "warn",
        },
      };
    }

    function serenaServerConfig(
      targetRepoDir: string,
    ): TtscBenchmarkProcess.IMcpServer {
      return {
        command: serenaCommand,
        args: serenaServerArgs(targetRepoDir),
      };
    }

    function serenaServerArgs(targetRepoDir: string): string[] {
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

    /**
     * Parses configured Serena arguments and expands repository placeholders.
     *
     * A value beginning with `[` is an explicit JSON representation and must be
     * a string array. Other values retain the benchmark's shell-like
     * convenience syntax, whose tokenizer already produces strings without
     * coercing JSON data.
     */
    function parseConfiguredArgs(raw: string, targetRepoDir: string): string[] {
      let parsed: string[] | undefined;
      if (raw.trim().startsWith("[")) {
        const json: unknown = JSON.parse(raw);
        if (
          !Array.isArray(json) ||
          !json.every((part): part is string => typeof part === "string")
        ) {
          throw new Error("--serena-args JSON value must be a string array");
        }
        parsed = json;
      } else {
        parsed = raw
          .match(/"[^"]*"|'[^']*'|\S+/g)
          ?.map((part: string) => part.replace(/^(['"])(.*)\1$/, "$2"));
      }
      if (!parsed) {
        throw new Error(
          "--serena-args must be a JSON string array or shell-like list",
        );
      }
      return parsed.map((part) =>
        part
          .replaceAll("{repo}", targetRepoDir)
          .replaceAll("{cwd}", targetRepoDir),
      );
    }

    function commandPath(command: string): string {
      return path.isAbsolute(command) || /[\\/]/.test(command)
        ? path.resolve(command)
        : command;
    }

    function graphToolName(): string {
      if (cg) return "codegraph";
      if (cbm) return "codebase-memory";
      if (serena) return "serena";
      return "ttsc-graph";
    }

    function ensureInstalled(targetRepoDir: string): void {
      if (truthy(args["no-install"])) return;
      const plan = installPlan(targetRepoDir);
      if (!plan) return;
      console.log(
        `Installing dependencies in ${targetRepoDir} (${plan.label})...`,
      );
      runOrThrow(plan.command, plan.args, targetRepoDir, process.env);
    }

    function installPlan(
      targetRepoDir: string,
    ): TtscBenchmarkProcess.ICommand | null {
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

    function packageCommand(
      command: string,
      args: string[],
    ): TtscBenchmarkProcess.ICommand {
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

    function truthy(value: string | undefined): boolean {
      return value === "1" || value === "true" || value === "yes";
    }

    function sourceInspectionCommand(command: string): boolean {
      return (
        /\b(git\s+grep|rg|grep|Select-String|findstr)\b/i.test(command) ||
        /\b(Get-Content|gc|cat|type|sed|awk|head|tail)\b/i.test(command) ||
        (/\b(git\s+ls-files|Get-ChildItem|gci|ls|dir)\b/i.test(command) &&
          /\b(src|packages|apps|lib|server|client|test|\.[cm]?[tj]sx?)\b/i.test(
            command,
          ))
      );
    }

    function sourceToolUse(
      name: string,
      input: Readonly<Record<string, unknown>>,
    ): boolean {
      const filePath =
        typeof input.file_path === "string" ? input.file_path : "";
      const command = typeof input.command === "string" ? input.command : "";
      if (name === "Read") return SOURCE_FILE.test(filePath);
      if (name === "Grep" || name === "Glob") return true;
      if (name === "Bash" || name === "PowerShell" || name === "Shell")
        return sourceInspectionCommand(command);
      return false;
    }

    // parseStream mirrors codegraph's parse-bench-readme.mjs: tokens are summed over
    // every assistant turn's usage (not the last-turn result.usage), and tool calls
    // are counted across assistant events (ToolSearch excluded). It also captures the
    // agent's final answer text: the `result` event's `result` string is the canonical
    // final answer; the concatenated text of the last assistant turn is the fallback
    // for a stream that ends without a result event.
    interface IClaudeStreamBlock {
      input?: Record<string, unknown>;
      name?: string;
      text?: string;
      type?: string;
    }

    interface IClaudeStreamEvent {
      duration_ms?: number;
      is_error?: boolean;
      message?: {
        content?: IClaudeStreamBlock[];
        model?: string;
        usage?: {
          cache_creation_input_tokens?: number;
          cache_read_input_tokens?: number;
          input_tokens?: number;
          output_tokens?: number;
        };
      };
      model?: string;
      modelUsage?: Record<string, { outputTokens?: number }>;
      result?: string;
      subtype?: string;
      total_cost_usd?: number;
      type?: string;
    }

    /** Tests whether an optional JSON property is a finite number. */
    function isOptionalNumber(value: unknown): value is number | undefined {
      return (
        value === undefined ||
        (typeof value === "number" && Number.isFinite(value))
      );
    }

    /** Tests whether an optional JSON property is a string. */
    function isOptionalString(value: unknown): value is string | undefined {
      return value === undefined || typeof value === "string";
    }

    /**
     * Tests whether an unknown content item has the stream block fields we
     * read.
     */
    function isClaudeStreamBlock(value: unknown): value is IClaudeStreamBlock {
      return (
        isRecord(value) &&
        (value.input === undefined || isRecord(value.input)) &&
        isOptionalString(value.name) &&
        isOptionalString(value.text) &&
        isOptionalString(value.type)
      );
    }

    /**
     * Tests whether an unknown assistant usage object contains numeric
     * counters.
     */
    function isClaudeStreamUsage(
      value: unknown,
    ): value is NonNullable<
      NonNullable<IClaudeStreamEvent["message"]>["usage"]
    > {
      return (
        isRecord(value) &&
        isOptionalNumber(value.cache_creation_input_tokens) &&
        isOptionalNumber(value.cache_read_input_tokens) &&
        isOptionalNumber(value.input_tokens) &&
        isOptionalNumber(value.output_tokens)
      );
    }

    /**
     * Tests whether an unknown assistant message contains validated stream
     * blocks.
     */
    function isClaudeStreamMessage(
      value: unknown,
    ): value is NonNullable<IClaudeStreamEvent["message"]> {
      return (
        isRecord(value) &&
        (value.content === undefined ||
          (Array.isArray(value.content) &&
            value.content.every(isClaudeStreamBlock))) &&
        isOptionalString(value.model) &&
        (value.usage === undefined || isClaudeStreamUsage(value.usage))
      );
    }

    /**
     * Tests whether an unknown per-model usage entry contains a numeric token
     * count.
     */
    function isClaudeModelUsage(
      value: unknown,
    ): value is { outputTokens?: number } {
      return isRecord(value) && isOptionalNumber(value.outputTokens);
    }

    /**
     * Tests whether an unknown model-usage map is safe to rank by output
     * tokens.
     */
    function isClaudeModelUsageMap(
      value: unknown,
    ): value is NonNullable<IClaudeStreamEvent["modelUsage"]> {
      return isRecord(value) && Object.values(value).every(isClaudeModelUsage);
    }

    /**
     * Validates every Claude stream event field consumed by benchmark
     * accounting.
     *
     * Unknown event kinds remain accepted when their common fields are well
     * typed; the parser intentionally ignores those kinds while retaining
     * compatibility with newer Claude CLI streams.
     */
    function isClaudeStreamEvent(value: unknown): value is IClaudeStreamEvent {
      return (
        isRecord(value) &&
        isOptionalNumber(value.duration_ms) &&
        (value.is_error === undefined || typeof value.is_error === "boolean") &&
        (value.message === undefined || isClaudeStreamMessage(value.message)) &&
        isOptionalString(value.model) &&
        (value.modelUsage === undefined ||
          isClaudeModelUsageMap(value.modelUsage)) &&
        isOptionalString(value.result) &&
        isOptionalString(value.subtype) &&
        isOptionalNumber(value.total_cost_usd) &&
        isOptionalString(value.type)
      );
    }

    function parseStream(text: string): ITtscBenchmarkAgentSample {
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
        modelVersion: string | null = null,
        result: IClaudeStreamEvent | null = null,
        lastAssistantText = "";
      const shellCommands: string[] = [];
      for (const raw of text.split("\n")) {
        if (!raw.trim()) continue;
        let parsed: unknown;
        try {
          parsed = JSON.parse(raw);
        } catch {
          continue;
        }
        if (!isClaudeStreamEvent(parsed)) continue;
        const e = parsed;
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
          const textBlocks: string[] = [];
          for (const b of e.message?.content || []) {
            if (b.type === "text" && typeof b.text === "string") {
              textBlocks.push(b.text);
              continue;
            }
            if (b.type !== "tool_use") continue;
            if (b.name === "ToolSearch") continue;
            const toolName = b.name ?? "";
            tools++;
            const input: Record<string, unknown> = b.input ?? {};
            if (sourceToolUse(toolName, input)) sourceTouches++;
            if (toolName === "Read") reads++;
            else if (toolName === "Grep" || toolName === "Glob") grep++;
            else if (
              toolName === "Bash" ||
              toolName === "PowerShell" ||
              toolName === "Shell"
            ) {
              shell++;
              const command =
                typeof input.command === "string" ? input.command : "";
              shellCommands.push(command);
              if (sourceInspectionCommand(command)) shellSource++;
            } else if (graphToolUseName(toolName)) graph++;
            else if (/web/i.test(toolName)) web++;
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
        // its empty sample drags the TtscBenchmarkNumber.median down and the comparison goes garbage.
        ok,
        answer,
        error: result?.is_error
          ? String(result?.result || "").slice(0, 80)
          : "",
      };
    }

    function graphToolUseName(name: string): boolean {
      return /graph|ttsc|codebase|memory|serena|architecture|trace_path|search_code|semantic_query|index_status|list_projects|find_symbol|references|symbols_overview/i.test(
        name,
      );
    }

    /**
     * A tool arm that never called its tool did not measure the tool.
     *
     * A model can decline to open its tool list and answer from the shell
     * instead — GPT-5.6 did it once in a thirty-two cell sweep, and Claude did
     * it in every cell of a sweep where the MCP server was still connecting
     * when the session opened. Either way the run measures a model that did not
     * look, and it does not belong in the table beside the runs that did. The
     * retry loop already re-runs a sample marked `ok: false`, so the rule lives
     * here, with the rest of the arm's validity, rather than in a reader's
     * afterthought over the audit.
     */
    function validateArmSample(
      sample: ITtscBenchmarkAgentSample,
      armName: ITtscBenchmarkAgentSample.Arm,
    ): ITtscBenchmarkAgentSample {
      if (armName === "baseline" || sample == null) return sample;
      if (Number(sample.graph ?? 0) > 0) return sample;
      return {
        ...sample,
        ok: false,
        error:
          "graph arm never called the MCP; the model answered from the shell",
      };
    }

    function runOrThrow(
      command: string,
      commandArgs: string[],
      cwd: string,
      env: NodeJS.ProcessEnv,
    ): string {
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
  }
}
