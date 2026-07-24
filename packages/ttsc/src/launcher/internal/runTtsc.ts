import fs from "node:fs";
import path from "node:path";

import { TtscCompiler } from "../../TtscCompiler";
import { readProjectConfig } from "../../compiler/internal/project/readProjectConfig";
import { resolveProjectConfig } from "../../compiler/internal/project/resolveProjectConfig";
import {
  type ResidentCheckWatchChange,
  ResidentCheckWatchSession,
  runBuild,
} from "../../compiler/internal/runBuild";
import { runSingleFileEmit } from "../../compiler/internal/runSingleFileEmit";
import {
  getBoolean,
  getNumber,
  getString,
  parseFlags,
} from "../../flags/parser";
import { resolveFlagSpec } from "../../flags/schema";
import { assertSafeExplicitCacheDirectory } from "../../internal/assertSafeExplicitCacheDirectory";
import {
  isPathWithin,
  legacyGlobalCacheTargets,
  resolveCleanTargets,
  resolveSourceBuildCachePaths,
} from "../../plugin/internal/buildSourcePlugin";
import type { ITtscProjectInputSnapshot } from "../../structures/internal/ITtscProjectInputSnapshot";
import type { TtscBuildOptions } from "../../structures/internal/TtscBuildOptions";
import type { TtscSingleFileEmitOptions } from "../../structures/internal/TtscSingleFileEmitOptions";
import { getCompilerVersionText } from "./getCompilerVersionText";
import { resolveCacheDir } from "./resolveCacheDir";
import { resolveSingleFileOutput } from "./singleFileOutput";
import { type WatchInputChange, WatchTopology } from "./watchTopology";

/**
 * CLI entry point for `ttsc`. Dispatches argv to the appropriate build lane
 * (build, check, fix, format, prepare, clean, or native-delegate) and returns
 * an exit code. Errors thrown by any lane are caught here and written to stderr
 * so the process can exit cleanly.
 *
 * @param argv - Command-line arguments (defaults to `process.argv.slice(2)`).
 * @returns The exit code: `0` on success, `1` on binary-not-found, `2` on user
 *   error or build failure.
 */
export function runTtsc(
  argv: readonly string[] = process.argv.slice(2),
): number {
  try {
    if (argv.length === 0) {
      return runCompatibleBuild([], "build");
    }

    const [command, ...rest] = argv as [string, ...string[]];
    // A leading flag is dispatched by its schema identity, so every spelling the
    // compiler accepts (`--HELP`, `-Version`) reaches the same branch instead of
    // falling through to the build lane where nothing reads it back out.
    // `resolveFlagSpec` ignores dash-less tokens, so the bare `help` / `version`
    // subcommand words below keep their own meaning.
    const leadingFlag = resolveFlagSpec(command)?.name;
    switch (leadingFlag ?? command) {
      case "--help":
      case "help":
        printHelp();
        return 0;
      case "--version":
      case "version":
        process.stdout.write(`${getCompilerVersionText()}\n`);
        return 0;
      case "build":
        return runCompatibleBuild(rest, "build");
      case "check":
        return runCompatibleBuild(rest, "check");
      case "fix":
        return runCompatibleBuild(rest, "fix");
      case "format":
        return runCompatibleBuild(rest, "format");
      case "cache":
        return runCache(rest);
      case "clean":
        return runClean(rest);
      case "prepare":
        return runPrepare(rest);
      case "--tsconfig":
        return runCompatibleBuild(argv, "build");
      default:
        if (isBuildAlias(command)) {
          return runCompatibleBuild(argv, "build");
        }
        process.stderr.write(
          `ttsc: unknown command ${JSON.stringify(command)}\n`,
        );
        process.stderr.write(
          `ttsc: run "ttsc --help" to see supported commands\n`,
        );
        return 2;
    }
  } catch (error) {
    process.stderr.write(`${formatError(error)}\n`);
    return 2;
  }
}

/**
 * Return `true` when `command` looks like a build argument rather than a
 * subcommand name — a flag (`-p`, `--watch`, …) or a TypeScript/config file
 * path. These are forwarded to the build lane unchanged so users can write
 * `ttsc -p tsconfig.json` without an explicit `build` subcommand.
 */
