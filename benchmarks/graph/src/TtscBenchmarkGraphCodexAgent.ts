// Agent-cost A/B for @ttsc/graph driven by OpenAI's `codex` CLI, the
// cross-model companion to agent-ab.ts (which drives Claude). Same codegraph
// methodology: one structural question per repo, run twice — once with the
// @ttsc/graph MCP server, once with no MCP — and report tokens (summed per turn),
// tool calls, and wall time, TtscBenchmarkNumber.median over N runs.
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
//   pnpm --dir benchmarks/graph run agent:codex -- --prompt-family=dedicated --repo=excalidraw --runs=4
//   pnpm --dir benchmarks/graph run agent:codex -- --prompt-family=common --repo=vscode --runs=4
//   pnpm --dir benchmarks/graph run agent:codex -- --prompt-id=typeorm-dedicated-v1 --runs=4
import cp from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { TtscBenchmarkCommandLine } from "./TtscBenchmarkCommandLine.ts";
import { TtscBenchmarkConstant } from "./TtscBenchmarkConstant.ts";
import { TtscBenchmarkGraph } from "./TtscBenchmarkGraph.ts";
import { TtscBenchmarkNumber } from "./TtscBenchmarkNumber.ts";
import { TtscBenchmarkObject } from "./TtscBenchmarkObject.ts";
import type { ITtscBenchmarkAgentSample } from "./structures/ITtscBenchmarkAgentSample.ts";
import type { ITtscBenchmarkGraphPrompt } from "./structures/ITtscBenchmarkGraphPrompt.ts";
import type { ITtscBenchmarkGraphRepository } from "./structures/ITtscBenchmarkGraphRepository.ts";
import type { TtscBenchmarkProcess } from "./structures/TtscBenchmarkProcess.ts";

/**
 * OpenAI Codex A/B harness for graph-assisted repository exploration.
 *
 * The namespace owns the complete process lifecycle so the executable wrapper
 * remains export-free while the benchmark logic stays reusable and testable.
 */
export namespace TtscBenchmarkGraphCodexAgent {
  /**
   * Runs the Codex baseline-versus-graph benchmark from its executable
   * entrypoint.
   *
   * All CLI parsing, output paths, trace metrics, comparator setup, and
   * temporary-resource cleanup retain the original executable behavior.
   */
  export async function main(): Promise<void> {
    await execute();
  }

  async function execute(): Promise<void> {
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
      path.join(os.tmpdir(), "ttsc-benchmark-codex-"),
    );

    function cleanupRunRoot(): void {
      fs.rmSync(runRoot, { recursive: true, force: true });
    }

    process.once("exit", cleanupRunRoot);

    /**
     * Loads and validates the reusable prompt manifest.
     *
     * JSON parsing deliberately yields `unknown`: a syntactically valid but
     * structurally invalid manifest must stop the benchmark before it can
     * select a wrong fixture, question, or provenance hash.
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
      input: unknown,
    ): input is ITtscBenchmarkGraphPrompt.IManifest {
      return (
        TtscBenchmarkObject.isRecord(input) &&
        input.schemaVersion === 1 &&
        Array.isArray(input.prompts) &&
        input.prompts.every(isGraphBenchmarkPrompt)
      );
    }

    /**
     * Tests whether an unknown manifest entry contains one complete graph
     * prompt.
     */
    function isGraphBenchmarkPrompt(
      input: unknown,
    ): input is ITtscBenchmarkGraphPrompt.IManifest["prompts"][number] {
      return (
        TtscBenchmarkObject.isRecord(input) &&
        typeof input.id === "string" &&
        typeof input.repo === "string" &&
        (input.family === "common" || input.family === "dedicated") &&
        typeof input.file === "string" &&
        (input.fixtureBranch === undefined ||
          input.fixtureBranch === "graph") &&
        typeof input.tsconfig === "string" &&
        typeof input.questionSha256 === "string" &&
        /^[0-9a-f]{64}$/.test(input.questionSha256)
      );
    }

