import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { resolveTsgo } from "../../compiler/internal/resolveTsgo";
import { COMPILER_OPTION_KINDS } from "../../flags/COMPILER_OPTION_KINDS";
import { getBoolean } from "../../flags/getBoolean";
import { getNumber } from "../../flags/getNumber";
import { getString } from "../../flags/getString";
import { getStringList } from "../../flags/getStringList";
import { normalizeFlagToken } from "../../flags/normalizeFlagToken";
import { parseFlags } from "../../flags/parseFlags";
import { resolveFlagSpec } from "../../flags/resolveFlagSpec";
import { assertNoSolutionBuild } from "./assertNoSolutionBuild";
import { getCompilerVersionText } from "./getCompilerVersionText";
import { prepareExecution } from "./prepareExecution";
import { resolveCacheDir } from "./resolveCacheDir";
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
 * a shell does (samchon/ttsc#1403). A termination signal that arrives while the
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
  const parsed = parseCLI(argv);
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

function parseCLI(argv: readonly string[]) {
  // ttsx accepts ttsc-style flags plus its own `--no-plugins` / `--require`.
  // The shared schema engine recognises both; the engine returns positional
  // tokens (entry file + flag values that aren't `.ts`) and a passthrough
  // list mirroring the pre-schema behaviour.
  //
  // The legacy uppercase `-P` spelling ttsx has always accepted needs no
  // rewrite: the engine resolves a token to the flag the compiler resolves it
  // to, so `-P` and `-P=<file>` reach `--tsconfig` by the same rule that makes
  // `-p` reach it. A textual pre-rewrite here would be a second rule for a job
  // the engine owns.
  //
  // Terminal flags (--help / --version) belong to ttsx only before the entry;
  // after it they are the program's own argv, exactly as `node entry.js
  // --version` hands `--version` to the program (samchon/ttsc#1401). The
  // parser already draws that boundary, so they are read off its result, and
  // resolved through the schema so every spelling the compiler accepts
  // (`--HELP`, `-Version`) reaches the same branch.
  let result: ReturnType<typeof parseFlags>;
  try {
    result = parseFlags({
      argv,
      errorPrefix: "ttsx:",
      forwardAfterFirstPositional: true,
      honorDoubleDashSeparator: true,
      // The entry is the first bare token that is no option's value, whatever
      // its extension: the schema and the compiler's own option table say
      // which options take a value (the `es2020` of `--target es2020`), so a
      // JavaScript entry is the entry too rather than a forwarded value
      // (samchon/ttsc#1569).
      subcommand: "ttsx",
    });
  } catch (error) {
    // Help still prints when the other options do not parse, as long as it was
    // asked for before anything that looks like the entry.
    const terminal = terminalRequest(argv.slice(0, firstPositionalIndex(argv)));
    if (terminal !== null) return terminal;
    throw error;
  }
  const terminal = terminalRequest([
    ...[...result.values.keys()],
    ...result.passthrough,
  ]);
  if (terminal !== null) return terminal;
  assertNoSolutionBuild(result, "ttsx:");
  assertNoWatch(result);

  const entry = result.positional[0];
  if (entry === undefined) {
    throw new Error("ttsx: entry file is required");
  }
  // With `forwardAfterFirstPositional: true`, the parser reports
  // `result.positional` as just the entry, `result.passthrough` as the
  // tsgo-forwarded flags (and their in-order space values) arriving BEFORE the
  // entry, and `result.tail` as every token AFTER the entry — the user
  // program's argv (e.g. the `generate --input src/input` tail of `ttsx
  // typia.ts generate --input src/input`), which MUST NOT reach tsgo.
  const postEntryArgs: string[] = [...result.tail];

  // `--require` is declared `repeatable`, so the engine records every accepted
  // value in argv order and the launcher reads the list straight off the parse
  // result.
  //
  // This replaces a second, hand-written scan over raw argv that re-derived the
  // pre-entry boundary from the entry's extension. Applied to raw tokens that
  // test cannot tell an entry from a `--require` value carrying a TypeScript
  // extension, nor from an inline `--require=<x>.ts` token, so the scan
  // stopped before the tokens it existed to collect and preloads were dropped
  // silently. The engine already owns that boundary:
  // `forwardAfterFirstPositional` routes every post-entry token to
  // `result.tail` without parsing it, so `ttsx entry.ts -r preload.cjs` still
  // forwards the pair to the program instead of preloading it.
  const preload = getStringList(result, "--require");

  return {
    binary: getString(result, "--binary"),
    cacheDir: getString(result, "--cache-dir"),
    checkers: getNumber(result, "--checkers"),
    cwd: getString(result, "--cwd"),
    entry,
    noPlugins: getBoolean(result, "--no-plugins") === true,
    passthrough: postEntryArgs,
    preload,
    project: getString(result, "--tsconfig"),
    singleThreaded: getBoolean(result, "--singleThreaded") === true,
    tsgoFlags: [...result.passthrough],
  };
}

/**
 * `"help"` or `"version"` when one of `tokens` asks for it, else `null`. Only
 * dash-prefixed tokens can name a flag; a bare value such as the `all` of
 * `--target all` must not read as `--all`.
 */
function terminalRequest(tokens: readonly string[]): "help" | "version" | null {
  for (const token of tokens) {
    if (!token.startsWith("-")) continue;
    const flag = resolveFlagSpec(token)?.name;
    if (flag === "--help") return "help";
    if (flag === "--version") return "version";
  }
  return null;
}

/**
 * Index of the first bare token that is no option's value, or the length. Used
 * only where the parser itself failed, to still find the options before the
 * entry.
 */
function firstPositionalIndex(argv: readonly string[]): number {
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]!;
    if (token.startsWith("@")) continue;
    if (!token.startsWith("-")) return index;
    if (token.includes("=")) continue;
    const flag = resolveFlagSpec(token);
    const next = argv[index + 1];
    if (next === undefined || next.startsWith("-")) continue;
    const takesValue =
      flag !== undefined
        ? flag.kind !== "boolean"
        : COMPILER_OPTION_KINDS.get(normalizeFlagToken(token)) === "value";
    if (takesValue || next === "true" || next === "false") index += 1;
  }
  return argv.length;
}