function isBuildAlias(command: string): boolean {
  if (command.startsWith("-")) return true;
  return [".json", ".ts", ".tsx", ".mts", ".cts"].some((ext) =>
    command.endsWith(ext),
  );
}

type TtscMode = "build" | "check" | "fix" | "format";

function runCompatibleBuild(argv: readonly string[], mode: TtscMode): number {
  const checkOnly = mode !== "build";
  const options = normalizeBuildOptions(parseBuildArgs(argv));
  if (mode === "fix") {
    if (options.emit === true) {
      throw new Error("ttsc: fix and --emit are mutually exclusive");
    }
    options.fix = true;
    options.emit = false;
  }
  if (mode === "format") {
    if (options.emit === true) {
      throw new Error("ttsc: format and --emit are mutually exclusive");
    }
    options.format = true;
    options.emit = false;
  }
  if (options.watch) {
    if (mode === "fix") {
      throw new Error(
        "ttsc: fix does not support watch mode; use ttsc --noEmit --watch for incremental checks",
      );
    }
    if (mode === "format") {
      throw new Error(
        "ttsc: format does not support watch mode; use ttsc --noEmit --watch for incremental checks",
      );
    }
    return runWatch(options, checkOnly);
  }
  const buildOptions = checkOnly ? { ...options, emit: false } : options;
  if (buildOptions.files.length !== 0) {
    if (mode === "fix") {
      throw new Error("ttsc: fix requires a project, not single-file mode");
    }
    if (mode === "format") {
      throw new Error("ttsc: format requires a project, not single-file mode");
    }
    return runSingleFile(buildOptions);
  }
  const result = runBuild(buildOptions);
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  return result.status;
}

function normalizeBuildOptions(
  options: ReturnType<typeof parseBuildArgs>,
): ReturnType<typeof parseBuildArgs> {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  return {
    ...options,
    cacheDir: resolveCacheDir(cwd, options.cacheDir),
    cwd,
  };
}

function runPrepare(argv: readonly string[]): number {
  const options = parseProjectArgs(argv);
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const compiler = new TtscCompiler({
    cacheDir: options.cacheDir,
    cwd,
    tsconfig: options.tsconfig,
  });
  const prepared = compiler.prepare();
  if (prepared.length === 0) {
    const projectRoot = path.dirname(
      resolveProjectConfig({
        cwd,
        tsconfig: options.tsconfig,
      }),
    );
    process.stdout.write(
      `ttsc: no source plugins found under ${formatProjectPath(cwd, projectRoot)}\n`,
    );
    return 0;
  }
  for (const target of prepared) {
    process.stdout.write(`ttsc: prepared ${formatProjectPath(cwd, target)}\n`);
  }
  return 0;
}

function runClean(argv: readonly string[]): number {
  const options = parseProjectArgs(argv);
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const projectRoot = resolveCleanProjectRoot(cwd, options.tsconfig);
  const explicitCacheDir = options.cacheDir
    ? path.resolve(cwd, options.cacheDir)
    : undefined;
  if (explicitCacheDir !== undefined) {
    assertSafeExplicitCacheDirectory(projectRoot, explicitCacheDir);
  }
  const targets = explicitCacheDir
    ? // Explicit `ttsc clean --cache-dir X`: the user names X as the cache to
      // remove for this command, so remove it wholesale plus the legacy
      // project-local caches.
      [
        explicitCacheDir,
        path.join(projectRoot, "node_modules", ".ttsc"),
        path.join(projectRoot, ".ttsc"),
      ]
    : // Default / TTSC_CACHE_DIR: remove only ttsc-owned subdirectories (a
      // possibly-shared root is never deleted) plus the pre-0.17 machine-global
      // cache so upgraders reclaim that disk.
      [...resolveCleanTargets(projectRoot), ...legacyGlobalCacheTargets()];
  const removed: string[] = [];
  for (const target of targets) {
    if (!fs.existsSync(target)) continue;
    fs.rmSync(target, { recursive: true, force: true });
    removed.push(target);
  }
  if (removed.length === 0) {
    process.stdout.write(
      `ttsc: no cache directories found under ${projectRoot}\n`,
    );
    return 0;
  }
  for (const target of removed) {
    process.stdout.write(`ttsc: removed ${formatProjectPath(cwd, target)}\n`);
  }
  return 0;
}