    /**
     * Resolves and verifies one manifest-backed prompt selected by the CLI.
     *
     * The question path must remain physically inside
     * `TtscBenchmarkConstant.QUESTIONS_ROOT`, including after symlink
     * resolution. Its raw file contents must match the manifest hash before the
     * trimmed question enters a measured agent run.
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
      const questionFile = resolveQuestionFile(entry.file);
      const source = fs.readFileSync(questionFile, "utf8");
      const questionSha256 = crypto
        .createHash("sha256")
        .update(source)
        .digest("hex");
      if (questionSha256 !== entry.questionSha256) {
        throw new Error(
          `graph benchmark question hash mismatch for ${entry.file}: expected ${entry.questionSha256}, received ${questionSha256}`,
        );
      }
      return {
        entry,
        text: source.trim(),
        questionSha256,
      };
    }

    /**
     * Resolves a manifest question path without permitting lexical or symlink
     * escapes from the benchmark's question corpus.
     */
    function resolveQuestionFile(file: string): string {
      const lexicalRoot = path.resolve(TtscBenchmarkConstant.QUESTIONS_ROOT);
      const lexicalFile = path.resolve(lexicalRoot, file);
      if (!isPathInside(lexicalRoot, lexicalFile)) {
        throw new Error(`graph benchmark question escapes its root: ${file}`);
      }
      const physicalRoot = fs.realpathSync(lexicalRoot);
      const physicalFile = fs.realpathSync(lexicalFile);
      if (!isPathInside(physicalRoot, physicalFile)) {
        throw new Error(`graph benchmark question escapes its root: ${file}`);
      }
      return physicalFile;
    }

