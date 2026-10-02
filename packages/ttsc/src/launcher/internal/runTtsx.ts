import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { resolveTsgo } from "../../compiler/internal/resolveTsgo";
import { getCompilerVersionText } from "./getCompilerVersionText";
import { prepareExecution } from "./prepareExecution";
import { parseTtsxCLI } from "./parseTtsxCLI";
import { resolveCacheDir } from "./resolveCacheDir";
import { TtsxEntryOptions } from "./TtsxEntryOptions";
import { ProcessOwnedDirectory } from "./runtime/ProcessOwnedDirectory";
import { checkNodeRuntimeSupport } from "./runtime/checkNodeRuntimeSupport";
import { withRuntimeDirectoryLock } from "./runtime/withRuntimeDirectoryLock";

/**
 * CLI entry point for `ttsx`. Type-checks the owning project via tsgo, emits
 * JavaScript to a PID-isolated temp directory, rewriting relative TypeScript
 * import extensions when the project allows them, and runs the entry as Node's
 * main module in a child of the current Node.js runtime, whose module hooks
 * serve that emit under the source's own path.
 *
 * The launcher owns the process tree it starts, so it behaves toward it the way
 * a shell does. A termination signal that arrives while the
 * project is being prepared is held until preparation has cleaned up after
 * itself. While the program runs, `SIGTERM` and `SIGHUP`, which a supervisor or
 * container runtime sends to the launcher's pid alone, are forwarded to it;
 * `SIGINT` from a terminal already reaches the whole process group, so it is
 * not delivered a second time. The runtime directory is removed on exit once no
 * descendant still owns it. A program that died of a signal makes ttsx die of
 * the same one, so a shell sees `128 + n` exactly as it would for `node`.
 *
 * @param argv - Command-line arguments (defaults to `process.argv.slice(2)`).
 *
 * @returns The program's exit code, or `2` on a ttsx-level error. When the
 *   program died of a signal, the promise never settles: ttsx re-raises the
 *   signal on itself instead.
 *
 * @evidence contracts/common.md#principled-implementation The shared flag parser separates compiler options from entry argv; TypeScript entries use a checked emit manifest and JavaScript entries install the runtime preload, then Node loads the original entry as its main module.
 * @evidence contracts/common.md#clear-and-simple-design Parsing, preparation, child execution and signal ownership have separate helpers; one launcher-level finally removes listeners, while the prepared-entry boundary owns runtime-output cleanup.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Unsupported build/watch modes and JavaScript-only configuration flags are rejected explicitly; supported Node preloads carry runtime hooks without replacing foreign globals or fabricating a successful child exit.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain execution identity, signal policy, cleanup and exit effects; helper comments distinguish program argv, preload order and best-effort cleanup.
 * @evidence contracts/portability.md#os-neutral-implementation Native path APIs resolve entries/preloads, spawn receives the current Node executable and argument array, and Windows signal limitations are isolated in LauncherSignals rather than assuming POSIX process behavior.
 * @evidence contracts/performance.md#efficient-algorithms CLI parsing and token scans are linear in argv size, preparation delegates the required compiler work, and the launcher starts one child without polling or buffering inherited output.
 *
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each invocation owns an effectful program run and fresh arguments; reusable compiler generations belong to prepareExecution and the runtime build owners.
 *
 * @evidence contracts/performance.md#bound-retention-and-release-resources One run owns a child and a fixed platform signal-listener set; finally disposes listeners and relinquishes output under the runtime lock, while live descendant owner claims postpone removal. Signals target the direct child rather than recursively terminating every descendant, and an unresponsive child has no forced-kill deadline here.
 */
export async function runTtsx(
  argv: readonly string[] = process.argv.slice(2),
): Promise<number> {
  const signals = new LauncherSignals();
  try {
    return await run(argv, signals);
  } catch (error) {
    process.stderr.write(`${formatError(error)}\n`);
    // A signal that interrupted the synchronous preparation is still pending:
    // its listener runs once the event loop turns.
    await settleSignals();
    signals.raiseReceived();
    return 2;
  } finally {
    signals.dispose();
  }
}