function runCache(argv: readonly string[]): number {
  const [command, ...rest] = argv as [string | undefined, ...string[]];
  switch (command) {
    case "paths":
      return runCachePaths(rest);
    case "-h":
    case "--help":
    case "help":
    case undefined:
      printCacheHelp();
      return 0;
    default:
      process.stderr.write(
        `ttsc: unknown cache command ${JSON.stringify(command)}\n`,
      );
      process.stderr.write(
        `ttsc: run "ttsc cache --help" to see supported cache commands\n`,
      );
      return 2;
  }
}

function runCachePaths(argv: readonly string[]): number {
  const options = parseCachePathsArgs(argv);
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const cacheDir = resolveCacheDir(cwd, options.cacheDir);
  const projectRoot = resolveCleanProjectRoot(cwd, options.tsconfig);
  const paths = resolveSourceBuildCachePaths(projectRoot, cacheDir);
  // The minimal directory set a CI cache step must persist. The Go build cache
  // is folded in only when it lives outside the ttsc cache root (an explicit
  // GOCACHE / TTSC_GO_CACHE_DIR); by default it nests under `root`.
  const cacheableRoots = [
    paths.root,
    ...(isPathWithin(paths.goBuildRoot, paths.root) ? [] : [paths.goBuildRoot]),
  ];
  if (options.json) {
    process.stdout.write(
      `${JSON.stringify(
        {
          cacheRoot: paths.root,
          cacheableRoots,
          cwd,
          goBuildCacheRoot: paths.goBuildRoot,
          goBuildCacheSource: paths.goBuildRootSource,
          pluginCacheRoot: paths.pluginRoot,
          projectRoot,
        },
        null,
        2,
      )}\n`,
    );
    return 0;
  }
  process.stdout.write(
    [
      "ttsc source-plugin cache paths:",
      `  cache root       ${paths.root}`,
      `  plugin binaries  ${paths.pluginRoot}`,
      `  go build cache   ${paths.goBuildRoot} (${paths.goBuildRootSource})`,
      "",
      "Persist these between CI jobs to skip cold plugin rebuilds:",
      ...cacheableRoots.map((root) => `  ${root}`),
      "",
    ].join("\n"),
  );
  return 0;
}

function parseCachePathsArgs(argv: readonly string[]): {
  cacheDir?: string;
  cwd?: string;
  json: boolean;
  tsconfig?: string;
} {
  const out: {
    cacheDir?: string;
    cwd?: string;
    json: boolean;
    tsconfig?: string;
  } = { json: false };
  const rest = [...argv];
  while (rest.length !== 0) {
    const token = rest.shift()!;
    const [rawFlag, inlineValue] = splitInlineFlag(token);
    const flag = resolveFlagSpec(rawFlag);
    if (flag?.subcommands.includes("cache") !== true) {
      throw new Error(
        `ttsc: cache paths does not support ${JSON.stringify(token)}`,
      );
    }
    switch (flag.name) {
      case "--json":
        if (inlineValue !== undefined) {
          throw new Error("ttsc: --json does not take a value");
        }
        out.json = true;
        break;
      case "--cache-dir":
        out.cacheDir = readCachePathsValue(flag.name, inlineValue, rest);
        break;
      case "--cwd":
        out.cwd = readCachePathsValue(flag.name, inlineValue, rest);
        break;
      case "--tsconfig":
        out.tsconfig = readCachePathsValue(flag.name, inlineValue, rest);
        break;
      default:
        throw new Error(
          `ttsc: cache paths does not support ${JSON.stringify(token)}`,
        );
    }
  }
  return out;
}

function splitInlineFlag(token: string): [string, string | undefined] {
  if (!token.startsWith("-")) {
    return [token, undefined];
  }
  const equals = token.indexOf("=");
  return equals === -1
    ? [token, undefined]
    : [token.slice(0, equals), token.slice(equals + 1)];
}

