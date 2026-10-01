import fs from "node:fs";
import path from "node:path";

import { TtscCompiler } from "../../TtscCompiler";
import { ResidentCheckWatchSession } from "../../compiler/internal/build/ResidentCheckWatchSession";
import { runBuild } from "../../compiler/internal/build/runBuild";
import { readProjectConfig } from "../../compiler/internal/project/readProjectConfig";
import { resolveProjectConfig } from "../../compiler/internal/project/resolveProjectConfig";
import { runSingleFileEmit } from "../../compiler/internal/runSingleFileEmit";
import { SidecarEnvironment } from "../../compiler/internal/sharedHost/SidecarEnvironment";
import { getBoolean } from "../../flags/getBoolean";
import { getString } from "../../flags/getString";
import { parseFlags } from "../../flags/parseFlags";
import { resolveFlagSpec } from "../../flags/resolveFlagSpec";
import { cacheEntryExists } from "../../internal/cacheEntryExists";
import { createFilesystemPathIdentityContext } from "../../internal/pathIdentity/createFilesystemPathIdentityContext";
import { isFilesystemPathIdentityWithin } from "../../internal/pathIdentity/isFilesystemPathIdentityWithin";
import { resolvePhysicalPath } from "../../internal/pathIdentity/resolvePhysicalPath";
import { resolveSafeCacheCleanupTargets } from "../../internal/resolveSafeCacheCleanupTargets";
import { SourceBuildCacheLayout } from "../../plugin/internal/source/SourceBuildCacheLayout";
import { legacyGlobalCacheTargets } from "../../plugin/internal/source/legacyGlobalCacheTargets";
import { resolveCleanTargets } from "../../plugin/internal/source/resolveCleanTargets";
import { resolveSourceBuildCachePaths } from "../../plugin/internal/source/resolveSourceBuildCachePaths";
import type { ITtscProjectInputSnapshot } from "../../structures/internal/ITtscProjectInputSnapshot";
import type { TtscSingleFileEmitOptions } from "../../structures/internal/TtscSingleFileEmitOptions";
import { PendingResidentCheckWatchChanges } from "./PendingResidentCheckWatchChanges";
import { prepareTtscBuildMode, type TtscBuildMode } from "./prepareTtscBuildMode";
import { parseTtscBuildArgs } from "./parseTtscBuildArgs";
import { getCompilerVersionText } from "./getCompilerVersionText";
import { resolveCacheDir } from "./resolveCacheDir";
import { resolveSingleFileOutput } from "./resolveSingleFileOutput";
import { resolveRuntimeCleanTargets } from "./runtime/resolveRuntimeCleanTargets";
import { withRuntimeDirectoryLock } from "./runtime/withRuntimeDirectoryLock";
import { type WatchInputChange } from "./watch/WatchInputChange";
import { WatchTopology } from "./watch/WatchTopology";

