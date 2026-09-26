import { spawnSync } from "node:child_process";
import type { SpawnSyncReturns } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { TtscBenchmarkConstant } from "./TtscBenchmarkConstant.ts";
import type { ITtscBenchmarkPerformanceCommand } from "./structures/ITtscBenchmarkPerformanceCommand.ts";
import type { ITtscBenchmarkPerformanceProject } from "./structures/ITtscBenchmarkPerformanceProject.ts";

/**
 * Owns child-process execution and the process-wide tsconfig file cache.
 *
 * One instance must be shared by warmups and measured runs. Command
 * materialization deliberately completes before `run()` starts its timer.
 */
export class TtscBenchmarkPerformanceProcess {
  /** Minimal workspace manifest used for standalone pnpm fixture installs. */
  private static readonly GENERATED_PNPM_WORKSPACE = 'packages:\n  - "."\n';

  private readonly tsconfigFileArgumentsCache: Map<string, string> = new Map<
    string,
    string
  >();

  /**
   * Creates the process-wide command runner shared by setup, warmups, and
   * measured cells.
   *
   * @param options Executable helper path and child-output policy.
   */
  public constructor(
    private readonly options: TtscBenchmarkPerformanceProcess.IOptions,
  ) {}

  /** Resolves a project command for pnpm workspace and Windows Yarn rules. */
  public commandForProject(cmd: string, root: string): string {
    let resolved: string = cmd;
    if (/^pnpm\b/.test(resolved) && !this.ownsPnpmWorkspace(root)) {
      if (!/^pnpm\s+--ignore-workspace\b/.test(resolved))
        resolved = resolved.replace(/^pnpm\b/, "pnpm --ignore-workspace");
    }
    return this.resolveYarnCommand(resolved);
  }

  /**
   * Renders one step for execution or list output.
   *
   * List mode preserves the helper command substitution without running it.
   */
  public commandForStep(
    step: ITtscBenchmarkPerformanceCommand,
    root: string,
    mode: "execute" | "list",
  ): string {
    const cmd: string = this.commandForProject(step.cmd, root);
    if (step.tsconfigProjects === undefined) return cmd;
    const cwd: string = path.resolve(root, step.cwd ?? ".");
    const fileArguments: string =
      mode === "list"
        ? `$(${this.tsconfigFilesCommand(step.tsconfigProjects, "--shell")})`
        : this.resolveTsconfigFileArguments(
            cwd,
            step.tsconfigProjects,
            step.env,
          );
    return `${cmd} ${fileArguments}`;
  }

  /** Creates a pnpm command that respects a fixture's workspace boundary. */
  public pnpmProjectCommand(root: string, command: string): string {
    if (this.ownsPnpmWorkspace(root)) return `pnpm ${command}`;
    const [verb, ...rest] = command.split(/\s+/);
    if (verb === "install" || verb === "add")
      return (
        `pnpm --ignore-workspace ${verb} ` +
        `--virtual-store-dir node_modules/.pnpm ${rest.join(" ")}`
      ).trim();
    return `pnpm --ignore-workspace ${command}`;
  }

  /** Creates a Yarn command using Corepack on Windows. */
  public yarnCommand(arguments_: string): string {
    return `${this.yarnExecutable()} ${arguments_}`;
  }

  /** Tests whether a fixture owns a pnpm workspace manifest. */
  public ownsPnpmWorkspace(root: string): boolean {
    return fs.existsSync(path.join(root, "pnpm-workspace.yaml"));
  }

  /** Adds an isolated pnpm workspace manifest when a fixture lacks one. */
  public ensurePnpmWorkspaceBoundary(
    project: ITtscBenchmarkPerformanceProject,
    root: string,
  ): void {
    if (project.packageManager !== "pnpm") return;
    const workspaceFile: string = path.join(root, "pnpm-workspace.yaml");
    if (fs.existsSync(workspaceFile)) return;
    fs.writeFileSync(
      workspaceFile,
      TtscBenchmarkPerformanceProcess.GENERATED_PNPM_WORKSPACE,
    );
  }

