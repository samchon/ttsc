import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

import { TtscCompiler } from "../../TtscCompiler";
import { resolveBinary } from "../../compiler/internal/resolveBinary";
import { runBuild } from "../../compiler/internal/runBuild";
import { runSingleFileEmit } from "../../compiler/internal/runSingleFileEmit";
import { resolveProjectConfig } from "../../compiler/internal/project/resolveProjectConfig";
import type { TtscBuildOptions } from "../../structures/internal/TtscBuildOptions";
import { getCompilerVersionText } from "./getCompilerVersionText";

export function runTtsc(
  argv: readonly string[] = process.argv.slice(2),
): number {
  try {
    if (argv.length === 0) {
      return runCompatibleBuild([], false);
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
        return runCompatibleBuild(rest, false);
      case "check":
        return runCompatibleBuild(rest, true);
      case "clean":
        return runClean(rest);
      case "prepare":
        return runPrepare(rest);
      case "demo":
        return delegateToNative(argv);
      case "-p":
      case "--project":
        return runCompatibleBuild(argv, false);
      default:
        if (isBuildAlias(command)) {
          return runCompatibleBuild(argv, false);
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

function isBuildAlias(command: string): boolean {
  if (command.startsWith("-")) return true;
  return [".json", ".ts", ".tsx", ".mts", ".cts"].some((ext) =>
    command.endsWith(ext),
  );
}

function runCompatibleBuild(
  argv: readonly string[],
  checkOnly: boolean,
): number {
  const options = parseBuildArgs(argv, checkOnly);
  if (options.watch) {
    return runWatch(options, checkOnly);
  }
  if (options.files.length !== 0) {
    return runSingleFile(options);
  }
  const result = runBuild(checkOnly ? { ...options, emit: false } : options);
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  return result.status;
}

function runPrepare(argv: readonly string[]): number {
  const options = parseProjectArgs(argv);
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const compiler = new TtscCompiler({
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
  const targets = [
    path.join(projectRoot, "node_modules", ".ttsc"),
    path.join(projectRoot, ".ttsc"),
    ...(process.env.TTSC_CACHE_DIR
      ? [path.resolve(process.env.TTSC_CACHE_DIR, "plugins")]
      : []),
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
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    return target;
  }
  return relative;
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
    const mode = fs.statSync(binary).mode & 0o777;
    if ((mode & 0o111) !== 0) {
      return;
    }
    fs.chmodSync(binary, mode | 0o755);
  } catch {
    /* keep the original spawn error path */
  }
}

function parseProjectArgs(argv: readonly string[]) {
  let cwd: string | undefined;
  let tsconfig: string | undefined;

  const rest = [...argv];
  while (rest.length !== 0) {
    const current = rest.shift()!;
    switch (current) {
      case "--cwd":
        cwd = takeValue(current, rest);
        break;
      case "-p":
      case "--tsconfig":
      case "--project":
        tsconfig = takeValue(current, rest);
        break;
      default:
        if (current.startsWith("--cwd=")) {
          cwd = current.slice("--cwd=".length);
        } else if (current.startsWith("--tsconfig=")) {
          tsconfig = current.slice("--tsconfig=".length);
        } else if (current.startsWith("--project=")) {
          tsconfig = current.slice("--project=".length);
        } else {
          throw new Error(`ttsc: unknown option ${current}`);
        }
        break;
    }
  }
  return { cwd, tsconfig };
}

function parseBuildArgs(argv: readonly string[], checkOnly: boolean) {
  let binary: string | undefined;
  let cwd: string | undefined;
  let emit: boolean | undefined = checkOnly ? false : undefined;
  const files: string[] = [];
  let outDir: string | undefined;
  let preserveWatchOutput = false;
  let quiet = true;
  let tsconfig: string | undefined;
  let watch = false;

  const rest = [...argv];
  while (rest.length !== 0) {
    const current = rest.shift()!;
    switch (current) {
      case "--emit":
        emit = true;
        break;
      case "--noEmit":
        emit = false;
        break;
      case "--quiet":
        quiet = true;
        break;
      case "--verbose":
        quiet = false;
        break;
      case "-w":
      case "--watch":
        watch = true;
        break;
      case "--preserveWatchOutput":
        preserveWatchOutput = true;
        break;
      case "--cwd":
        cwd = takeValue(current, rest);
        break;
      case "--outDir":
        outDir = takeValue(current, rest);
        break;
      case "-p":
      case "--tsconfig":
      case "--project":
        tsconfig = takeValue(current, rest);
        break;
      case "--binary":
        binary = takeValue(current, rest);
        break;
      default:
        if (current.startsWith("--cwd=")) {
          cwd = current.slice("--cwd=".length);
        } else if (current.startsWith("--outDir=")) {
          outDir = current.slice("--outDir=".length);
        } else if (current === "-w") {
          watch = true;
        } else if (current.startsWith("--tsconfig=")) {
          tsconfig = current.slice("--tsconfig=".length);
        } else if (current.startsWith("--project=")) {
          tsconfig = current.slice("--project=".length);
        } else if (current.startsWith("--preserveWatchOutput=")) {
          preserveWatchOutput =
            current.slice("--preserveWatchOutput=".length) !== "false";
        } else if (current.startsWith("--binary=")) {
          binary = current.slice("--binary=".length);
        } else if (current === "--verbose") {
          quiet = false;
        } else if (current.startsWith("-")) {
          throw new Error(`ttsc: unknown option ${current}`);
        } else {
          files.push(current);
        }
        break;
    }
  }
  return {
    binary,
    cwd,
    emit,
    files,
    outDir,
    preserveWatchOutput,
    quiet,
    tsconfig,
    watch,
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
      "",
      "Plugin contract:",
      "  ttsc reads compilerOptions.plugins from tsconfig.json.",
      "  Plugin modules are descriptors for ordered native transformer backends.",
      "  JS transformOutput/transformSource hooks are not part of the public contract.",
      "",
      "Compatibility aliases:",
      "  ttsc build [options]       Same project build lane as `ttsc [options]`.",
      "  ttsc check [options]       Same as `ttsc --noEmit [options]`.",
      "  ttsc prepare [options]     Build configured source-plugin binaries into cache.",
      "  ttsc clean [options]       Delete local source-plugin cache directories.",
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
  const out = resolveSingleFileOut(file, cwd, options.outDir);
  const text = runSingleFileEmit({
    binary: options.binary,
    cwd,
    file,
    out,
    tsconfig: options.tsconfig,
  });
  if (!fs.existsSync(out)) {
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, text, "utf8");
  }
  process.stdout.write(`${path.relative(cwd, out) || path.basename(out)}\n`);
  return 0;
}

function resolveSingleFileOut(
  file: string,
  cwd: string,
  outDir?: string,
): string {
  const relative = path.relative(cwd, file);
  const jsRelative = relative.replace(/\.[cm]?tsx?$/i, ".js");
  if (outDir) {
    return path.resolve(cwd, outDir, jsRelative);
  }
  return file.replace(/\.[cm]?tsx?$/i, ".js");
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
  const watchRoot = root;
  const directories = collectWatchDirectories(watchRoot);
  const watchers = directories.map((dir) =>
    fs.watch(dir, { persistent: true }, () => trigger()),
  );
  let running = false;
  let rerun = false;
  let timer: NodeJS.Timeout | null = null;

  const runOnce = () => {
    running = true;
    if (!options.preserveWatchOutput) {
      process.stdout.write("\x1bc");
    }
    process.stdout.write(
      `[ttsc] rebuilding at ${new Date().toLocaleTimeString()}\n`,
    );
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
    process.stdout.write(
      `[ttsc] ${status === 0 ? "watch build complete" : "watch build failed"}\n`,
    );
    running = false;
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

  const close = () => {
    if (timer) clearTimeout(timer);
    for (const watcher of watchers) watcher.close();
  };
  process.on("SIGINT", () => {
    close();
    process.exit(0);
  });
  process.on("SIGTERM", () => {
    close();
    process.exit(0);
  });

  process.stdout.write(`[ttsc] watching ${path.relative(cwd, root) || "."}\n`);
  runOnce();
  return 0;
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

function takeValue(flag: string, rest: string[]): string {
  const value = rest.shift();
  if (!value) {
    throw new Error(`ttsc: ${flag} requires a value`);
  }
  return value;
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
