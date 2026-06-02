import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  getBoolean,
  getNumber,
  getString,
  parseFlags,
} from "../../flags/parser";
import { getCompilerVersionText } from "./getCompilerVersionText";
import { prepareExecution } from "./prepareExecution";
import { resolveCacheDir } from "./resolveCacheDir";

/**
 * CLI entry point for `ttsx`. Type-checks the owning project via tsgo, emits
 * JavaScript to a PID-isolated temp directory, installs runtime hooks, and then
 * executes the entry from its source path with the current Node.js runtime.
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

  const cwd = path.resolve(parsed.cwd ?? process.cwd());
  const entry = path.resolve(cwd, parsed.entry);
  if (!fs.existsSync(entry)) {
    process.stderr.write(`ttsx: entry not found: ${entry}\n`);
    return 2;
  }

  const cacheDir = resolveCacheDir(cwd, parsed.cacheDir);
  const prepared = prepareExecution(entry, {
    binary: parsed.binary,
    cacheDir,
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
  return runPreparedEntry(parsed, prepared, cwd, cacheDir);
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
    subcommand: "ttsx",
  });

  const entry = result.positional.find(looksLikeEntryFile);
  if (entry === undefined) {
    throw new Error("ttsx: entry file is required");
  }
  // With `forwardAfterFirstPositional: true` the parser reports
  // `result.positional` as just the entry, `result.passthrough` as flags
  // arriving BEFORE the entry (tsgo-forwarded), and `result.tail` as every
  // token AFTER the entry — those are the user program's argv (e.g. the
  // `generate --input src/input` tail of `ttsx typia.ts generate
  // --input src/input`) and MUST NOT reach tsgo. Anything in positional
  // that is not the entry is a pre-entry flag value (e.g. `--target es2020`)
  // that the parser stored positionally; forward those to tsgo with the
  // rest of `passthrough`.
  const preEntryValues: string[] = result.positional.filter(
    (token) => token !== entry && !looksLikeEntryFile(token),
  );
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
    tsgoFlags: [...result.passthrough, ...preEntryValues],
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
 * The `NODE_OPTIONS` fragment that installs ttsx's runtime module hooks.
 *
 * `--import` loads the registrar before the entry, giving the `resolve`/`load`
 * hooks whole-graph reach for raw `.ts` (through both `import` and `require`).
 * It is carried in `NODE_OPTIONS` rather than as a direct CLI flag so that any
 * Node SUBPROCESS the program spawns (a worker, a `fork`, a test runner)
 * inherits the same hooks — without them a child would load the project's `.ts`
 * through Node's native type-stripping, skipping the plugin transforms. The
 * entry's own emit mapping (`TTSC_TTSX_ENTRY_EMIT_*`) is inherited the same
 * way. `--disable-warning` silences the `ExperimentalWarning` `registerHooks`
 * prints.
 */
function runtimeNodeOptions(): string {
  const registrar = pathToFileURL(
    path.join(__dirname, "registerRuntimeHooks.js"),
  ).href;
  return `--disable-warning=ExperimentalWarning --import ${registrar}`;
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

function runPreparedEntry(
  parsed: Exclude<ReturnType<typeof parseCLI>, "help" | "version">,
  execution: ReturnType<typeof prepareExecution>,
  cwd: string,
  cacheDir: string | undefined,
): number {
  try {
    const args = [
      ...parsed.preload.flatMap((preload) => [
        "-r",
        resolvePreload(cwd, preload),
      ]),
      // Run the entry from its OWN source path; the runtime `load` hook serves
      // its compiled JavaScript, keeping `import.meta.url`/`__dirname` at source.
      execution.entryFile,
      ...parsed.passthrough,
    ];
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      // Install the hooks via NODE_OPTIONS so child processes inherit them,
      // and tell the `load` hook where the gate emitted the entry project.
      NODE_OPTIONS: [process.env.NODE_OPTIONS, runtimeNodeOptions()]
        .filter(Boolean)
        .join(" "),
      TTSC_TTSX_ENTRY_EMIT_DIR: execution.emitDir,
      TTSC_TTSX_ENTRY_EMIT_BASE: execution.emitBase,
    };
    if (parsed.binary !== undefined) {
      env.TTSC_TSGO_BINARY = parsed.binary;
    }
    if (cacheDir !== undefined) {
      env.TTSC_TTSX_PLUGIN_CACHE_DIR = cacheDir;
    }
    if (parsed.checkers !== undefined) {
      env.TTSC_TTSX_CHECKERS = String(parsed.checkers);
    }
    if (parsed.singleThreaded) {
      env.TTSC_TTSX_SINGLE_THREADED = "1";
    }
    if (parsed.noPlugins) {
      env.TTSC_TTSX_NO_PLUGINS = "1";
    }
    if (parsed.tsgoFlags.length !== 0) {
      env.TTSC_TTSX_TSGO_FLAGS = JSON.stringify(parsed.tsgoFlags);
    }

    const result = spawnSync(process.execPath, args, {
      cwd,
      stdio: "inherit",
      env,
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
