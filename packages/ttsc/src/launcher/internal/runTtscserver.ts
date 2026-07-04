import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { readProjectConfig } from "../../compiler/internal/project/readProjectConfig";
import { resolveBinary } from "../../compiler/internal/resolveBinary";
import { resolveTsgo } from "../../compiler/internal/resolveTsgo";
import {
  hasProjectPluginEntries,
  loadProjectPlugins,
} from "../../plugin/internal/loadProjectPlugins";
import type { ITtscLoadedNativePlugin } from "../../structures/internal/ITtscLoadedNativePlugin";
import { resolveTtscserverBinary } from "./resolveTtscserverBinary";

/**
 * Drive the ttscserver native binary from a node launcher. The launcher is
 * deliberately thin: argument parsing, version banners, and help text are owned
 * by the Go binary so future flags only need to change one layer. The JS side
 * performs the Node-owned setup that depends on package resolution:
 *
 * - Resolve the platform binary,
 * - Resolve the project TypeScript-Go binary for the native wrapper,
 * - Resolve the project config and build the LSP plugin manifest environment,
 * - Inject the Node/ttsx helper paths used by disk-backed LSP sidecars,
 * - Inject `--stdio` when the first arg is not a meta-command,
 * - Delegate to the binary with inherited stdio so OS-level signals reach the
 *   child via the parent's process group.
 */
export function runTtscserver(
  argv: readonly string[] = process.argv.slice(2),
): number {
  const binary = resolveTtscserverBinary();
  if (!binary) {
    process.stderr.write(
      [
        `ttscserver: platform-specific binary not found (@ttsc/${process.platform}-${process.arch}).`,
        `Set TTSCSERVER_BINARY to an absolute path or reinstall ttsc with optional dependencies enabled.`,
      ].join("\n") + "\n",
    );
    return 1;
  }
  ensureExecutable(binary);

  const args = needsStdio(argv) ? ["--stdio", ...argv] : [...argv];
  let env: NodeJS.ProcessEnv;
  try {
    env = resolveTtscserverEnv(args);
  } catch (error) {
    process.stderr.write(
      `ttscserver: ${stripTtscPrefix(formatError(error))}\n`,
    );
    return 1;
  }
  const result = spawnSync(binary, args, {
    stdio: "inherit",
    env,
    windowsHide: true,
  });
  if (result.error) {
    process.stderr.write(`ttscserver: ${result.error.message}\n`);
    return 1;
  }
  if (result.signal) {
    // POSIX convention: 128 + signum so wrappers (bash, npm-script, CI)
    // can decode the signal that killed the child (130 = SIGINT, 143 =
    // SIGTERM, etc.). On Windows, `spawnSync` does not surface a signal
    // (TerminateProcess carries no signum) so this branch is POSIX-only
    // by design; Windows-killed children take the `result.status ?? 1`
    // path below.
    const signum = (os.constants.signals as Record<string, number | undefined>)[
      result.signal
    ];
    return typeof signum === "number" ? 128 + signum : 1;
  }
  return result.status ?? 1;
}

/**
 * Build the environment for the native binary. In `--stdio` (LSP) mode the Go
 * binary needs the project tsgo binary plus any LSP-capable plugin sidecars the
 * JS loader resolved from config. Inject those paths through environment
 * variables so the native host can stay focused on proxying tsgo and
 * dispatching sidecar verbs. Skip `TTSC_TSGO_BINARY` injection when the caller
 * already provided the variable or passed an explicit `--tsgo` option.
 */