async function run(
  argv: readonly string[],
  signals: LauncherSignals,
): Promise<number> {
  const parsed = parseTtsxCLI(argv);
  if (parsed === "help") {
    printHelp();
    return 0;
  }
  if (parsed === "version") {
    process.stdout.write(
      `${getCompilerVersionText().replace(/^ttsc\b/, "ttsx")}\n`,
    );
    return 0;
  }

  // Refuse an unsupported Node.js before type-checking and spawning the child:
  // the child inherits this process's Node version, so an early diagnostic here
  // pre-empts both the Node 18 `--disable-warning` rejection and the Node 20
  // missing-`registerHooks` TypeError with one actionable message. `--help` and
  // `--version` are handled above so they still print on any Node.
  const nodeSupport = checkNodeRuntimeSupport(process.versions.node);
  if (nodeSupport !== null) {
    process.stderr.write(`ttsx: ${nodeSupport}\n`);
    return 2;
  }

  const cwd = path.resolve(parsed.cwd ?? process.cwd());
  const entry = path.resolve(cwd, parsed.entry);
  if (!fs.existsSync(entry)) {
    process.stderr.write(`ttsx: entry not found: ${entry}\n`);
    return 2;
  }
  if (!isTypeScriptEntry(entry)) {
    return runJavaScriptEntry(parsed, cwd, entry, signals);
  }

  const prepared = prepareExecution(entry, {
    binary: parsed.binary,
    cacheDir: resolveCacheDir(cwd, parsed.cacheDir),
    checkers: parsed.checkers,
    cwd,
    passthrough: parsed.tsgoFlags,
    // `--no-plugins` builds the entry's owning project with plugin
    // discovery and loading disabled. ttsc's own config loaders use it
    // when they evaluate a `*.config.ts` through ttsx: that build only
    // needs to type-check and run the config file, so loading the host
    // project's transform/check plugins (`@nestia/core`, `typia`, …)
    // would be both wasteful and wrong — those plugins impose project
    // requirements (e.g. `strict` mode) the ephemeral config-loader
    // tsconfig deliberately does not satisfy.
    plugins: parsed.noPlugins ? false : undefined,
    project: parsed.project,
    singleThreaded: parsed.singleThreaded,
  });
  await settleSignals();
  if (signals.received !== undefined) {
    // The signal arrived while the project was prepared. Preparation has
    // finished cleaning up its own files; the runtime output goes now.
    removeRuntimeOutput(prepared.cleanupDir, prepared.runtimeCacheDir);
    signals.raiseReceived();
  }
  return runPreparedEntry(parsed, prepared, cwd, entry, signals);
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

/** Whether the entry is a TypeScript source, which ttsx checks and builds. */
function isTypeScriptEntry(entry: string): boolean {
  return [".ts", ".tsx", ".mts", ".cts"].some((extension) =>
    entry.endsWith(extension),
  );
}

function printHelp(): void {
  process.stdout.write(
    [
      "ttsx — TypeScript runner provided by ttsc.",
      "",
      "Usage:",
      "  ttsx [options] <entry> [argv...]",
      "",
      "Options:",
      "  -P, --project <file>   Use an explicit tsconfig.json",
      "  --cwd <dir>            Resolve entry/project relative to this directory",
      "  --cache-dir <dir>      Override the runner and source-plugin cache root",
      "  --binary <path>        Use an explicit tsgo binary",
      "  --no-plugins           Build the project without ttsc plugins",
      "  -r, --require <module> Preload a module before the entrypoint",
      "  --singleThreaded       Run TypeScript-Go single-threaded (one checker)",
      "  --checkers <n>         Type-checker pool size (default: TypeScript-Go's)",
      "  -h, --help             Show this help",
      "  -v, --version          Print the runner version",
      "",
      "  Any other flag before the entry is forwarded to tsgo, so options like",
      "  --strict apply to the type-check (e.g. ttsx --strict src/index.ts).",
      "  Everything after the entry is the program's own argv, --help and",
      "  --version included. --watch is not supported before the entry.",
      "  A JavaScript entry runs under the same runtime as node --require",
      "  ttsc/register: each TypeScript file it reaches is checked and built",
      "  through its own project.",
      "",
      "Examples:",
      "  ttsx src/index.ts",
      "  ttsx --project tsconfig.json src/index.ts -- --port 3000",
    ].join("\n"),
  );
  process.stdout.write("\n");
}

/**
 * Append a Node flag to an existing `NODE_OPTIONS` value (or start one). Used
 * to propagate the runtime-hook installer into every child process the program
 * spawns, so workers launched as `node worker.ts` inherit the source loader.
 */
function appendNodeOption(
  existing: string | undefined,
  option: string,
): string {
  return existing && existing.trim().length !== 0
    ? `${existing} ${option}`
    : option;
}

/** Run an owner claim before inherited preloads and the program's own code. */
function prependNodeOption(
  existing: string | undefined,
  option: string,
): string {
  return existing && existing.trim().length !== 0
    ? `${option} ${existing}`
    : option;
}

/**
 * Run a JavaScript entry as Node's main module under the runtime
 * `ttsc/register` installs.
 *
 * A JavaScript entry, such as a CLI's bin script run so that the TypeScript
 * configuration and sources it loads are served, has no project to check up
 * front: every TypeScript file it reaches enters the runtime as a root and is
 * checked and built through its own project, as under `node --require
 * ttsc/register`. The preload goes on `NODE_OPTIONS`, so the processes the
 * program starts inherit it. The options that only configure the up-front build
 * of a TypeScript entry are refused rather than ignored.
 */
async function runJavaScriptEntry(
  parsed: Exclude<ReturnType<typeof parseTtsxCLI>, "help" | "version">,
  cwd: string,
  entry: string,
  signals: LauncherSignals,
): Promise<number> {
  const unsupported = TtsxEntryOptions.unsupportedJavaScriptBuildOptions(parsed);
  if (unsupported.length !== 0) {
    process.stderr.write(
      `ttsx: ${unsupported.join(", ")} configure${unsupported.length === 1 ? "s" : ""} the up-front build of a TypeScript entry, and ${path.basename(entry)} is JavaScript; set compiler options in the tsconfig.json that owns the TypeScript it loads\n`,
    );
    return 2;
  }
  const args = [
    "--disable-warning=ExperimentalWarning",
    ...parsed.preload.flatMap((preload) => [
      "-r",
      TtsxEntryOptions.resolvePreload(cwd, preload),
    ]),
    entry,
    ...parsed.passthrough,
  ];
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_OPTIONS: appendNodeOption(
      process.env.NODE_OPTIONS,
      `--require ${JSON.stringify(path.join(__dirname, "..", "..", "register.js"))}`,
    ),
    ...(parsed.binary !== undefined
      ? { TTSC_TSGO_BINARY: path.resolve(cwd, parsed.binary) }
      : {}),
  };
  return runProgram(args, env, cwd, signals);
}

