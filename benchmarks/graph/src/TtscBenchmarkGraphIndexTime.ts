/**
 * Cold index build-time benchmark for the graph tool axis: what _readiness_
 * costs before a tool can answer its first question, per (tool × fixture).
 *
 * The agent benchmark (`src/executable/index.ts`) measures what a question
 * costs once a tool is ready; this runner measures the readiness itself. Per
 * cell it deletes the tool's index, runs its build step once, and takes wall
 * time:
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

import { TtscBenchmarkConstant } from "./TtscBenchmarkConstant.ts";
import { TtscBenchmarkGraph } from "./TtscBenchmarkGraph.ts";
import type { ITtscBenchmarkGraphProject } from "./structures/ITtscBenchmarkGraphProject.ts";

/** Runs and publishes cold graph index build-time benchmarks. */
export namespace TtscBenchmarkGraphIndexTime {
  /**
   * Runs the cold graph index build-time benchmark command.
   *
   * @param entrypointDirectory Directory containing the executable bootstrap.
   */
  export function main(entrypointDirectory: string): void {
    type JsonRecord = Record<string, unknown>;
    type Tool = "ttsc-graph" | "codegraph" | "codebase-memory" | "serena";
    type Command = [command: string, args: string[]];

    interface IParsedArgs {
      values: Record<string, string>;
      flags: Set<string>;
      positional: string[];
    }

    interface IProjectScale {
      files: number;
      lines: number;
    }

    interface IHostSpec {
      os: string;
      kernel: string;
      cpu: string;
      cores: number;
      ramGB: number;
      node: string;
    }

    interface IPublishedIndexCell {
      project: string;
      tool: string;
      buildMs: number;
      mode?: string;
      hasBuildStep?: false;
    }

    interface IIndexCell extends IPublishedIndexCell {
      project: TtscBenchmarkGraph.ProjectName;
      tool: Tool;
    }

    interface IPublishableIndexReport {
      host: IHostSpec;
      scale: Record<string, IProjectScale>;
      cells: IPublishedIndexCell[];
    }

    interface IIndexReport extends IPublishableIndexReport {
      date: string;
      outDir: string;
      tools: Tool[];
      projects: TtscBenchmarkGraph.ProjectName[];
      cells: IIndexCell[];
    }

    interface IRunIndexCellOptions {
      project: TtscBenchmarkGraph.ProjectName;
      spec: ITtscBenchmarkGraphProject;
      repoDir: string;
      tool: Tool;
    }

    interface IRunCheckedOptions {
      label: string;
      logBase: string;
      cwd?: string;
      env?: NodeJS.ProcessEnv;
      discardStdout?: boolean;
      input?: string;
    }

    // Resolved from the package rather than counted up from the bootstrap.
    // Counting was correct only while the executables sat one directory deeper,
    // and it failed silently when they moved: every path below stayed a valid
    // string and pointed one level outside the repository.
    const repoRoot = TtscBenchmarkConstant.REPOSITORY_ROOT;
    const ttscDir = path.join(repoRoot, "packages", "ttsc");
    const workDir = TtscBenchmarkGraph.resolveWorkDir(repoRoot);
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
    const ALL_TOOLS: Tool[] = [
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
    const tools = selectTools(
      parsed.values.tools ?? parsed.values.tool ?? "all",
    );
    const outDir = path.resolve(
      parsed.values.out ?? path.join(workDir, "graph-index", timestamp()),
    );
    const reportPath = path.join(outDir, "report.json");
    const runRoot = path.join(outDir, `.run-${process.pid}`);
    const goCache = path.join(runRoot, "go-cache");
    const goTmp = path.join(runRoot, "go-tmp");

    function cleanupRunRoot(): void {
      fs.rmSync(runRoot, { recursive: true, force: true });
    }

    process.once("exit", cleanupRunRoot);

    if (parsed.flags.has("--list")) {
      for (const project of projectNames()) {
        const spec = TtscBenchmarkGraph.PROJECTS[project];
        process.stdout.write(
          `${project}: ${TtscBenchmarkGraph.projectDir(workDir, spec)} (${spec.tsconfig})\n`,
        );
      }
      process.exit(0);
    }

    // --publish <report.json> folds an already-measured report into the website JSON
    // without rebuilding anything. A tool whose code has not changed since it was
    // timed does not need to be timed again, and re-running it only to refill the
    // same number spends an hour to reproduce it: `@ttsc/graph` is remeasured when
    // its dump changes, and the comparators' cells are republished from the run that
    // measured them on the same quiet host.
    if (parsed.values.publish) {
      publishWebsiteIndex(
        parseIndexReport(loadJson(path.resolve(parsed.values.publish))),
      );
      process.stdout.write(
        `Index-time cells published from ${parsed.values.publish}\n`,
      );
      process.exit(0);
    }

    if (selected.length === 0) {
      throw new Error(
        "index-time benchmark requires --project <name> or --all",
      );
    }

    // Quiet-host gate, mirrored from the performance runner: a cold build is one sample
    // with no median to hide behind, so a noisy host corrupts the cell outright.
    // Warns by default, aborts under TTSC_BENCH_REQUIRE_QUIET=1 (set it for every
    // publication run), and is silenced by TTSC_BENCH_SKIP_LOAD_CHECK=1. Note
    // os.loadavg() reports zeros on Windows, so the gate only bites on POSIX
    // hosts; on Windows quietness stays the operator's responsibility.
    if (process.env.TTSC_BENCH_SKIP_LOAD_CHECK !== "1") {
      const cpuCount = Math.max(os.cpus().length, 1);
      const load1 = os.loadavg()[0] ?? 0;
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
    fs.mkdirSync(goCache, { recursive: true });
    fs.mkdirSync(goTmp, { recursive: true });

    if (!parsed.flags.has("--no-setup")) {
      ensureFixtures(selected);
    }

    // The dump binary is built once, untimed: compiling the Go tool is packaging
    // cost paid when @ttsc/graph is installed, not readiness cost a project pays.
    // What IS timed per fixture is the dump run the launcher performs at startup.
    const dumpBinary = tools.includes(TOOL_TTSC) ? buildDumpBinary() : null;

    const report: IIndexReport = {
      date: new Date().toISOString(),
      outDir,
      tools,
      projects: selected,
      host: hostSpec(),
      scale: {},
      cells: [],
    };

    for (const project of selected) {
      const spec = TtscBenchmarkGraph.PROJECTS[project];
      const repoDir = TtscBenchmarkGraph.projectDir(workDir, spec);
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
    process.off("exit", cleanupRunRoot);
    cleanupRunRoot();
    process.stdout.write(
      `\nIndex-time benchmark report: ${path.relative(repoRoot, reportPath)}\n`,
    );
    if (!parsed.flags.has("--no-website")) {
      process.stdout.write(
        `Index-time benchmark website JSON: ${path.relative(repoRoot, websiteJson)}\n`,
      );
    }

    function runIndexCell({
      project,
      spec,
      repoDir,
      tool,
    }: IRunIndexCellOptions): IIndexCell {
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
        if (dumpBinary === null)
          throw new Error("ttsc-graph dump binary was not built");
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

    function buildDumpBinary(): string {
      const binary = path.join(
        runRoot,
        `ttscgraph-index${process.platform === "win32" ? ".exe" : ""}`,
      );
      const goRoot = path.join(os.homedir(), "go-sdk", "go", "bin");
      process.stdout.write("[index-time] building ttscgraph dump binary\n");
      timeChecked("go", ["build", "-o", binary, "./cmd/ttscgraph"], {
        label: "go build ttscgraph",
        logBase: path.join(outDir, "go-build-ttscgraph"),
        cwd: ttscDir,
        env: {
          GOCACHE: goCache,
          GOTMPDIR: goTmp,
          ...(fs.existsSync(goRoot)
            ? { PATH: `${goRoot}${path.delimiter}${process.env.PATH ?? ""}` }
            : {}),
        },
      });
      return binary;
    }

    function measureScale(
      project: TtscBenchmarkGraph.ProjectName,
      repoDir: string,
    ): IProjectScale {
      const listed = cp.spawnSync(
        "git",
        [
          "-C",
          repoDir,
          "ls-files",
          "-z",
          "--",
          "*.ts",
          "*.tsx",
          "*.mts",
          "*.cts",
        ],
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
    function hostSpec(): IHostSpec {
      const cpus = os.cpus();
      let osName = `${os.type()} ${os.release()}`;
      try {
        const pretty = fs
          .readFileSync("/etc/os-release", "utf8")
          .match(/^PRETTY_NAME="?([^"\n]+)"?/m);
        if (pretty?.[1]) osName = pretty[1];
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

    function publishWebsiteIndex(currentReport: IPublishableIndexReport): void {
      if (parsed.flags.has("--no-website")) return;
      const priorInput = fs.existsSync(websiteJson)
        ? loadJson(websiteJson)
        : null;
      if (priorInput !== null && !isJsonRecord(priorInput))
        throw new TypeError(`invalid graph website report: ${websiteJson}`);
      const prior = asJsonRecord(priorInput);
      const keepPrior = !parsed.flags.has("--reset-index");
      const priorIndexInput = keepPrior ? prior?.index : undefined;
      if (
        priorIndexInput !== undefined &&
        priorIndexInput !== null &&
        !isJsonRecord(priorIndexInput)
      ) {
        throw new TypeError(`invalid graph website index: ${websiteJson}`);
      }
      const priorIndex = asJsonRecord(priorIndexInput);
      const scale = {
        ...parseScale(
          priorIndex?.scale,
          "graph website index scale",
          priorIndex !== undefined,
        ),
        ...currentReport.scale,
      };
      const cells = [
        ...parseIndexCells(
          priorIndex?.cells,
          "graph website index cells",
          priorIndex !== undefined,
        ),
      ];
      for (const cell of currentReport.cells) {
        const at = cells.findIndex(
          (old) => old.project === cell.project && old.tool === cell.tool,
        );
        if (at >= 0) cells[at] = cell;
        else cells.push(cell);
      }
      const out = {
        ...(prior ?? {}),
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

    function printCellSummary(
      project: TtscBenchmarkGraph.ProjectName,
      cell: IIndexCell,
    ): void {
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

    function timeChecked(
      command: string,
      args: string[],
      options: IRunCheckedOptions,
    ): number {
      const start = process.hrtime.bigint();
      runChecked(command, args, options);
      return Number(process.hrtime.bigint() - start) / 1e6;
    }

    function runChecked(
      command: string,
      args: string[],
      {
        label,
        logBase,
        cwd = repoRoot,
        env = {},
        discardStdout = false,
        input,
      }: IRunCheckedOptions,
    ): void {
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

    function codegraphCommand(args: string[]): Command {
      if (process.platform !== "win32") return ["codegraph", args];
      return ["cmd.exe", ["/d", "/s", "/c", "codegraph", ...args]];
    }

    // serena is launched the way the agent harness launches it: through uvx, from
    // its git source, so the measured tool is the one the agent cells talked to.
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

    function codebaseMemoryCommand(args: string[]): Command {
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

    function ensureLocalIgnored(repoDir: string, entry: string): void {
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

    function cleanupInsideFixture(repoDir: string, name: string): void {
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

    function ensureFixtures(projects: TtscBenchmarkGraph.ProjectName[]): void {
      for (const project of projects) {
        const spec = TtscBenchmarkGraph.PROJECTS[project];
        const repoDir = TtscBenchmarkGraph.projectDir(workDir, spec);
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
          if (!fs.existsSync(path.join(repoDir, ".git")))
            throw new Error(`${repoDir} exists but is not a git checkout`);
          process.stdout.write(`[index-time] reusing fixture ${project}\n`);
          refreshFixture(project, spec, repoDir);
        }
        // ttsc-graph resolves modules through node_modules; an uninstalled
        // fixture loads a different (smaller) program and times a different job.
        ensureInstalled(repoDir);
      }
    }

    function refreshFixture(
      project: TtscBenchmarkGraph.ProjectName,
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

    function ensureInstalled(repoDir: string): void {
      if (parsed.flags.has("--no-install")) return;
      const plan = installPlan(repoDir);
      if (!plan) return;
      runChecked(plan.command, plan.args, {
        label: `install fixture dependencies (${plan.label})`,
        logBase: path.join(outDir, `setup-${path.basename(repoDir)}-install`),
        cwd: repoDir,
      });
    }

    function installPlan(repoDir: string): {
      label: string;
      command: string;
      args: string[];
    } | null {
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

    function packageCommand(
      command: string,
      args: string[],
    ): { label: string; command: string; args: string[] } {
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

    function selectTools(value: string): Tool[] {
      const names = splitList(value);
      const expanded = names.includes("all")
        ? ALL_TOOLS
        : names.map((name) =>
            name === "codebase-memory-mcp" ? TOOL_CODEBASE_MEMORY : name,
          );
      if (expanded.length === 0)
        throw new Error(
          "--tools must contain ttsc-graph, codegraph, codebase-memory, serena, or all",
        );
      for (const name of expanded) {
        if (!isTool(name))
          throw new Error(
            "--tools must contain ttsc-graph, codegraph, codebase-memory, serena, or all",
          );
      }
      return [...new Set(expanded.filter(isTool))];
    }

    function selectProjects({
      flags,
      values,
      positional,
    }: IParsedArgs): TtscBenchmarkGraph.ProjectName[] {
      const explicit = [...splitList(values.project ?? ""), ...positional];
      const names = flags.has("--all") ? projectNames() : explicit;
      const selectedNames: TtscBenchmarkGraph.ProjectName[] = [];
      for (const name of names) {
        if (!isProjectName(name))
          throw new Error(
            `unknown project ${name}; choose ${Object.keys(TtscBenchmarkGraph.PROJECTS).join(", ")}`,
          );
        selectedNames.push(name);
      }
      return [...new Set(selectedNames)];
    }

    function parseArgs(argv: string[]): IParsedArgs {
      const values: Record<string, string> = {};
      const flags = new Set<string>();
      const positional: string[] = [];
      const valueOptions = new Set([
        "project",
        "tools",
        "tool",
        "out",
        "publish",
        "serena-command",
        "serena-source",
        "codebase-memory-binary",
        "cbm-binary",
      ]);
      for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === undefined) continue;
        if (arg.startsWith("--")) {
          const match = /^--([^=]+)=(.*)$/.exec(arg);
          const key = match?.[1];
          const value = match?.[2];
          if (key !== undefined && value !== undefined) {
            if (value.length === 0)
              throw new Error(`option --${key} requires a value`);
            values[key] =
              key === "project" ? appendCsv(values.project, value) : value;
            continue;
          }
          const option = arg.slice(2);
          if (!valueOptions.has(option)) {
            flags.add(arg);
            continue;
          }
          const next = argv[++i];
          if (next === undefined || next.startsWith("--"))
            throw new Error(`option ${arg} requires a value`);
          values[option] =
            option === "project" ? appendCsv(values.project, next) : next;
        } else {
          positional.push(arg);
        }
      }
      return { values, flags, positional };
    }

    function appendCsv(
      left: string | undefined,
      right: string | undefined,
    ): string {
      return [left, right].filter(Boolean).join(",");
    }

    function splitList(value: string): string[] {
      return String(value)
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
    }

    function filenamePart(value: string): string {
      return String(value).replace(/[^a-zA-Z0-9._-]+/g, "_");
    }

    function isJsonRecord(value: unknown): value is JsonRecord {
      return (
        typeof value === "object" && value !== null && !Array.isArray(value)
      );
    }

    function asJsonRecord(value: unknown): JsonRecord | undefined {
      return isJsonRecord(value) ? value : undefined;
    }

    function isTool(value: string): value is Tool {
      return (
        value === TOOL_TTSC ||
        value === TOOL_CODEGRAPH ||
        value === TOOL_CODEBASE_MEMORY ||
        value === TOOL_SERENA
      );
    }

    function isProjectName(
      value: string,
    ): value is TtscBenchmarkGraph.ProjectName {
      return Object.prototype.hasOwnProperty.call(
        TtscBenchmarkGraph.PROJECTS,
        value,
      );
    }

    function projectNames(): TtscBenchmarkGraph.ProjectName[] {
      return Object.keys(TtscBenchmarkGraph.PROJECTS).filter(isProjectName);
    }

    function isHostSpec(value: unknown): value is IHostSpec {
      if (!isJsonRecord(value)) return false;
      return (
        typeof value.os === "string" &&
        typeof value.kernel === "string" &&
        typeof value.cpu === "string" &&
        typeof value.cores === "number" &&
        typeof value.ramGB === "number" &&
        typeof value.node === "string"
      );
    }

    function isProjectScale(value: unknown): value is IProjectScale {
      return (
        isJsonRecord(value) &&
        typeof value.files === "number" &&
        Number.isInteger(value.files) &&
        value.files >= 0 &&
        typeof value.lines === "number" &&
        Number.isInteger(value.lines) &&
        value.lines >= 0
      );
    }

    function parseScale(
      value: unknown,
      label: string,
      required: boolean,
    ): Record<string, IProjectScale> {
      if (value === undefined && !required) return {};
      if (!isJsonRecord(value))
        throw new TypeError(`invalid ${label}: expected an object`);
      const scale: Record<string, IProjectScale> = {};
      for (const [project, entry] of Object.entries(value)) {
        if (!isProjectScale(entry))
          throw new TypeError(`invalid ${label} entry: ${project}`);
        scale[project] = entry;
      }
      return scale;
    }

    function isPublishedIndexCell(
      value: unknown,
    ): value is IPublishedIndexCell {
      if (!isJsonRecord(value)) return false;
      return (
        typeof value.project === "string" &&
        typeof value.tool === "string" &&
        typeof value.buildMs === "number" &&
        Number.isFinite(value.buildMs) &&
        value.buildMs >= 0 &&
        (value.mode === undefined || typeof value.mode === "string") &&
        (value.hasBuildStep === undefined || value.hasBuildStep === false)
      );
    }

    function parseIndexCells(
      value: unknown,
      label: string,
      required: boolean,
    ): IPublishedIndexCell[] {
      if (value === undefined && !required) return [];
      if (!Array.isArray(value))
        throw new TypeError(`invalid ${label}: expected an array`);
      for (const [index, cell] of value.entries())
        if (!isPublishedIndexCell(cell))
          throw new TypeError(`invalid ${label} entry: ${index}`);
      return value.filter(isPublishedIndexCell);
    }

    function parseIndexReport(value: unknown): IPublishableIndexReport {
      if (!isJsonRecord(value) || !isHostSpec(value.host)) {
        throw new Error("invalid index-time report");
      }
      return {
        host: value.host,
        scale: parseScale(value.scale, "index-time report scale", true),
        cells: parseIndexCells(value.cells, "index-time report cells", true),
      };
    }

    function loadJson(file: string): unknown {
      try {
        const value: unknown = JSON.parse(fs.readFileSync(file, "utf8"));
        return value;
      } catch {
        return null;
      }
    }

    function timestamp(): string {
      return new Date().toISOString().replace(/[-:]/g, "").replace(/\..+$/, "");
    }

    function writeJson(file: string, value: unknown): void {
      fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
    }
  }
}