function readCachePathsValue(
  flag: string,
  inlineValue: string | undefined,
  rest: string[],
): string {
  if (inlineValue !== undefined) {
    return inlineValue;
  }
  const value = rest.shift();
  if (value === undefined) {
    throw new Error(`ttsc: ${flag} requires a value`);
  }
  if (value.startsWith("-")) {
    rest.unshift(value);
    throw new Error(
      `ttsc: ${flag} requires a value (next token ${JSON.stringify(value)} starts with "-")`,
    );
  }
  return value;
}

function resolveCleanProjectRoot(cwd: string, tsconfig?: string): string {
  try {
    return path.dirname(resolveProjectConfig({ cwd, tsconfig }));
  } catch (error) {
    if (tsconfig) throw error;
    return cwd;
  }
}

function formatProjectPath(cwd: string, target: string): string {
  const relative = path.relative(cwd, target);
  if (!relative || isOutsideRelativePath(relative)) {
    return target;
  }
  return relative;
}

function isOutsideRelativePath(relative: string): boolean {
  return (
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  );
}

function parseProjectArgs(argv: readonly string[]) {
  // `prepare` and `clean` are project-shaped commands. They share the same
  // schema as the build lane; the engine forwards unknown flags as well as
  // build-only flags (e.g. `--strict`) to the launcher's passthrough list
  // so the legacy "unknown option" behaviour is no longer a separate trap
  // (RC-3 + RC-4 prevention; see issue #125 §5 in the RCA).
  const result = parseFlags({
    argv,
    errorPrefix: "ttsc:",
    subcommand: "prepare",
  });
  return {
    cacheDir: getString(result, "--cache-dir"),
    cwd: getString(result, "--cwd"),
    tsconfig: getString(result, "--tsconfig"),
  };
}

function parseBuildArgs(argv: readonly string[]) {
  const result = parseFlags({
    argv,
    errorPrefix: "ttsc:",
    // A bare token is a single-file input only when it carries a TypeScript
    // source extension; any other bare token is the space-separated value of a
    // preceding forwarded flag (e.g. the `es2020` in `--target es2020`). The
    // parser routes those values into `passthrough` in place, so the forwarded
    // flag/value pairs reach tsgo in their original order.
    isPositional: looksLikeInputFile,
    subcommand: "build",
  });
  // Defaults: pinned by the previous hand-parser. `quiet` defaults true,
  // `--verbose` flips it to false; `emit` defaults `undefined` so the resolved
  // project controls ordinary build mode. `runCompatibleBuild` applies the
  // check/fix/format no-emit decision before either execution lane runs.
  const verbose = getBoolean(result, "--verbose");
  const quietFlag = getBoolean(result, "--quiet");
  const quiet = verbose === true ? false : (quietFlag ?? true);
  const explicitEmit = getBoolean(result, "--emit");
  const explicitNoEmit = getBoolean(result, "--noEmit");
  const emit = resolveExplicitEmit(explicitEmit, explicitNoEmit);

  // `isPositional: looksLikeInputFile` guarantees every `result.positional`
  // token is a TypeScript input file; forwarded flag values already live in
  // `result.passthrough` in their original order, so no reconstruction is
  // needed here (the previous `[...passthrough, ...trailingValues]` concat
  // reordered every flag ahead of every value).
  const files = [...result.positional];
  const passthrough = [...result.passthrough];

  return {
    binary: getString(result, "--binary"),
    cacheDir: getString(result, "--cache-dir"),
    checkers: getNumber(result, "--checkers"),
    cwd: getString(result, "--cwd"),
    emit,
    files,
    fix: false,
    format: false,
    outDir: getString(result, "--outDir"),
    passthrough,
    preserveWatchOutput: getBoolean(result, "--preserveWatchOutput") === true,
    quiet,
    singleThreaded: getBoolean(result, "--singleThreaded") === true,
    tsconfig: getString(result, "--tsconfig"),
    watch: getBoolean(result, "--watch") === true,
  };
}

/**
 * Collapse the two launcher-owned emit switches into the tri-state consumed by
 * `runBuild` and the single-file lane. A specified boolean is significant even
 * when it is `false`: `--emit=false` is analysis-only and `--noEmit=false`
 * explicitly overrides a project's `noEmit`. `--emit` retains precedence when
 * callers supply both switches, matching the legacy true-only resolution.
 */