/**
 * Run the TypeScript entry from source in a child Node process whose runtime
 * module hooks serve the already-built entry project and build raw `.ts`
 * dependencies on demand.
 *
 * The child is `node [-r preload...] <source-entry> <argv...>`, with the
 * runtime-hook preload on `NODE_OPTIONS` ahead of every user preload. The entry
 * is Node's own main module, exactly as under `node <entry>` or `node -r
 * ttsc/register <entry>`: `require.main === module` and `import.meta.main` hold
 * in it, `process.argv` is Node's own, and an error thrown while it evaluates
 * reaches `process.on("uncaughtException")` and Node's exit status,
 * never a bootstrap module that loads it. A runtime manifest pins the
 * entry project's emit for the hooks; `TTSC_TSGO_BINARY` lets dependency builds
 * find tsgo without re-resolving it from inside the hook.
 */
async function runPreparedEntry(
  parsed: Exclude<ReturnType<typeof parseTtsxCLI>, "help" | "version">,
  execution: ReturnType<typeof prepareExecution>,
  cwd: string,
  sourceEntry: string,
  signals: LauncherSignals,
): Promise<number> {
  let cleaned = false;
  const cleanup = (): void => {
    if (cleaned) return;
    cleaned = true;
    removeRuntimeOutput(execution.cleanupDir, execution.runtimeCacheDir);
  };
  try {
    const depCacheDir = path.join(execution.cleanupDir, "deps");
    const manifestPath = path.join(
      execution.cleanupDir,
      "runtime-manifest.json",
    );
    fs.mkdirSync(execution.cleanupDir, { recursive: true });
    fs.writeFileSync(
      manifestPath,
      JSON.stringify({
        depCacheDir,
        emitDir: execution.emitDir,
        emittedSources: execution.emittedSources,
        emittedSourceProofFailures: execution.emittedSourceProofFailures,
        entryFile: execution.entryFile,
        entrySource: execution.entrySource,
        outputs: execution.outputs,
        moduleOptions: execution.moduleOptions,
        orphanCacheDir: execution.orphanCacheDir,
        ...(parsed.noPlugins ? { plugins: false } : {}),
        projectRoot: execution.projectRoot,
        rootDir: execution.rootDir,
      }),
      "utf8",
    );

    const tsgo = resolveTsgo({
      binary: parsed.binary,
      cwd: execution.projectRoot,
    }).binary;

    const args = [
      "--disable-warning=ExperimentalWarning",
      ...parsed.preload.flatMap((preload) => [
        "-r",
        TtsxEntryOptions.resolvePreload(cwd, preload),
      ]),
      sourceEntry,
      ...parsed.passthrough,
    ];
    const runtimeEnv: NodeJS.ProcessEnv = {
      ...process.env,
      NODE_OPTIONS: appendNodeOption(
        prependNodeOption(
          process.env.NODE_OPTIONS,
          `--require ${JSON.stringify(path.join(__dirname, "runtimeOwnerPreload.js"))}`,
        ),
        `--require ${JSON.stringify(path.join(__dirname, "runtimeHookPreload.js"))}`,
      ),
      // The compiler this run resolved, which already honours an inherited
      // `TTSC_TSGO_BINARY` when no `--binary` was given.
      TTSC_TSGO_BINARY: tsgo,
      TTSX_RUNTIME_MANIFEST: manifestPath,
      TTSX_RUNTIME_CACHE_DIR: execution.runtimeCacheDir,
      TTSX_RUNTIME_RUN_DIR: execution.cleanupDir,
      TTSX_RUNTIME_RUNS_DIR: execution.runtimeRunsDir,
    };
    return await runProgram(args, runtimeEnv, cwd, signals, {
      afterExit: cleanup,
    });
  } finally {
    cleanup();
  }
}