    /**
     * Tests whether a resolved target is a strict descendant of a resolved
     * root.
     */
    function isPathInside(root: string, target: string): boolean {
      const relative = path.relative(root, target);
      return (
        relative !== "" &&
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
    // question and pins the repo, fixtureBranch, and tsconfig. Resolve it first so it
    // can fill --repo when only --prompt-id is given.
    const manifestPrompt = resolveManifestPrompt(args);
    const repoKey: string =
      args.repo ?? manifestPrompt?.entry.repo ?? "excalidraw";
    const spec: ITtscBenchmarkGraphRepository = repositoryOf(repoKey);
    const runs: number = TtscBenchmarkNumber.parsePositive(
      args.runs ?? "2",
      "--runs",
    );
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
      args["mcp-startup-timeout-sec"] ??
        process.env.CODEX_MCP_STARTUP_TIMEOUT_SEC,
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
    // once to build the resident graph. The Go binary is dump-only now; the MCP server
    // is the Node launcher.
    const binary = path.join(
      runRoot,
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

    // 3. The graph server is the Node launcher run over stdio; it shells out to the
    // dump binary (pointed at via TTSC_GRAPH_BINARY) on the first tool call, then
    // answers later tool calls from the resident graph. The launcher has no
    // daemon/port mode — its single type-check stays inside the measured cell — so
    // there is no --daemon path.
    const launcherArgs = [
      graphLauncher,
      "--cwd",
      repoDir,
      "--tsconfig",
      tsconfig,
    ];

    // 4. Two minimal CODEX_HOMEs: identical except the graph one configures the MCP
    // server. Both copy the real auth.json so codex stays logged in.
    const realHome = path.join(os.homedir(), ".codex");
    const withHome = armsRequested.graph
      ? makeCodexHome("with", cg || cbm || serena ? [] : launcherArgs)
      : null;
    const withoutHome = armsRequested.baseline
      ? makeCodexHome("without", null)
      : null;
    const arms: Array<{ name: ITtscBenchmarkAgentSample.Arm; home: string }> = [
      { name: "baseline", home: withoutHome },
      { name: "graph", home: withHome },
    ].filter(
      (arm): arm is { name: ITtscBenchmarkAgentSample.Arm; home: string } =>
        arm.home !== null,
    );

    console.log(
      `\ncodegraph A/B on ${repoKey} via codex — model ${model} (effort ${effort}), ${runs} run(s) x ${arms.length} arms` +
        (promptId ? `, prompt ${promptId}` : "") +
        (fixtureBranch ? `, fixture ${fixtureBranch}` : ""),
    );
    console.log(`Q: ${question}\n`);

    const reportName = "agent-ab-codex-report.json";
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

    const MAX_RUN_RETRIES = TtscBenchmarkNumber.parseNonNegative(
      args["max-run-retries"] ?? "4",
      "--max-run-retries",
    );
    const samples: Record<
      ITtscBenchmarkAgentSample.Arm,
      ITtscBenchmarkAgentSample[]
    > = {
      baseline: [],
      graph: [],
    };
    // Launch arms x runs concurrently, capped at TTSC_BENCH_CONCURRENCY (default
    // unlimited). A high cap is fastest for experiment iteration; a low cap keeps the
    // host quiet enough that per-run timings and token counts settle. Each invocation
    // is its own codex process with its own CODEX_HOME and trace file.
    const concurrency = Number(process.env.TTSC_BENCH_CONCURRENCY) || Infinity;
    const thunks: Array<() => Promise<void>> = arms.flatMap((arm) =>
      Array.from({ length: runs }, (_, r) => async () => {
        // Retry zero-token infrastructure failures, incomplete answers, and graph
        // arms that never called their mounted MCP. Shell source reads remain
        // measured behavior once the MCP was actually used. The trace file is keyed
        // by run number, so a retry overwrites the prior attempt.
        let m: ITtscBenchmarkAgentSample | undefined;
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
              `  ${arm.name.padEnd(8)} run ${r + 1}: [FAILED]${m?.error ? ` ${m.error}` : ""} retrying (${attempt + 1}/${MAX_RUN_RETRIES})`,
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

    console.log(
      `\nMedian of ${runs} run(s), codegraph metrics, codex/${model}:`,
    );
    const printLine: MetricPrinter =
      armsRequested.baseline && armsRequested.graph
        ? printComparisonLine
        : armsRequested.baseline
          ? printBaselineLine
          : printGraphLine;
    printLine("tokens", "tokens");
    printLine("tool calls", "tools");
    printLine(
      "wall time",
      "durMs",
      (value: number) => `${(value / 1000).toFixed(0)}s`,
    );

    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(
      reportPath,
      `${JSON.stringify({ tool: graphToolName(), ...(toolSetupMs !== undefined ? { toolSetupMs } : {}), repo: repoKey, fixtureBranch, repoDir, model, effort, ...(promptId ? { promptId } : {}), promptFamily, ...(manifestPrompt?.questionSha256 ? { questionSha256: manifestPrompt.questionSha256 } : {}), daemon: false, runs, question, traceDir, samples }, null, 2)}\n`,
    );
    process.off("exit", cleanupRunRoot);
    cleanupRunRoot();

    // makeCodexHome builds a throwaway CODEX_HOME: the real auth.json plus a minimal
    // config.toml pinning the model and effort, and (for the graph arm) the
    // @ttsc/graph MCP server. The server is `node <launcher> --cwd ... --tsconfig ...`
    // with TTSC_GRAPH_BINARY pointing at the dump binary, so codex spawns the same
    // launcher the Claude harness configures. TOML literal strings ('...') carry
    // Windows paths verbatim with no escaping.
    function makeCodexHome(tag: string, serverArgs: string[] | null): string {
      const home = path.join(runRoot, `codex-home-${tag}`);
      fs.mkdirSync(home, { recursive: true });
      fs.copyFileSync(
        path.join(realHome, "auth.json"),
        path.join(home, "auth.json"),
      );
      let toml = `model = '${model}'\nmodel_reasoning_effort = '${effort}'\nweb_search = 'disabled'\n`;
      if (serverArgs) {
        if (cg) {
          const command =
            process.platform === "win32" ? "cmd.exe" : "codegraph";
          const a = codegraphServerArgs(repoDir)
            .map((value: string) => `'${value}'`)
            .join(", ");
          toml += `\n[mcp_servers.codegraph]\ncommand = '${command}'\nargs = [${a}]\nenv = { CODEGRAPH_NO_DAEMON = "1" }\nrequired = true\n${mcpTimeoutConfigToml()}`;
        } else if (cbm) {
          const envParts = [`CBM_LOG_LEVEL = "warn"`];
          if (cbmCacheDir) envParts.unshift(`CBM_CACHE_DIR = '${cbmCacheDir}'`);
          toml += `\n[mcp_servers.codebase_memory]\ncommand = '${cbmCommand}'\nargs = []\nenv = { ${envParts.join(", ")} }\nrequired = true\n${mcpTimeoutConfigToml()}`;
        } else if (serena) {
          const argList = serenaServerArgs(repoDir)
            .map((value: string) => `'${value}'`)
            .join(", ");
          toml += `\n[mcp_servers.serena]\ncommand = '${serenaCommand}'\nargs = [${argList}]\nrequired = true\n${mcpTimeoutConfigToml()}`;
        } else {
          const argList = serverArgs
            .map((value: string) => `'${value}'`)
            .join(", ");
          toml += `\n[mcp_servers.ttscgraph]\ncommand = '${process.execPath}'\nargs = [${argList}]\nenv = { TTSC_GRAPH_BINARY = '${binary}' }\nrequired = true\n${mcpTimeoutConfigToml()}`;
        }
      }
      validateMcpConfig(toml);
      fs.writeFileSync(path.join(home, "config.toml"), toml);
      return home;
    }

    function validateMcpConfig(toml: string): void {
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

    function graphToolName(): string {
      if (cg) return "codegraph";
      if (cbm) return "codebase-memory";
      if (serena) return "serena";
      return "ttsc-graph";
    }

    function commandPath(command: string): string {
      return path.isAbsolute(command) || /[\\/]/.test(command)
        ? path.resolve(command)
        : command;
    }

    function mcpTimeoutConfigToml(): string {
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

    function codegraphServerArgs(targetRepoDir: string): string[] {
      const args = ["serve", "--mcp", "--path", targetRepoDir];
      return process.platform === "win32"
        ? ["/d", "/s", "/c", "codegraph", ...args]
        : args;
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

    /**
     * Parses configured Serena arguments and expands repository placeholders.
     *
     * A value beginning with `[` is explicitly JSON and must be a string array;
     * other values retain the existing shell-like tokenizer used by environment
     * configuration.
     */
    function parseConfiguredArgs(raw: string, targetRepoDir: string): string[] {
      let parsed: string[] | undefined;
      if (raw.trimStart().startsWith("[")) {
        const json: unknown = JSON.parse(raw);
        if (!isStringArray(json)) {
          throw new Error("--serena-args JSON must be a string array");
        }
        parsed = json;
      } else {
        parsed = raw
          .match(/"[^"]*"|'[^']*'|\S+/g)
          ?.map((part: string) => part.replace(/^(['"])(.*)\1$/, "$2"));
      }
      if (parsed === undefined) {
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

    /** Tests whether a parsed configuration value is composed only of strings. */
    function isStringArray(input: unknown): input is string[] {
      return (
        Array.isArray(input) && input.every((part) => typeof part === "string")
      );
    }

    function promptForArm(
      baseQuestion: string,
      armName: ITtscBenchmarkAgentSample.Arm,
    ): string {
      // The baseline arm is sent to the code, because memory of a famous repository
      // is not a baseline (see TtscBenchmarkGraph.GROUNDING). An arm whose facts come from this
      // checkout's compiler needs no such warning.
      if (armName === "baseline")
        return `${baseQuestion}\n\n${TtscBenchmarkGraph.GROUNDING}`;
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
      return `${baseQuestion}\n\n${TtscBenchmarkGraph.TOOL_NUDGE}`;
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

    function optionalNonNegativeInteger(
      value: string | undefined,
      label: string,
    ): number | undefined {
      if (value === undefined || value === "") return undefined;
      return TtscBenchmarkNumber.parseNonNegative(value, label);
    }

    function sourceInspectionCommand(command: string): boolean {
      return (
        /\b(git\s+grep|rg|grep|Select-String|findstr)\b/i.test(command) ||
        /\b(Get-Content|gc|cat|type|sed|awk|head|tail)\b/i.test(command) ||
        (/\b(git\s+ls-files|Get-ChildItem|gci|ls|dir)\b/i.test(command) &&
          /\b(src|packages|apps|lib|server|client|test|\.tsx?|\.jsx?)\b/i.test(
            command,
          ))
      );
    }

    async function runCodex(
      question: string,
      codexHome: string,
      armName: ITtscBenchmarkAgentSample.Arm,
      runNumber: number,
    ): Promise<ITtscBenchmarkAgentSample> {
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
    function spawnAsync(
      command: string,
      commandArgs: string[],
      { input, ...spawnOpts }: TtscBenchmarkProcess.ISpawnOptions,
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
        child.on("close", (status, signal) =>
          resolve({ stdout, stderr, status, signal }),
        );
        if (input) {
          child.stdin?.write(input);
          child.stdin?.end();
        }
      });
    }

    interface ICodexStreamItem {
      command?: string;
      text?: string;
      type: string;
    }

    interface ICodexItemCompletedEvent {
      item: ICodexStreamItem;
      type: "item.completed";
    }

    interface ICodexTurnCompletedEvent {
      type: "turn.completed";
      usage: ICodexStreamUsage;
    }

    type ICodexStreamEvent =
      | ICodexItemCompletedEvent
      | ICodexTurnCompletedEvent;

    interface ICodexStreamUsage {
      cached_input_tokens?: number;
      input_tokens?: number;
      output_tokens?: number;
      reasoning_output_tokens?: number;
    }

    interface ICodexTurnUsage {
      cachedInput: number;
      input: number;
      output: number;
      reasoning: number;
    }

    /**
     * Tests whether an unknown JSONL value is a measured Codex stream event.
     *
     * Unrelated event kinds are ignored. Measured kinds fail closed unless
     * their nested payloads have the types required by the token and tool-call
     * metrics.
     */
    function isCodexStreamEvent(input: unknown): input is ICodexStreamEvent {
      if (!TtscBenchmarkObject.isRecord(input)) return false;
      if (input.type === "turn.completed") {
        return isCodexStreamUsage(input.usage);
      }
      if (input.type === "item.completed") {
        return isCodexStreamItem(input.item);
      }
      return false;
    }

    /**
     * Tests whether a completed Codex item has the fields needed by its item
     * kind.
     */
    function isCodexStreamItem(input: unknown): input is ICodexStreamItem {
      if (
        !TtscBenchmarkObject.isRecord(input) ||
        typeof input.type !== "string"
      )
        return false;
      if (input.command !== undefined && typeof input.command !== "string") {
        return false;
      }
      if (input.text !== undefined && typeof input.text !== "string")
        return false;
      if (
        input.type === "command_execution" &&
        typeof input.command !== "string"
      ) {
        return false;
      }
      if (input.type === "agent_message" && typeof input.text !== "string") {
        return false;
      }
      return true;
    }

    /** Tests whether a turn usage payload contains only valid token counters. */
    function isCodexStreamUsage(input: unknown): input is ICodexStreamUsage {
      return (
        TtscBenchmarkObject.isRecord(input) &&
        isOptionalTokenCount(input.cached_input_tokens) &&
        isOptionalTokenCount(input.input_tokens) &&
        isOptionalTokenCount(input.output_tokens) &&
        isOptionalTokenCount(input.reasoning_output_tokens)
      );
    }

    /** Tests an optional token counter without coercing malformed JSON values. */
    function isOptionalTokenCount(input: unknown): input is number | undefined {
      return (
        input === undefined ||
        (typeof input === "number" && Number.isSafeInteger(input) && input >= 0)
      );
    }

    /**
     * Aggregates usage and tool-call metrics from a Codex JSONL trace.
     *
     * Malformed JSON and events that fail structural validation are ignored, so
     * untrusted CLI output cannot be coerced into a successful benchmark
     * sample.
     */
    function parseStream(
      text: string,
      durMs: number,
    ): ITtscBenchmarkAgentSample {
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
      const usage: ICodexTurnUsage[] = [];
      const types: Record<string, number> = {};
      const shellCommands: string[] = [];
      for (const raw of text.split("\n")) {
        if (!raw.trim()) continue;
        let parsed: unknown;
        try {
          parsed = JSON.parse(raw);
        } catch {
          continue;
        }
        if (!isCodexStreamEvent(parsed)) continue;
        const e = parsed;
        if (e.type === "turn.completed") {
          completed = true;
          const u = e.usage;
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
        } else {
          const it = e.item;
          const t = it.type;
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

    /**
     * A tool arm that never called its tool did not measure the tool.
     *
     * GPT-5.6 does not always open the tool list. Asked how RxJS carries a
     * value from `subscribe` through the operators, it opened with "I'll trace
     * the subscription path through the repository's implementation" and ran
     * ten PowerShell commands, never naming the MCP once — the server was
     * mounted, the other seven repositories of the same sweep called it twice
     * each, and the prompt carried the same tool line they did. Re-run, the
     * same cell called the graph twice, opened no file, and spent 72,174 tokens
     * against the 153,954 it had spent shelling.
     *
     * That first run is not a measurement of the tool that goes in the table
     * beside the runs that used it; it is a measurement of a model that did not
     * look. The retry loop already re-runs a sample it marks `ok: false`, so
     * the rule is simply written down here, where the rest of the arm's
     * validity lives, rather than left to a reader of the audit to notice
     * afterwards.
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
        shell: command === "codex",
      });
      if (result.error) throw result.error;
      if (result.status !== 0)
        throw new Error(
          `${command} ${commandArgs.join(" ")} failed (${result.status})\n${result.stderr ?? ""}`,
        );
      return result.stdout ?? "";
    }

    function oneLine(value: unknown): string {
      return String(value).replace(/\s+/g, " ").trim();
    }
  }
}
