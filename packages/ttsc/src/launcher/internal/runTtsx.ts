import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { resolveTsgo } from "../../compiler/internal/resolveTsgo";
import {
  getBoolean,
  getNumber,
  getString,
  parseFlags,
} from "../../flags/parser";
import { getCompilerVersionText } from "./getCompilerVersionText";
import { prepareExecution } from "./prepareExecution";
import { resolveCacheDir } from "./resolveCacheDir";
import { checkNodeRuntimeSupport } from "./runtimeHooks";

/**
 * CLI entry point for `ttsx`. Type-checks the owning project via tsgo, emits
 * JavaScript to a PID-isolated temp directory, rewrites ESM specifiers when
 * needed, and executes the compiled entry with the current Node.js runtime.
 *
 * @param argv - Command-line arguments (defaults to `process.argv.slice(2)`).
 * @returns The child-process exit code, or `2` on a ttsx-level error.
 */
export function runTtsx(
  argv: readonly string[] = process.argv.slice(2),
): number {
  try {
    return run(argv);
  } catch (error) {
    process.stderr.write(`${formatError(error)}\n`);
    return 2;
  }
}

function run(argv: readonly string[]): number {
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
  return runPreparedEntry(parsed, prepared, cwd, entry);
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
  // Order pin: ttsx accepts `-P` as an alias for `--project`. The schema
  // declares `-p` for ttsc; ttsx's lowercase shape would collide on `-p`
  // → `--tsconfig`, so the legacy `-P` (uppercase) is treated as `--project`
  // via a manual rewrite before the engine sees argv. We preserve the
  // historical behaviour and emit a structural error otherwise.
  const rewritten = argv.map((token) =>
    token === "-P"
      ? "--project"
      : token.startsWith("-P=")
        ? `--project=${token.slice("-P=".length)}`
        : token,
  );
  // Terminal flags (--help / --version) short-circuit before parsing so
  // ttsx prints help text even when the entry file is missing.
  for (const token of rewritten) {
    if (token === "-h" || token === "--help") return "help" as const;
    if (token === "-v" || token === "--version") return "version" as const;
  }
  const result = parseFlags({
    argv: rewritten,
    errorPrefix: "ttsx:",
    forwardAfterFirstPositional: true,
    honorDoubleDashSeparator: true,
    // Only a TypeScript-extensioned bare token is the entry; every other bare
    // token before it (e.g. the `es2020` in `--target es2020 entry.ts`) is a
    // forwarded flag value. Classifying values via the predicate keeps them in
    // `passthrough` in order AND stops a pre-entry value from being mistaken for
    // the first positional sentinel — which previously flipped the parser into
    // tail mode and pushed the real entry into `tail`, failing with
    // "entry file is required".
    isPositional: looksLikeEntryFile,
    subcommand: "ttsx",
  });

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

  const preload: string[] = [];
  // `--require` accepts repeated values; the schema engine writes the
  // LAST one into `values`, so reconstruct the full list by scanning the
  // raw argv. Mirrors the legacy parser's `preload.push(takeValue(...))`
  // behaviour.
  //
  // Stop the rescue scan at the first token that begins tail mode —
  // either the entry file or the `--` separator. Without this guard,
  // `ttsx entry.ts -r preload.cjs` would BOTH preload `preload.cjs` AND
  // forward `-r preload.cjs` to the entry's argv, double-effecting the
  // module load. The schema engine already routes post-entry tokens to
  // `result.tail`; the rescue scan must respect the same boundary.
  const scanEnd = rewritten.findIndex(
    (token) => looksLikeEntryFile(token) || token === "--",
  );
  const scanLimit = scanEnd === -1 ? rewritten.length : scanEnd;
  for (let i = 0; i < scanLimit; i += 1) {
    const token = rewritten[i]!;
    if (token === "-r" || token === "--require") {
      const value = rewritten[i + 1];
      if (value !== undefined && !value.startsWith("-")) {
        preload.push(value);
        i += 1;
      }
    } else if (token.startsWith("--require=")) {
      preload.push(token.slice("--require=".length));
    }
  }

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
function looksLikeEntryFile(token: string): boolean {
  return [".ts", ".tsx", ".mts", ".cts"].some((ext) => token.endsWith(ext));
}

function printHelp(): void {
  process.stdout.write(
    [
      "ttsx — TypeScript runner provided by ttsc.",
      "",
      "Usage:",
      "  ttsx [options] <entry.ts> [-- <argv...>]",
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
 * The child is `node [-r preload...] registerRuntimeHooks.js <source-entry>
 * <argv...>` (the bootstrap, run as the main module — not `--import`, so a
 * CommonJS `require` chain reaches the hooks). A runtime manifest pins the
 * entry project's emit for the hooks; `TTSC_TSGO_BINARY` lets dependency builds
 * find tsgo without re-resolving it from inside the hook.
 */
function runPreparedEntry(
  parsed: Exclude<ReturnType<typeof parseCLI>, "help" | "version">,
  execution: ReturnType<typeof prepareExecution>,
  cwd: string,
  sourceEntry: string,
): number {
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
        emittedFiles: execution.emittedFiles,
        moduleOption: execution.moduleOption,
        projectRoot: execution.projectRoot,
        rootDir: execution.rootDir,
      }),
      "utf8",
    );

    const tsgo = resolveTsgo({
      binary: parsed.binary,
      cwd: execution.projectRoot,
    }).binary;

    const bootstrap = path.join(__dirname, "registerRuntimeHooks.js");
    const args = [
      "--disable-warning=ExperimentalWarning",
      ...parsed.preload.flatMap((preload) => [
        "-r",
        resolvePreload(cwd, preload),
      ]),
      bootstrap,
      sourceEntry,
      ...parsed.passthrough,
    ];
    const result = spawnSync(process.execPath, args, {
      cwd,
      env: {
        ...process.env,
        NODE_OPTIONS: appendNodeOption(
          process.env.NODE_OPTIONS,
          `--require ${JSON.stringify(path.join(__dirname, "runtimeHookPreload.js"))}`,
        ),
        TTSC_TSGO_BINARY: process.env.TTSC_TSGO_BINARY ?? tsgo,
        TTSX_RUNTIME_MANIFEST: manifestPath,
      },
      stdio: "inherit",
      windowsHide: true,
    });
    if (result.error) {
      process.stderr.write(`${result.error.message}\n`);
      return 1;
    }
    return result.status ?? 1;
  } finally {
    removeRuntimeOutput(execution.cleanupDir);
  }
}

function removeRuntimeOutput(directory: string): void {
  try {
    fs.rmSync(directory, { force: true, recursive: true });
  } catch {
    // Best effort: cleanup must not replace the child process exit status.
  }
}