/**
 * Run the program in a child of the current Node.js runtime and end the way it
 * ended: with its exit code, or by re-raising the signal that killed it.
 * `afterExit` runs once the child is gone, before the signal is re-raised.
 */
async function runProgram(
  args: readonly string[],
  env: NodeJS.ProcessEnv,
  cwd: string,
  signals: LauncherSignals,
  hooks: {
    afterExit?: () => void;
  } = {},
): Promise<number> {
  const child = spawn(process.execPath, args, {
    cwd,
    env,
    stdio: "inherit",
    windowsHide: true,
  });
  signals.forwardTo(child);
  const outcome = await new Promise<{
    code: number | null;
    signal: NodeJS.Signals | null;
    error?: Error;
  }>((resolve) => {
    child.once("error", (error) =>
      resolve({ code: null, signal: null, error }),
    );
    child.once("exit", (code, signal) => resolve({ code, signal }));
  });
  hooks.afterExit?.();
  if (outcome.error !== undefined) {
    process.stderr.write(`${outcome.error.message}\n`);
    return 1;
  }
  if (outcome.signal !== null) {
    signals.raise(outcome.signal);
  }
  return outcome.code ?? 1;
}

/**
 * Let one turn of the event loop pass, so a signal that arrived while
 * synchronous work blocked the loop reaches its listener before the launcher
 * decides how to end.
 */