function resolveTtscserverEnv(argv: readonly string[]): NodeJS.ProcessEnv {
  if (!argv.includes("--stdio")) {
    // Non-LSP invocations (--version, --help) do not shell out to tsgo.
    return process.env;
  }
  const context = resolveLspExecutionContext(argv);
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    TTSC_NODE_BINARY: process.env.TTSC_NODE_BINARY ?? process.execPath,
    TTSC_TTSX_BINARY:
      process.env.TTSC_TTSX_BINARY ??
      path.join(__dirname, "..", "..", "launcher", "ttsx.js"),
  };
  delete env.TTSC_LSP_PLUGINS_JSON;
  if (!process.env.TTSC_TSGO_BINARY && !hasTsgoOption(argv)) {
    env.TTSC_TSGO_BINARY = context.tsgoBinary;
  }
  const lspPlugins = context.nativePlugins.filter(
    (plugin) => plugin.capabilities?.lsp === true,
  );
  if (lspPlugins.length > 0) {
    env.TTSC_LSP_PLUGINS_JSON = JSON.stringify({
      plugins: serializeNativePlugins(context.nativePlugins),
      lspPlugins: lspPlugins.map((plugin) => ({
        binary: plugin.binary,
        name: plugin.name,
        stage: plugin.stage,
      })),
    });
  }
  return env;
}

function resolveLspExecutionContext(argv: readonly string[]): {
  nativePlugins: readonly ITtscLoadedNativePlugin[];
  tsgoBinary: string;
} {
  const cwd = path.resolve(optionValue(argv, "--cwd") ?? process.cwd());
  const tsconfig = optionValue(argv, "--tsconfig");
  let project: ReturnType<typeof readProjectConfig>;
  try {
    project = readProjectConfig({ cwd, tsconfig });
  } catch (error) {
    if (tsconfig) {
      throw error;
    }
    const tsgo = resolveTsgo({
      binary: optionValue(argv, "--tsgo"),
      cwd,
      resolveFrom: __filename,
    });
    return {
      nativePlugins: [],
      tsgoBinary: tsgo.binary,
    };
  }
  const tsgo = resolveTsgo({
    binary: optionValue(argv, "--tsgo"),
    cwd: project.root,
    resolveFrom: __filename,
  });
  const loaded = hasProjectPluginEntries(project)
    ? loadProjectPlugins({
        binary: resolveBinary() ?? "",
        cwd,
        projectRoot: project.root,
        tsconfig: project.path,
      })
    : { nativePlugins: [] };
  return {
    nativePlugins: loaded.nativePlugins,
    tsgoBinary: tsgo.binary,
  };
}

function hasTsgoOption(argv: readonly string[]): boolean {
  return argv.some((arg) => arg === "--tsgo" || arg.startsWith("--tsgo="));
}

function optionValue(
  argv: readonly string[],
  name: string,
): string | undefined {
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === name) {
      return argv[i + 1];
    }
    if (arg.startsWith(name + "=")) {
      return arg.slice(name.length + 1);
    }
  }
  return undefined;
}

function serializeNativePlugins(
  plugins: readonly ITtscLoadedNativePlugin[],
): unknown[] {
  return plugins.map((plugin) => ({
    config: plugin.config,
    name: plugin.name,
    stage: plugin.stage,
  }));
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function stripTtscPrefix(message: string): string {
  return message.startsWith("ttsc: ")
    ? message.slice("ttsc: ".length)
    : message;
}

/**
 * `--stdio` is the only transport the native host accepts today. The launcher
 * injects it only when the first argv token looks like a forwarded option;
 * meta-commands (`-v`, `--help`, `version`, etc.) pass through untouched so the
 * Go binary owns the canonical banner. This mirrors
 * `cmd/ttscserver/main.go::run`, which dispatches on `args[0]` only.
 */
export function needsStdio(argv: readonly string[]): boolean {
  if (argv.length === 0) return false;
  if (argv.includes("--stdio")) return false;
  const head = argv[0];
  if (
    head === "-v" ||
    head === "--version" ||
    head === "version" ||
    head === "-h" ||
    head === "--help" ||
    head === "help"
  ) {
    return false;
  }
  return true;
}

/** Mirror the ttsc helper-binary chmod hint so first-run from npm works. */
function ensureExecutable(binary: string): void {
  if (process.platform === "win32") return;
  try {
    fs.accessSync(binary, fs.constants.X_OK);
    return;
  } catch {
    try {
      const mode = fs.statSync(binary).mode & 0o777;
      fs.chmodSync(binary, mode | 0o755);
    } catch {
      /* spawn will surface the underlying error */
    }
  }
}
