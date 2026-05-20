import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";

import { resolveTsgo } from "../../compiler/internal/resolveTsgo";
import { resolveTtscserverBinary } from "./resolveTtscserverBinary";

/**
 * Drive the ttscserver native binary from a node launcher. The launcher is
 * deliberately thin: argument parsing, version banners, and help text are owned
 * by the Go binary so future flags only need to change one layer. The JS side
 * performs only:
 *
 * - Resolve the platform binary,
 * - Resolve the project TypeScript-Go binary for the native wrapper,
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
 * Build the environment for the native binary. When running in `--stdio` (LSP)
 * mode the Go binary needs to know which tsgo binary to wrap; inject
 * `TTSC_TSGO_BINARY` so the native host does not have to re-resolve it from
 * inside a potentially different working directory. Skip injection when the
 * caller already provided the variable or passed an explicit `--tsgo` option.
 */
function resolveTtscserverEnv(argv: readonly string[]): NodeJS.ProcessEnv {
  if (!argv.includes("--stdio")) {
    // Non-LSP invocations (--version, --help) do not shell out to tsgo.
    return process.env;
  }
  if (process.env.TTSC_TSGO_BINARY || hasTsgoOption(argv)) {
    return process.env;
  }
  const tsgo = resolveTsgo({
    cwd: process.cwd(),
    resolveFrom: __filename,
  });
  return {
    ...process.env,
    TTSC_TSGO_BINARY: tsgo.binary,
  };
}

function hasTsgoOption(argv: readonly string[]): boolean {
  return argv.some((arg) => arg === "--tsgo" || arg.startsWith("--tsgo="));
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
    const mode = fs.statSync(binary).mode & 0o777;
    if ((mode & 0o111) !== 0) return;
    fs.chmodSync(binary, mode | 0o755);
  } catch {
    /* spawn will surface the underlying error */
  }
}