function resolveExplicitEmit(
  explicitEmit: boolean | undefined,
  explicitNoEmit: boolean | undefined,
): boolean | undefined {
  if (explicitEmit !== undefined) return explicitEmit;
  return explicitNoEmit === undefined ? undefined : !explicitNoEmit;
}

/**
 * Report whether a bare CLI token is a TypeScript source file ttsc should
 * compile in single-file mode. Anything without a TypeScript source extension
 * is treated as a forwarded flag value rather than an input file.
 */
function looksLikeInputFile(token: string): boolean {
  return [".ts", ".tsx", ".mts", ".cts"].some((ext) => token.endsWith(ext));
}

function printHelp(): void {
  process.stdout.write(
    [
      "ttsc — standalone compiler adapter and plugin host for tsgo.",
      "",
      "Usage:",
      "  ttsc",
      "  ttsc -p tsconfig.json",
      "  ttsc --watch",
      "  ttsc --noEmit",
      "  ttsc fix",
      "  ttsc format",
      "  ttsc cache paths --json [options]",
      "  ttsc prepare [options]",
      "  ttsc clean [options]",
      "  ttsc version",
      "  ttsc --help",
      "",
      "Options:",
      "  -p, --project <file>   Resolve project settings from this tsconfig",
      "  --tsconfig <file>      Resolve project settings from this tsconfig",
      "  --cwd <dir>            Resolve project-relative paths from this directory",
      "  --emit                 Force emitted files during build",
      "  --noEmit               Force analysis-only build with no file writes",
      "  -w, --watch            Rebuild when project files change",
      "  --preserveWatchOutput  Do not clear the screen between watch rebuilds",
      "  --outDir <dir>         Override compilerOptions.outDir for this invocation",
      "  --quiet                Keep build output quiet (default)",
      "  --verbose              Print the build summary and emitted files",
      "  --binary <path>        Use an explicit tsgo binary",
      "  --cache-dir <dir>      Use this cache root for source-plugin builds",
      "  --singleThreaded       Run TypeScript-Go single-threaded (one checker)",
      "  --checkers <n>         Type-checker pool size (default: TypeScript-Go's)",
      "",
      "  Any other flag is forwarded to tsgo as-is, so tsgo compiler options",
      "  such as --strict or --target work directly (e.g. ttsc --strict file.ts).",
      "",
      "Plugin contract:",
      "  ttsc reads compilerOptions.plugins from tsconfig.json.",
      "  Plugin modules are descriptors for ordered native transformer backends.",
      "  JS transformOutput/transformSource functions are not part of the public contract.",
      "",
      "Subcommands:",
      "  ttsc build [options]       Same project build lane as `ttsc [options]`.",
      "  ttsc check [options]       Same as `ttsc --noEmit [options]`.",
      "  ttsc fix [options]         Apply check-plugin lint + format edits, then run `ttsc check`.",
      "  ttsc format [options]      Apply check-plugin format-class edits only (write-only, no type check).",
      "  ttsc cache paths --json    Print source-plugin and Go build cache paths for CI.",
      "  ttsc prepare [options]     Build configured source-plugin binaries into cache.",
      "  ttsc clean [options]       Delete source-plugin cache directories.",
    ].join("\n"),
  );
  process.stdout.write("\n");
}

function printCacheHelp(): void {
  process.stdout.write(
    [
      "ttsc cache commands.",
      "",
      "Usage:",
      "  ttsc cache paths --json [options]",
      "",
      "Options:",
      "  --json                Print paths as JSON",
      "  -p, --project <file>  Resolve project settings from this tsconfig",
      "  --tsconfig <file>     Resolve project settings from this tsconfig",
      "  --cwd <dir>           Resolve project-relative paths from this directory",
      "  --cache-dir <dir>     Use this cache root for source-plugin builds",
    ].join("\n"),
  );
  process.stdout.write("\n");
}