  /** Executes one shell command with benchmark progress and failure policy. */
  public shell(
    cmd: string,
    cwd: string,
    options: ITtscBenchmarkPerformanceCommand.IShellOptions = {},
  ): SpawnSyncReturns<string> {
    const start: bigint = process.hrtime.bigint();
    const label: string = options.label ?? cmd;
    const inherit: boolean = this.options.verbose && !options.quiet;
    if (this.options.verbose && options.timing !== false)
      process.stdout.write(`[cmd] start ${label}\n`);
    const result: SpawnSyncReturns<string> = spawnSync(cmd, {
      cwd,
      shell: true,
      encoding: "utf8",
      env: options.env ?? process.env,
      stdio: inherit ? "inherit" : "pipe",
    });
    if (this.options.verbose && options.timing !== false)
      process.stdout.write(
        `[cmd] done ${label} in ${this.formatDuration(this.elapsed(start))} ` +
          `(exit ${result.status})\n`,
      );
    if (options.check !== false && result.status !== 0) {
      if (!inherit) {
        if (result.stdout) process.stderr.write(result.stdout);
        if (result.stderr) process.stderr.write(result.stderr);
      }
      throw new Error(`command failed (${result.status}) in ${cwd}: ${cmd}`);
    }
    return result;
  }

  /**
   * Executes prepared steps inside the measured region.
   *
   * Tsconfig helper execution and command materialization finish before `t0`;
   * only the actual comparison commands contribute to the returned `ms`.
   */
  public run(
    steps: ITtscBenchmarkPerformanceCommand[],
    root: string,
  ): ITtscBenchmarkPerformanceCommand.IRunResult {
    const preparedSteps: ITtscBenchmarkPerformanceCommand.IPrepared[] =
      steps.map(
        (
          step: ITtscBenchmarkPerformanceCommand,
        ): ITtscBenchmarkPerformanceCommand.IPrepared =>
          this.prepareStepCommand(step, root),
      );
    const t0: bigint = process.hrtime.bigint();
    let log: string = "";
    for (const step of preparedSteps) {
      const stepStart: bigint = process.hrtime.bigint();
      if (this.options.verbose)
        process.stdout.write(
          `    [step] start ${path.relative(root, step.cwd) || "."}: ${step.cmd}\n`,
        );
      const result: SpawnSyncReturns<string> = spawnSync(step.cmd, {
        cwd: step.cwd,
        shell: true,
        encoding: "utf8",
        env: step.env ? { ...process.env, ...step.env } : process.env,
      });
      if (this.options.verbose) {
        if (result.stdout) process.stdout.write(result.stdout);
        if (result.stderr) process.stderr.write(result.stderr);
        process.stdout.write(
          `    [step] done ${path.relative(root, step.cwd) || "."}: ` +
            `${this.formatDuration(this.elapsed(stepStart))} ` +
            `(exit ${result.status})\n`,
        );
      }
      log += `$ ${step.cmd}\n${result.stdout ?? ""}${result.stderr ?? ""}`;
      if (result.status !== 0) {
        const t1: bigint = process.hrtime.bigint();
        return {
          ok: false,
          status: result.status,
          ms: Number(t1 - t0) / 1e6,
          log,
        };
      }
    }
    const t1: bigint = process.hrtime.bigint();
    return { ok: true, status: 0, ms: Number(t1 - t0) / 1e6, log };
  }

  /** Times an untimed benchmark phase for progress reporting. */
  public time<T>(label: string, task: () => T): T {
    const start: bigint = process.hrtime.bigint();
    if (this.options.verbose) process.stdout.write(`[timer] start ${label}\n`);
    try {
      const result: T = task();
      process.stdout.write(
        `[timer] done ${label} in ${this.formatDuration(this.elapsed(start))}\n`,
      );
      return result;
    } catch (error) {
      process.stdout.write(
        `[timer] fail ${label} after ${this.formatDuration(this.elapsed(start))}\n`,
      );
      throw error;
    }
  }

