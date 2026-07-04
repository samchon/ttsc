import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { TtscCompiler } from "../../TtscCompiler";
import { readProjectConfig } from "../../compiler/internal/project/readProjectConfig";
import { resolveProjectConfig } from "../../compiler/internal/project/resolveProjectConfig";
import { resolveBinary } from "../../compiler/internal/resolveBinary";
import { runBuild } from "../../compiler/internal/runBuild";
import { runSingleFileEmit } from "../../compiler/internal/runSingleFileEmit";
import {
  getBoolean,
  getNumber,
  getString,
  parseFlags,
} from "../../flags/parser";
import { defaultPluginCacheCleanTargets } from "../../plugin/internal/buildSourcePlugin";
import type { TtscBuildOptions } from "../../structures/internal/TtscBuildOptions";
import { getCompilerVersionText } from "./getCompilerVersionText";
import { resolveCacheDir } from "./resolveCacheDir";

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
    switch (command) {
      case "-h":
      case "--help":
      case "help":
        printHelp();
        return 0;
      case "-v":
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
      case "clean":
        return runClean(rest);
      case "prepare":
        return runPrepare(rest);
      case "demo":
        return delegateToNative(argv);
      case "-p":
      case "--project":
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
  const options = normalizeBuildOptions(parseBuildArgs(argv, checkOnly));
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
  if (options.files.length !== 0) {
    if (mode === "fix") {
      throw new Error("ttsc: fix requires a project, not single-file mode");
    }
    if (mode === "format") {
      throw new Error("ttsc: format requires a project, not single-file mode");
    }
    return runSingleFile(options);
  }
  const result = runBuild(checkOnly ? { ...options, emit: false } : options);
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
  const legacyTargets = [
    path.join(projectRoot, "node_modules", ".ttsc"),
    path.join(projectRoot, ".ttsc"),
  ];
  const targets = [
    ...(options.cacheDir ? [path.resolve(cwd, options.cacheDir)] : []),
    ...(process.env.TTSC_CACHE_DIR
      ? [path.resolve(process.env.TTSC_CACHE_DIR, "plugins"), ...legacyTargets]
      : options.cacheDir
        ? legacyTargets
        : defaultPluginCacheCleanTargets(projectRoot)),
  ];
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

function delegateToNative(argv: readonly string[]): number {
  const bin = resolveBinary();
  if (!bin) {
    process.stderr.write(
      [
        `ttsc: platform-specific helper binary not found (@ttsc/${process.platform}-${process.arch}).`,
        `Set TTSC_BINARY to an absolute helper path or reinstall with optional dependencies enabled.`,
      ].join("\n") + "\n",
    );
    return 1;
  }
  const viaNode = /\.(?:[cm]?js|ts)$/i.test(bin);
  if (!viaNode) {
    ensureExecutable(bin);
  }
  const result = spawnSync(
    viaNode ? process.execPath : bin,
    viaNode ? [bin, ...argv] : [...argv],
    {
      stdio: "inherit",
      env: process.env,
      windowsHide: true,
    },
  );
  if (result.error) {
    process.stderr.write(`${result.error.message}\n`);
    return 1;
  }
  return result.status ?? 1;
}

function ensureExecutable(binary: string): void {
  if (process.platform === "win32") {
    return;
  }
  try {
    fs.accessSync(binary, fs.constants.X_OK);
    return;
  } catch {
    try {
      const mode = fs.statSync(binary).mode & 0o777;
      fs.chmodSync(binary, mode | 0o755);
    } catch {
      /* keep the original spawn error path */
    }
  }
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

function parseBuildArgs(argv: readonly string[], checkOnly: boolean) {
  const result = parseFlags({
    argv,
    errorPrefix: "ttsc:",
    subcommand: "build",
  });
  // Defaults: pinned by the previous hand-parser. `quiet` defaults true,
  // `--verbose` flips it to false; `emit` defaults `undefined` in build
  // mode (let tsconfig decide) and `false` in check/fix/format mode.
  const verbose = getBoolean(result, "--verbose");
  const quietFlag = getBoolean(result, "--quiet");
  const quiet = verbose === true ? false : (quietFlag ?? true);
  const explicitEmit = getBoolean(result, "--emit");
  const explicitNoEmit = getBoolean(result, "--noEmit");
  let emit: boolean | undefined;
  if (explicitEmit === true) emit = true;
  else if (explicitNoEmit === true) emit = false;
  if (emit === undefined && checkOnly) emit = false;

  const files = result.positional.filter(looksLikeInputFile);
  // Bare non-file positionals are flag values (e.g. the `es2020` in
  // `--target es2020`). The engine left them in `positional` because the
  // forwarded flag is unknown to the schema; route them back into
  // passthrough so the user's pair reaches tsgo intact.
  const trailingValues = result.positional.filter(
    (token) => !looksLikeInputFile(token),
  );
  const passthrough = [...result.passthrough, ...trailingValues];

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
      "  ttsc prepare [options]     Build configured source-plugin binaries into cache.",
      "  ttsc clean [options]       Delete source-plugin cache directories.",
    ].join("\n"),
  );
  process.stdout.write("\n");
}