function runSingleFile(
  options: ReturnType<typeof parseBuildArgs> &
    Pick<TtscSingleFileEmitOptions, "onProjectInputs" | "onWatchInputs">,
): number {
  if (options.files.length !== 1) {
    throw new Error(
      "ttsc: single-file mode currently accepts exactly one input file",
    );
  }
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const file = path.resolve(cwd, options.files[0]!);
  const emit = singleFileShouldEmit(options, cwd, file);
  const out = emit
    ? resolveSingleFileOutput({
        cliOutDir: options.outDir,
        cwd,
        file,
        tsconfig: options.tsconfig,
      })
    : undefined;
  const text = runSingleFileEmit({
    binary: options.binary,
    checkers: options.checkers,
    cwd,
    file,
    onProjectInputs: options.onProjectInputs,
    onWatchInputs: options.onWatchInputs,
    out,
    passthrough: options.passthrough,
    singleThreaded: options.singleThreaded,
    tsconfig: options.tsconfig,
  });
  if (out !== undefined && !fs.existsSync(out)) {
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, text, "utf8");
  }
  if (out !== undefined) {
    process.stdout.write(`${path.relative(cwd, out) || path.basename(out)}\n`);
  }
  return 0;
}

/**
 * Resolve the same effective emit decision used by the project lane before
 * entering the single-file compatibility path. The compatibility path still
 * emits into a private temporary directory to obtain transformed text and
 * diagnostics, but only this boundary is allowed to write into the user's
 * tree.
 */
function singleFileShouldEmit(
  options: ReturnType<typeof parseBuildArgs>,
  cwd: string,
  file: string,
): boolean {
  if (options.emit !== undefined) return options.emit;
  const project = readProjectConfig({
    cwd,
    file,
    tsconfig: options.tsconfig,
  });
  return project.compilerOptions.noEmit !== true;
}

function runWatch(
  options: ReturnType<typeof parseBuildArgs>,
  checkOnly: boolean,
): number {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  let topology: WatchTopology | undefined;
  const invocation = {
    ...(checkOnly ? { ...options, emit: false } : options),
    cwd,
    onWatchInputs: (inputs: readonly string[]) => {
      topology?.setExtraInputs(inputs);
    },
    onProjectInputs: (inputs: ITtscProjectInputSnapshot) => {
      topology?.setProjectInputs(inputs);
    },
    quiet: true,
  };
  const root = path.dirname(
    resolveProjectConfig({
      cwd,
      tsconfig: options.tsconfig,
    }),
  );
  let running = false;
  let rerun = false;
  let timer: NodeJS.Timeout | null = null;
  const resident =
    invocation.files.length === 0 ? new ResidentCheckWatchSession() : undefined;
  const pendingChanges = new PendingResidentCheckWatchChanges();
  // Tracks the most recent build's exit code so the watch session can exit
  // non-zero when its latest rebuild failed, instead of always reporting 0.
  let lastStatus = 0;

  const runOnce = async () => {
    running = true;
    const change = pendingChanges.take();
    let completed = false;
    try {
      if (!options.preserveWatchOutput) {
        process.stdout.write("\x1bc");
      }
      process.stdout.write(
        `[ttsc] rebuilding at ${new Date().toLocaleTimeString()}\n`,
      );
      // The debounced rebuild fires from setTimeout, outside runTtsc's
      // top-level try/catch. runBuild/runSingleFile/loadProjectPlugins/
      // readProjectConfig can throw (plugin go-build failure, tsconfig edited
      // to invalid JSON, single-file invariant). Catch here so a throwing
      // rebuild reports a clear failure and the watcher keeps running instead
      // of crashing the process with an uncaught exception.
      const status = await (invocation.files.length !== 0
        ? Promise.resolve(runSingleFile(invocation))
        : (async () => {
            const buildOptions = checkOnly
              ? { ...invocation, emit: false }
              : invocation;
            const result =
              resident === undefined
                ? runBuild(buildOptions)
                : await resident.run(buildOptions, change);
            if (result.stdout) process.stdout.write(result.stdout);
            if (result.stderr) process.stderr.write(result.stderr);
            return result.status;
          })());
      lastStatus = status;
      completed = true;
      process.stdout.write(
        `[ttsc] ${status === 0 ? "watch build complete" : "watch build failed"}\n`,
      );
    } catch (error) {
      process.stderr.write(`${formatError(error)}\n`);
      lastStatus = lastStatus === 0 ? 2 : lastStatus;
      process.stdout.write(`[ttsc] watch build failed\n`);
    } finally {
      running = false;
      if (completed) {
        try {
          // A filesystem event can arrive after the build reports completion
          // but before this synchronous cleanup reaches its re-resolution.
          // Notify for a membership change here as well, otherwise that new
          // input is silently absorbed into the watch set without a rebuild.
          topology?.refresh(true);
        } catch (error) {
          process.stderr.write(
            `[ttsc] watch error on ${path.relative(cwd, root) || "."}: ${formatError(error)}\n`,
          );
        }
      }
    }
    if (rerun) {
      rerun = false;
      trigger();
    }
  };
  const trigger = (change?: WatchInputChange, reload = false) => {
    pendingChanges.push(change, reload);
    if (running) {
      rerun = true;
      return;
    }
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void runOnce(), 60);
  };

  topology = new WatchTopology(invocation, {
    onError: (location, error) => {
      process.stderr.write(
        `[ttsc] watch error on ${path.relative(cwd, location) || "."}: ${formatError(error)}\n`,
      );
    },
    onInputChange: (change) => trigger(change),
    onTopologyChange: () => trigger(undefined, true),
  });
  topology.refresh(false);

  const close = () => {
    if (timer) clearTimeout(timer);
    topology?.close();
    resident?.dispose();
  };
  process.on("SIGINT", () => {
    close();
    process.exit(toExitCode(lastStatus));
  });
  process.on("SIGTERM", () => {
    close();
    process.exit(toExitCode(lastStatus));
  });

  process.stdout.write(`[ttsc] watching ${path.relative(cwd, root) || "."}\n`);
  try {
    void runOnce();
  } catch (error) {
    // runOnce already swallows build throws, but guard against any unforeseen
    // throw escaping the first pass: tear down the persistent watchers so the
    // event loop drains and the process exits cleanly with a non-zero code
    // instead of hanging on live fs.watch handles.
    close();
    process.stderr.write(`${formatError(error)}\n`);
    return toExitCode(lastStatus === 0 ? 2 : lastStatus);
  }
  return toExitCode(lastStatus);
}