  /** Formats a duration for progress and report output. */
  public formatDuration(milliseconds: number): string {
    return milliseconds >= 1000
      ? `${(milliseconds / 1000).toFixed(2)} s`
      : `${milliseconds.toFixed(0)} ms`;
  }

  /** Quotes one shell argument with JSON-compatible escaping. */
  public quote(value: string): string {
    return JSON.stringify(value);
  }

  /** Returns milliseconds elapsed since a monotonic high-resolution timestamp. */
  public elapsed(start: bigint): number {
    return Number(process.hrtime.bigint() - start) / 1e6;
  }

  private prepareStepCommand(
    step: ITtscBenchmarkPerformanceCommand,
    root: string,
  ): ITtscBenchmarkPerformanceCommand.IPrepared {
    return {
      cmd: this.commandForStep(step, root, "execute"),
      cwd: path.resolve(root, step.cwd ?? "."),
      env: step.env,
    };
  }

  private resolveTsconfigFileArguments(
    cwd: string,
    projects: readonly string[],
    env: NodeJS.ProcessEnv | undefined,
  ): string {
    const cacheKey: string = JSON.stringify([cwd, ...projects]);
    const cached: string | undefined =
      this.tsconfigFileArgumentsCache.get(cacheKey);
    if (cached !== undefined) return cached;

    const command: string = this.tsconfigFilesCommand(projects, "--json");
    const result: SpawnSyncReturns<string> = this.shell(command, cwd, {
      check: false,
      env: env ? { ...process.env, ...env } : process.env,
      quiet: true,
      timing: false,
    });
    if (result.status !== 0) {
      if (result.stdout) process.stderr.write(result.stdout);
      if (result.stderr) process.stderr.write(result.stderr);
      throw new Error(
        `tsconfig file selection failed (${result.status}) in ${cwd}: ${command}`,
      );
    }

    const output: string = result.stdout ?? "";
    let value: unknown;
    try {
      value = JSON.parse(output);
    } catch {
      throw new Error(
        `tsconfig file selection returned invalid JSON in ${cwd}: ${output}`,
      );
    }
    if (
      !Array.isArray(value) ||
      value.some((file: unknown): boolean => typeof file !== "string")
    )
      throw new Error(
        `tsconfig file selection must return a JSON string array in ${cwd}`,
      );

    const fileArguments: string = value
      .map((file: string): string => this.quote(file))
      .join(" ");
    this.tsconfigFileArgumentsCache.set(cacheKey, fileArguments);
    return fileArguments;
  }

  private tsconfigFilesCommand(
    projects: readonly string[],
    output: "--json" | "--shell",
  ): string {
    const arguments_: string = projects
      .map((project: string): string => `-p ${this.quote(project)}`)
      .join(" ");
    return [
      "node --experimental-strip-types --import",
      this.quote(pathToFileURL(TtscBenchmarkConstant.TYPESCRIPT_LOADER).href),
      this.quote(this.options.tsconfigFiles),
      arguments_,
      output,
    ].join(" ");
  }

  private resolveYarnCommand(cmd: string): string {
    if (process.platform !== "win32" || !/^yarn\b/.test(cmd)) return cmd;
    return cmd.replace(/^yarn\b/, this.yarnExecutable());
  }

  private yarnExecutable(): string {
    return process.platform === "win32" ? "corepack yarn" : "yarn";
  }
}

/** Constructor options for the shared performance process runtime. */
export namespace TtscBenchmarkPerformanceProcess {
  /** Immutable executable paths and output policy for one benchmark run. */
  export interface IOptions {
    /** Absolute path of the tsconfig program-file helper executable. */
    tsconfigFiles: string;

    /** Whether child commands and granular timing traces are shown. */
    verbose: boolean;
  }
}