/**
 * CLI entry point for `ttsc`. Dispatches argv to the appropriate build lane
 * (build, check, fix, format, prepare, clean, or native-delegate) and returns
 * an exit code. Errors thrown by any lane are caught here and written to stderr
 * so the process can exit cleanly.
 *
 * Watch setup returns before its asynchronous first build finishes. Signal
 * shutdown uses the latest completed build status; topology failure closes the
 * owned watchers and resident host. Cache cleanup validates its full target set
 * and preserves the caller's Go cache, including overlapping explicit targets.
 *
 * @param argv - Command-line arguments (defaults to `process.argv.slice(2)`).
 *
 * @returns The selected lane's status, or `2` for an error caught by this
 *   entry.
 *
 * @evidence contracts/common.md#principled-implementation Command and schema identities select the declared build, check, edit and cache lanes; emit tri-state and ordered passthrough values preserve compiler authority, while the whole physical cleanup transaction protects project and caller-owned Go cache state.
 * @evidence contracts/common.md#clear-and-simple-design One public entry owns dispatch and reporting; private argument, cleanup, single-file and watch operations isolate their distinct lifecycles while sharing the package's flag and build owners.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Command names and debounce timing are declared CLI policy, not consumer-specific answers; failures keep their real statuses, and source changes cannot be hidden by caching an earlier plugin binary.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs distinguish synchronous dispatch from watch lifetime and explain cleanup authority; parameter and result descriptions are separated from acknowledgments following the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation Native cwd resolution and physical identities anchor reporting, cache containment and deletion; environment lookup preserves native name identity, and process/watch behavior is delegated to supported package boundaries rather than shell commands.
 * @evidence contracts/performance.md#efficient-algorithms Argument cursors visit each token once without repeated head shifts; cleanup shares one identity context and deduplicates deletion paths. Watch work includes compiler discovery and input fingerprinting owned by its topology rather than an extra launcher transform.
 * @evidence contracts/performance.md#reuse-equivalent-work A watch lifetime retains one resident check coordinator and forwards ordered change deltas; topology changes reset that selection, while ordinary effectful builds remain separate and source-built binaries reuse only their validated input identity.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Watch setup, failure and signal shutdown share idempotent cleanup of timer, signal listeners, topology and resident hosts; pending changes belong to the current cycle. Input-dependent topology state persists until shutdown, while cache cleanup retains no historical target population.
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

function runCompatibleBuild(argv: readonly string[], mode: TtscBuildMode): number {
  const checkOnly = mode !== "build";
  const options = prepareTtscBuildMode(normalizeBuildOptions(parseTtscBuildArgs(argv)), mode);
  if (options.watch) return runWatch(options, checkOnly);
  if (options.files.length !== 0) return runSingleFile(options);
  const result = runBuild(options);
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  return result.status;
}

function normalizeBuildOptions(
  options: ReturnType<typeof parseTtscBuildArgs>,
): ReturnType<typeof parseTtscBuildArgs> {
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
    return runCleanWithContext(cwd, projectRoot, explicitCacheDir, false);
  }
  const runtimeRoot = path.join(
    resolveSourceBuildCachePaths(projectRoot).root,
    SourceBuildCacheLayout.RUNTIME_CACHE_DIRNAME,
  );
  return cacheEntryExists(runtimeRoot)
    ? withRuntimeDirectoryLock(runtimeRoot, () =>
        runCleanWithContext(cwd, projectRoot, undefined, true),
      )
    : runCleanWithContext(cwd, projectRoot, undefined, false);
}

/** Resolve and remove the complete safe target set inside the runtime lock. */
function runCleanWithContext(
  cwd: string,
  projectRoot: string,
  explicitCacheDir: string | undefined,
  includeRuntime: boolean,
): number {
  // The runtime directories of runs no process still owns. A run that may
  // still be in progress keeps its own, and is reported (samchon/ttsc#1579).
  const runtime =
    includeRuntime && explicitCacheDir === undefined
      ? resolveRuntimeCleanTargets(
          resolveSourceBuildCachePaths(projectRoot).root,
        )
      : { kept: [], targets: [] };
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
      [
        ...resolveCleanTargets(projectRoot),
        ...runtime.targets,
        ...legacyGlobalCacheTargets(),
      ];
  // Check the complete deletion set before removing the first directory. An
  // environment-selected TTSC_GO_CACHE_DIR and a legacy-global cache can be as
  // destructive as an explicit --cache-dir when either equals or contains the
  // project through its lexical spelling or a filesystem alias.
  const providedGoCache = SidecarEnvironment.read(
    process.env,
    "GOCACHE",
  )?.trim();
  const protectedDirectories =
    providedGoCache === undefined ||
    providedGoCache.length === 0 ||
    providedGoCache === "off"
      ? []
      : [path.resolve(projectRoot, providedGoCache)];
  // Every lane, including explicit and legacy/runtime candidates, preserves
  // the caller's Go cache even when a ttsc-owned spelling overlaps it.
  const safeTargets = resolveSafeCacheCleanupTargets(
    projectRoot,
    targets,
    {},
    protectedDirectories,
  );
  const removed: string[] = [];
  const visited = new Set<string>();
  for (const target of safeTargets) {
    if (visited.has(target.path)) continue;
    visited.add(target.path);
    if (!target.exists || !cacheEntryExists(target.path)) continue;
    fs.rmSync(target.path, { recursive: true, force: true });
    removed.push(target.requestedPath);
  }
  if (removed.length === 0 && runtime.kept.length === 0) {
    process.stdout.write(
      `ttsc: no cache directories found under ${projectRoot}\n`,
    );
  }
  for (const target of removed) {
    process.stdout.write(`ttsc: removed ${formatProjectPath(cwd, target)}\n`);
  }
  for (const directory of runtime.kept) {
    process.stdout.write(
      `ttsc: kept ${formatProjectPath(cwd, directory)}: a run that may still be in progress owns it\n`,
    );
  }
  return 0;
}