/**
 * Refuse `--watch` (or `-w`) given to ttsx itself, before any compiler starts.
 *
 * Forwarded to the type-check, it turned the check into a process that never
 * returns, so the entry never ran and the command hung with no output
 * (samchon/ttsc#1409). ttsx runs the entry once after one check, and a watch
 * that restarts the program is a different feature; the message names the two
 * tools that already provide the halves. A `--watch` after the entry is the
 * program's own flag and never reaches here.
 */
function assertNoWatch(result: ReturnType<typeof parseFlags>): void {
  const watching =
    result.values.has("--watch") ||
    result.passthrough.some(
      (token) =>
        token.startsWith("-") && resolveFlagSpec(token)?.name === "--watch",
    );
  if (!watching) return;
  throw new Error(
    "ttsx: --watch is not supported; ttsx type-checks once and then runs the entry. For a watching type-check use `ttsc --watch --noEmit`; to restart the program on changes use `node --watch --require ttsc/register <entry.ts>`. Arguments after the entry, including --watch, go to the program.",
  );
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

function resolvePreload(cwd: string, preload: string): string {
  if (path.isAbsolute(preload) || isRelativeSpecifier(preload)) {
    return path.resolve(cwd, preload);
  }
  return preload;
}

function isRelativeSpecifier(specifier: string): boolean {
  return (
    specifier === "." ||
    specifier === ".." ||
    specifier.startsWith("./") ||
    specifier.startsWith("../") ||
    specifier.startsWith(".\\") ||
    specifier.startsWith("..\\")
  );
}

/**
 * Run a JavaScript entry as Node's main module under the runtime
 * `ttsc/register` installs (samchon/ttsc#1569).
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
  parsed: Exclude<ReturnType<typeof parseCLI>, "help" | "version">,
  cwd: string,
  entry: string,
  signals: LauncherSignals,
): Promise<number> {
  const unsupported = [
    ...(parsed.project !== undefined ? ["--project"] : []),
    ...(parsed.cacheDir !== undefined ? ["--cache-dir"] : []),
    ...(parsed.checkers !== undefined ? ["--checkers"] : []),
    ...(parsed.noPlugins ? ["--no-plugins"] : []),
    ...(parsed.singleThreaded ? ["--singleThreaded"] : []),
    ...parsed.tsgoFlags.filter(
      (token) => token.startsWith("-") || token.startsWith("@"),
    ),
  ];
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
      resolvePreload(cwd, preload),
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
 * reaches `process.on("uncaughtException")` and Node's exit status
 * (samchon/ttsc#1402). A bootstrap used to load the entry instead, and the
 * program saw the bootstrap as its main module. A runtime manifest pins the
 * entry project's emit for the hooks; `TTSC_TSGO_BINARY` lets dependency builds
 * find tsgo without re-resolving it from inside the hook.
 */
async function runPreparedEntry(
  parsed: Exclude<ReturnType<typeof parseCLI>, "help" | "version">,
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
        resolvePreload(cwd, preload),
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