function runSingleFile(options: ReturnType<typeof parseBuildArgs>): number {
  if (options.files.length !== 1) {
    throw new Error(
      "ttsc: single-file mode currently accepts exactly one input file",
    );
  }
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const file = path.resolve(cwd, options.files[0]!);
  const out = resolveSingleFileOut({
    cliOutDir: options.outDir,
    cwd,
    file,
    tsconfig: options.tsconfig,
  });
  const text = runSingleFileEmit({
    binary: options.binary,
    checkers: options.checkers,
    cwd,
    file,
    out,
    passthrough: options.passthrough,
    singleThreaded: options.singleThreaded,
    tsconfig: options.tsconfig,
  });
  if (!fs.existsSync(out)) {
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, text, "utf8");
  }
  process.stdout.write(`${path.relative(cwd, out) || path.basename(out)}\n`);
  return 0;
}

function resolveSingleFileOut(opts: {
  cliOutDir?: string;
  cwd: string;
  file: string;
  tsconfig?: string;
}): string {
  const jsBasename =
    path.basename(opts.file).replace(/\.[cm]?tsx?$/i, "") +
    singleFileJsExtension(opts.file);

  // Explicit CLI --outDir wins. Mirrors the CWD-relative source layout under
  // the requested directory so existing single-file invocations don't shift.
  if (opts.cliOutDir) {
    const relative = path.relative(opts.cwd, opts.file);
    const jsRelative =
      relative.slice(0, relative.length - path.extname(relative).length) +
      singleFileJsExtension(opts.file);
    return path.resolve(opts.cwd, opts.cliOutDir, jsRelative);
  }

  // No CLI override: honor tsconfig's outDir so `ttsc src/foo.ts` lands the
  // emitted JS at `<outDir>/<relative-from-rootDir>.js` instead of dropping
  // it next to the source file. This matches how project mode emits and how
  // `tsc <file>` would behave with the same tsconfig.
  const projectOutDir = readProjectOutDir({
    cwd: opts.cwd,
    file: opts.file,
    tsconfig: opts.tsconfig,
  });
  if (projectOutDir !== null) {
    const fromRoot = path.relative(projectOutDir.rootDir, opts.file);
    if (fromRoot !== "" && !isOutsideSingleFileLayout(fromRoot)) {
      const jsRelative =
        fromRoot.slice(0, fromRoot.length - path.extname(fromRoot).length) +
        singleFileJsExtension(opts.file);
      return path.resolve(projectOutDir.outDir, jsRelative);
    }
    return path.resolve(projectOutDir.outDir, jsBasename);
  }

  // Last resort (no tsconfig outDir at all): emit next to the source. This
  // preserves the legacy `ttsc <file.ts>` → `<file.js>` behavior for projects
  // that intentionally don't configure outDir.
  return opts.file.replace(/\.[cm]?tsx?$/i, singleFileJsExtension(opts.file));
}