function runCache(argv: readonly string[]): number {
  const [command, ...rest] = argv as [string | undefined, ...string[]];
  const leadingFlag =
    command === undefined ? undefined : resolveFlagSpec(command)?.name;
  switch (leadingFlag ?? command) {
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
  const identities = createFilesystemPathIdentityContext();
  const rootIdentity = identities.resolve(paths.root);
  const goIdentity = identities.resolve(paths.goBuildRoot);
  // Legacy combined roots retained for JSON compatibility. `requiredRoots`
  // identifies the compiled binaries that skip cold builds;
  // `acceleratorRoots` separately identifies the optional Go object cache.
  const cacheableRoots = [
    paths.root,
    ...(isFilesystemPathIdentityWithin(rootIdentity.key, goIdentity.key)
      ? []
      : [paths.goBuildRoot]),
  ];
  const requiredRoots = [paths.pluginRoot];
  const acceleratorRoots = [paths.goBuildRoot];
  if (options.json) {
    process.stdout.write(
      `${JSON.stringify(
        {
          cacheRoot: paths.root,
          acceleratorRoots,
          cacheableRoots,
          cwd,
          goBuildCacheRoot: paths.goBuildRoot,
          goBuildCacheSource: paths.goBuildRootSource,
          pluginCacheRoot: paths.pluginRoot,
          projectRoot,
          requiredRoots,
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
      "Persist this required cache to skip cold plugin rebuilds:",
      ...requiredRoots.map((root) => `  ${root}`),
      "Optionally persist this Go object accelerator for future cache misses:",
      ...acceleratorRoots.map((root) => `  ${root}`),
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
  let index = 0;
  const readValue = (flag: string, inlineValue: string | undefined): string => {
    if (inlineValue !== undefined) return inlineValue;
    const value = argv[index++];
    if (value === undefined) {
      throw new Error(`ttsc: ${flag} requires a value`);
    }
    if (value.startsWith("-")) {
      throw new Error(
        `ttsc: ${flag} requires a value (next token ${JSON.stringify(value)} starts with "-")`,
      );
    }
    return value;
  };
  while (index < argv.length) {
    const token = argv[index++]!;
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
        out.cacheDir = readValue(flag.name, inlineValue);
        break;
      case "--cwd":
        out.cwd = readValue(flag.name, inlineValue);
        break;
      case "--tsconfig":
        out.tsconfig = readValue(flag.name, inlineValue);
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

function resolveCleanProjectRoot(cwd: string, tsconfig?: string): string {
  try {
    return path.dirname(resolveProjectConfig({ cwd, tsconfig }));
  } catch (error) {
    if (tsconfig) throw error;
    return cwd;
  }
}

function formatProjectPath(cwd: string, target: string): string {
  const relative = relativeToCwd(cwd, target);
  return !relative || isOutsideRelativePath(relative) ? target : relative;
}

/**
 * `target` relative to `cwd`, both as the filesystem names them.
 *
 * The project, its caches, and its outputs resolve to their physical directory,
 * while the cwd is spelled as the user reached it, possibly through a link or
 * macOS's `/var`. Relating two spellings of one directory walks out through the
 * link and back in, so both sides go through the one resolver that names paths
 * physically (`resolvePhysicalPath`).
 */
function relativeToCwd(cwd: string, target: string): string {
  return path.relative(resolvePhysicalPath(cwd), resolvePhysicalPath(target));
}

/**
 * `location` as a watch message names it: relative to the cwd, `.` for the cwd
 * itself, and through `..` when it lies outside.
 */
function watchMessagePath(cwd: string, location: string): string {
  return relativeToCwd(cwd, location) || ".";
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
  options: ReturnType<typeof parseTtscBuildArgs> &
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
        passthrough: options.passthrough,
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
    process.stdout.write(`${relativeToCwd(cwd, out) || path.basename(out)}\n`);
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
  options: ReturnType<typeof parseTtscBuildArgs>,
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
  options: ReturnType<typeof parseTtscBuildArgs>,
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
  let closed = false;
  let rerun = false;
  let timer: NodeJS.Timeout | null = null;
  const resident =
    invocation.files.length === 0 ? new ResidentCheckWatchSession() : undefined;
  const pendingChanges = new PendingResidentCheckWatchChanges();
  // Tracks the most recent build's exit code so the watch session can exit
  // non-zero when its latest rebuild failed, instead of always reporting 0.
  let lastStatus = 0;

  const runOnce = async () => {
    if (closed) return;
    running = true;
    const change = pendingChanges.take();
    if (process.env.TTSC_WATCH_DEBUG_INPUTS)
      debugWatchInputs(`cycle ${JSON.stringify(change)}`);
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
            // Watch output is one ordered stream. The diagnostics a build
            // produced and the "[ttsc] watch build …" marker that concludes
            // them reach a single merged reader, and on two pipes the OS may
            // hand it the marker first — a reader that counts the build on the
            // marker then snapshots before the diagnostics land and sees an
            // empty build. The rebuilding banner, the screen clear, and the
            // marker are already on stdout, so the diagnostics join them there,
            // the way tsc --watch prints everything to one place.
            if (result.stdout) process.stdout.write(result.stdout);
            if (result.stderr) process.stdout.write(result.stderr);
            return result.status;
          })());
      lastStatus = status;
      completed = true;
      process.stdout.write(
        `[ttsc] ${status === 0 ? "watch build complete" : "watch build failed"}\n`,
      );
    } catch (error) {
      // Same ordered-stream rule as the build path: the failure text goes on
      // the stream the marker below uses, so a merged reader sees them in order
      // rather than racing two pipes.
      process.stdout.write(`${formatError(error)}\n`);
      lastStatus = lastStatus === 0 ? 2 : lastStatus;
      process.stdout.write(`[ttsc] watch build failed\n`);
    } finally {
      running = false;
      if (completed && !closed) {
        try {
          // A filesystem event can arrive after the build reports completion
          // but before this synchronous cleanup reaches its re-resolution.
          // Notify for a membership change here as well, otherwise that new
          // input is silently absorbed into the watch set without a rebuild.
          topology?.refresh(true);
        } catch (error) {
          process.stderr.write(
            `[ttsc] watch error on ${watchMessagePath(cwd, root)}: ${formatError(error)}\n`,
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
    if (closed) return;
    pendingChanges.push(change, reload);
    if (running) {
      rerun = true;
      return;
    }
    if (timer) clearTimeout(timer);
    timer = setTimeout(startRun, 60);
  };

  const close = () => {
    if (closed) return;
    closed = true;
    if (timer) clearTimeout(timer);
    timer = null;
    process.off("SIGINT", onInterrupt);
    process.off("SIGTERM", onTerminate);
    try {
      topology?.close();
    } finally {
      resident?.dispose();
    }
  };
  const onInterrupt = () => {
    close();
    process.exit(toExitCode(lastStatus));
  };
  const onTerminate = () => {
    close();
    process.exit(toExitCode(lastStatus));
  };
  const startRun = () => {
    void runOnce().catch((error: unknown) => {
      close();
      process.stderr.write(`${formatError(error)}\n`);
      process.exitCode = toExitCode(lastStatus === 0 ? 2 : lastStatus);
    });
  };

  topology = new WatchTopology(invocation, {
    onError: (location, error) => {
      process.stderr.write(
        `[ttsc] watch error on ${watchMessagePath(cwd, location)}: ${formatError(error)}\n`,
      );
    },
    onProjectInputWatchUnavailable: (roots) => {
      for (const root of roots) {
        process.stderr.write(
          `[ttsc] project-input watch unavailable on ${watchMessagePath(cwd, root)}; changes under this root are not being observed\n`,
        );
      }
    },
    onInputChange: (change) => {
      debugWatchInputs(
        `change ${change.kind}${change.invalidate === true ? " invalidate" : ""} ${
          change.path === undefined
            ? "(unnamed)"
            : watchMessagePath(cwd, change.path)
        }`,
      );
      trigger(change);
    },
    onProjectInputWatchRoots: (roots) => {
      debugWatchInputs(
        `roots ${JSON.stringify(roots.map((root) => watchMessagePath(cwd, root)))}`,
      );
    },
    onTopologyChange: () => trigger(undefined, true),
  });
  try {
    topology.refresh(false);
    process.on("SIGINT", onInterrupt);
    process.on("SIGTERM", onTerminate);
    process.stdout.write(`[ttsc] watching ${watchMessagePath(cwd, root)}\n`);
    startRun();
  } catch (error) {
    // Refresh may fail after acquiring only part of the watch set. Release that
    // partial ownership as well as setup's signal listeners before returning.
    close();
    process.stderr.write(`${formatError(error)}\n`);
    return toExitCode(lastStatus === 0 ? 2 : lastStatus);
  }
  return toExitCode(lastStatus);
}

// Coerces a build status into a valid process exit code: 0 stays 0, any
// non-zero (or non-finite) status collapses to 1 so the session signals failure.
function toExitCode(status: number): number {
  return Number.isInteger(status) && status >= 0 && status <= 255 ? status : 1;
}

/**
 * Opt-in report of what the project-input layer is watching and announcing.
 *
 * A watch that goes quiet is indistinguishable from a watch with nothing to
 * say: the build simply never runs again, and the transcript that survives says
 * only that. This separates the two — the roots line states what is covered,
 * and a change line states what was announced — so a missing rebuild can be
 * attributed to the watch that never saw the file or to the decision that
 * declined to report it. Silent unless asked, and on the same ordered stream as
 * the rest of the watch output so it interleaves with the builds it explains.
 */
function debugWatchInputs(message: string): void {
  if (!process.env.TTSC_WATCH_DEBUG_INPUTS) return;
  process.stdout.write(`[ttsc:debug] ${message}\n`);
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