function settleSignals(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

/** The part of a spawned child the signal forwarding needs. */
interface ForwardTarget {
  /** Send `signal` to the child. */
  kill(signal: NodeJS.Signals): boolean;

  /** The child's exit code, or `null` while it runs or after a signal. */
  exitCode: number | null;

  /** The signal that ended the child, or `null` while it runs. */
  signalCode: string | null;
}

/**
 * The launcher's hold on the termination signals for the life of one run.
 *
 * Listening at all is what keeps an unhandled `SIGINT` or `SIGTERM` from
 * killing the launcher mid-way, before `finally` blocks remove what it wrote. A
 * signal is recorded, forwarded to the program when one is running and the
 * signal is one only the launcher received, and re-raised on the launcher once
 * everything is cleaned up, with the listeners removed so the default action
 * ends the process with that signal.
 */
class LauncherSignals {
  /** The first termination signal received, if any. */
  public received: NodeJS.Signals | undefined;

  private child: ForwardTarget | undefined;
  private readonly listeners = new Map<NodeJS.Signals, () => void>();

  /** Start holding every termination signal of this platform. */
  public constructor() {
    for (const signal of TERMINATION_SIGNALS) {
      const listener = (): void => {
        this.received ??= signal;
        if (signal !== "SIGINT") this.deliver(signal);
      };
      this.listeners.set(signal, listener);
      process.on(signal, listener);
    }
  }

  /** Forward the signals only the launcher receives to the running program. */
  public forwardTo(child: ForwardTarget): void {
    this.child = child;
    if (this.received !== undefined && this.received !== "SIGINT") {
      this.deliver(this.received);
    }
  }

  /** Re-raise the signal received so far, if any. */
  public raiseReceived(): void {
    if (this.received !== undefined) this.raise(this.received);
  }

  /** End the launcher with `signal`, as the program it ran ended. */
  public raise(signal: NodeJS.Signals): void {
    this.dispose();
    try {
      process.kill(process.pid, signal);
    } catch {
      // A signal this platform cannot send to itself (Windows emulates only a
      // few) still has to end the run as a failure.
      process.exit(1);
    }
  }

  /** Stop listening, restoring each signal's default action. */
  public dispose(): void {
    for (const [signal, listener] of this.listeners) {
      process.removeListener(signal, listener);
    }
    this.listeners.clear();
  }

  private deliver(signal: NodeJS.Signals): void {
    const child = this.child;
    if (
      child !== undefined &&
      child.exitCode === null &&
      child.signalCode === null
    ) {
      child.kill(signal);
    }
  }
}

/**
 * Signals that end a process by default and that ttsx holds for cleanup.
 * Windows has no `SIGHUP`, and Node emulates only `SIGINT` and `SIGBREAK` there
 * as signals a process can listen to.
 */
const TERMINATION_SIGNALS: readonly NodeJS.Signals[] =
  process.platform === "win32"
    ? ["SIGINT", "SIGBREAK"]
    : ["SIGINT", "SIGTERM", "SIGHUP"];

function removeRuntimeOutput(directory: string, runtimeCacheDir: string): void {
  try {
    withRuntimeDirectoryLock(runtimeCacheDir, () => {
      ProcessOwnedDirectory.relinquish(directory);
      const ownership = ProcessOwnedDirectory.ownership(directory);
      if (ownership === "abandoned" || ownership === "unowned") {
        fs.rmSync(directory, { force: true, recursive: true });
      }
    });
  } catch {
    // Best effort: cleanup must not replace the child process exit status.
  }
}