/**
 * Coalesces filesystem events until the next resident check-watch cycle.
 *
 * A full reload dominates every narrower signal. Program invalidation remains
 * distinct so a project-input module creation/deletion can cold-load the
 * Program without discarding the selected execution or restarting the sidecar.
 */
export class PendingResidentCheckWatchChanges {
  private readonly changed = new Set<string>();
  private readonly external = new Set<string>();
  private invalidate = false;
  private reload = false;

  public push(change?: WatchInputChange, reload = false): void {
    if (reload || change?.kind === "config" || change?.kind === "plugin") {
      this.reload = true;
      this.invalidate = false;
      this.changed.clear();
      this.external.clear();
      return;
    }
    if (this.reload) return;
    if (change?.invalidate === true) this.invalidate = true;
    if (change?.path === undefined) {
      if (change?.kind === "compiler") {
        this.reload = true;
        this.invalidate = false;
        this.changed.clear();
        this.external.clear();
      }
      return;
    }
    this.changed.add(change.path);
    if (change.kind === "project") this.external.add(change.path);
  }

  public take(): ResidentCheckWatchChange {
    const change: ResidentCheckWatchChange = {
      ...(this.reload ? { reload: true } : {}),
      ...(this.invalidate ? { invalidate: true } : {}),
      ...(this.changed.size === 0 ? {} : { changed: [...this.changed].sort() }),
      ...(this.external.size === 0
        ? {}
        : { external: [...this.external].sort() }),
    };
    this.reload = false;
    this.invalidate = false;
    this.changed.clear();
    this.external.clear();
    return change;
  }
}

// Coerces a build status into a valid process exit code: 0 stays 0, any
// non-zero (or non-finite) status collapses to 1 so the session signals failure.
function toExitCode(status: number): number {
  return Number.isInteger(status) && status >= 0 && status <= 255 ? status : 1;
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
