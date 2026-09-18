import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { resolveTsgo } from "../../compiler/internal/resolveTsgo";
import { getBoolean } from "../../flags/getBoolean";
import { getNumber } from "../../flags/getNumber";
import { getString } from "../../flags/getString";
import { getStringList } from "../../flags/getStringList";
import { parseFlags } from "../../flags/parseFlags";
import { resolveFlagSpec } from "../../flags/resolveFlagSpec";
import { assertNoSolutionBuild } from "./assertNoSolutionBuild";
import { getCompilerVersionText } from "./getCompilerVersionText";
import { prepareExecution } from "./prepareExecution";
import { resolveCacheDir } from "./resolveCacheDir";
import { checkNodeRuntimeSupport } from "./runtime/checkNodeRuntimeSupport";

/**
 * CLI entry point for `ttsx`. Type-checks the owning project via tsgo, emits
 * JavaScript to a PID-isolated temp directory, rewrites ESM specifiers when
 * needed, and executes the compiled entry with the current Node.js runtime.
 *
 * The launcher owns the process tree it starts, so it behaves toward it the way
 * a shell does (samchon/ttsc#1403). A termination signal that arrives while the
 * project is being prepared is held until preparation has cleaned up after
 * itself. While the program runs, `SIGTERM` and `SIGHUP`, which a supervisor or
 * container runtime sends to the launcher's pid alone, are forwarded to it;
 * `SIGINT` from a terminal already reaches the whole process group, so it is
 * not delivered a second time. The runtime directory is removed on every exit
 * path, and a program that died of a signal makes ttsx die of the same one, so
 * a shell sees `128 + n` exactly as it would for `node`.
 *
 * @param argv - Command-line arguments (defaults to `process.argv.slice(2)`).
 * @returns The program's exit code, or `2` on a ttsx-level error. When the
 *   program died of a signal, the promise never settles: ttsx re-raises the
 *   signal on itself instead.
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
    removeRuntimeOutput(prepared.cleanupDir);
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
      // Only a TypeScript-extensioned bare token is the entry; every other bare
      // token before it (e.g. the `es2020` in `--target es2020 entry.ts`) is a
      // forwarded flag value. Classifying values via the predicate keeps them
      // in `passthrough` in order AND stops a pre-entry value from being
      // mistaken for the first positional sentinel — which previously flipped
      // the parser into tail mode and pushed the real entry into `tail`,
      // failing with "entry file is required".
      isPositional: looksLikeEntryFile,
      subcommand: "ttsx",
    });
  } catch (error) {
    // Help still prints when the other options do not parse, as long as it was
    // asked for before anything that looks like the entry.
    const terminal = terminalRequest(argv.slice(0, firstEntryLikeIndex(argv)));
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

  const entry = result.positional.find(looksLikeEntryFile);
  if (entry === undefined) {
    throw new Error("ttsx: entry file is required");
  }
  // With `forwardAfterFirstPositional: true` and `isPositional:
  // looksLikeEntryFile`, the parser reports `result.positional` as just the
  // entry, `result.passthrough` as the tsgo-forwarded flags (and their
  // in-order space values) arriving BEFORE the entry, and `result.tail` as
  // every token AFTER the entry — the user program's argv (e.g. the `generate
  // --input src/input` tail of `ttsx typia.ts generate --input src/input`),
  // which MUST NOT reach tsgo.
  const postEntryArgs: string[] = [...result.tail];

  // `--require` is declared `repeatable`, so the engine records every accepted
  // value in argv order and the launcher reads the list straight off the parse
  // result.
  //
  // This replaces a second, hand-written scan over raw argv that re-derived the
  // pre-entry boundary with `looksLikeEntryFile`. Applied to raw tokens that
  // predicate cannot tell an entry from a `--require` value carrying a
  // TypeScript extension, nor from an inline `--require=<x>.ts` token, so the
  // scan stopped before the tokens it existed to collect and preloads were
  // dropped silently. The engine already owns that boundary:
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
 * Report whether a bare CLI token is the TypeScript entry file rather than a
 * forwarded flag's value. ttsx runs a TypeScript entrypoint, so only a token
 * with a TypeScript source extension is treated as the entry.
 */
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

/** Index of the first bare token that looks like the entry, or the length. */
function firstEntryLikeIndex(argv: readonly string[]): number {
  const index = argv.findIndex(
    (token) => !token.startsWith("-") && looksLikeEntryFile(token),
  );
  return index === -1 ? argv.length : index;
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

function looksLikeEntryFile(token: string): boolean {
  return [".ts", ".tsx", ".mts", ".cts"].some((ext) => token.endsWith(ext));
}

function printHelp(): void {
  process.stdout.write(
    [
      "ttsx — TypeScript runner provided by ttsc.",
      "",
      "Usage:",
      "  ttsx [options] <entry.ts> [argv...]",
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
function runPreparedEntry(
  parsed: Exclude<ReturnType<typeof parseCLI>, "help" | "version">,
  execution: ReturnType<typeof prepareExecution>,
  cwd: string,
  sourceEntry: string,
  signals: LauncherSignals,
): Promise<number> {
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
        entryFile: execution.entryFile,
        entrySource: execution.entrySource,
        outputs: execution.outputs,
        moduleOptions: execution.moduleOptions,
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
        process.env.NODE_OPTIONS,
        `--require ${JSON.stringify(path.join(__dirname, "runtimeHookPreload.js"))}`,
      ),
      TTSC_TSGO_BINARY: process.env.TTSC_TSGO_BINARY ?? tsgo,
      TTSX_RUNTIME_MANIFEST: manifestPath,
    };
    const child = spawn(process.execPath, args, {
      cwd,
      env: runtimeEnv,
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
    removeRuntimeOutput(execution.cleanupDir);
    if (outcome.error !== undefined) {
      process.stderr.write(`${outcome.error.message}\n`);
      return 1;
    }
    if (outcome.signal !== null) {
      signals.raise(outcome.signal);
    }
    return outcome.code ?? 1;
  } finally {
    removeRuntimeOutput(execution.cleanupDir);
  }
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

function removeRuntimeOutput(directory: string): void {
  try {
    fs.rmSync(directory, { force: true, recursive: true });
  } catch {
    // Best effort: cleanup must not replace the child process exit status.
  }
}