function readProjectOutDir(opts: {
  cwd: string;
  file: string;
  tsconfig?: string;
}): { outDir: string; rootDir: string } | null {
  try {
    const project = readProjectConfig({
      cwd: opts.cwd,
      file: opts.file,
      tsconfig: opts.tsconfig,
    });
    const outDir = project.compilerOptions.outDir;
    if (typeof outDir !== "string" || outDir.length === 0) {
      return null;
    }
    const rawRoot = project.compilerOptions.rootDir;
    const rootDir =
      typeof rawRoot === "string" && rawRoot.length !== 0
        ? path.isAbsolute(rawRoot)
          ? rawRoot
          : path.resolve(project.root, rawRoot)
        : project.root;
    return { outDir, rootDir };
  } catch {
    // Missing or unreadable tsconfig: fall back to the legacy behavior so
    // `ttsc <file>` still works outside a configured project.
    return null;
  }
}

function isOutsideSingleFileLayout(relative: string): boolean {
  return (
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  );
}

function singleFileJsExtension(file: string): string {
  switch (path.extname(file).toLowerCase()) {
    case ".mts":
      return ".mjs";
    case ".cts":
      return ".cjs";
    default:
      return ".js";
  }
}

function runWatch(
  options: ReturnType<typeof parseBuildArgs>,
  checkOnly: boolean,
): number {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const invocation = {
    ...options,
    cwd,
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
  // Tracks the most recent build's exit code so the watch session can exit
  // non-zero when its latest rebuild failed, instead of always reporting 0.
  let lastStatus = 0;

  const runOnce = () => {
    running = true;
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
      const status =
        invocation.files.length !== 0
          ? runSingleFile(invocation)
          : (() => {
              const result = runBuild(
                checkOnly ? { ...invocation, emit: false } : invocation,
              );
              if (result.stdout) process.stdout.write(result.stdout);
              if (result.stderr) process.stderr.write(result.stderr);
              return result.status;
            })();
      lastStatus = status;
      process.stdout.write(
        `[ttsc] ${status === 0 ? "watch build complete" : "watch build failed"}\n`,
      );
    } catch (error) {
      process.stderr.write(`${formatError(error)}\n`);
      lastStatus = lastStatus === 0 ? 2 : lastStatus;
      process.stdout.write(`[ttsc] watch build failed\n`);
    } finally {
      running = false;
    }
    if (rerun) {
      rerun = false;
      trigger();
    }
  };
  const trigger = () => {
    if (running) {
      rerun = true;
      return;
    }
    if (timer) clearTimeout(timer);
    timer = setTimeout(runOnce, 60);
  };

  const directories = collectWatchDirectories(root);
  const watchers = directories.map((dir) => {
    const watcher = fs.watch(dir, { persistent: true }, () => trigger());
    // Without an error handler Node rethrows watcher errors as uncaught
    // exceptions, which would crash the session. inotify limits (ENOSPC) and
    // transient FS errors should be logged while the session stays alive.
    watcher.on("error", (err) => {
      process.stderr.write(
        `[ttsc] watch error on ${path.relative(cwd, dir) || "."}: ${formatError(err)}\n`,
      );
    });
    return watcher;
  });

  const close = () => {
    if (timer) clearTimeout(timer);
    for (const watcher of watchers) watcher.close();
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
    runOnce();
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

// Coerces a build status into a valid process exit code: 0 stays 0, any
// non-zero (or non-finite) status collapses to 1 so the session signals failure.
function toExitCode(status: number): number {
  return Number.isInteger(status) && status >= 0 && status <= 255 ? status : 1;
}

function collectWatchDirectories(root: string): string[] {
  const out: string[] = [];
  const stack: string[] = [root];
  while (stack.length !== 0) {
    const current = stack.pop()!;
    out.push(current);
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (
        entry.name === "node_modules" ||
        entry.name === ".git" ||
        entry.name === "lib" ||
        entry.name === "dist"
      ) {
        continue;
      }
      if (entry.isDirectory()) {
        stack.push(path.join(current, entry.name));
      }
    }
  }
  return out;
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
