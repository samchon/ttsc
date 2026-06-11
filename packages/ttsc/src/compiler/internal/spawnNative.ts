import { spawnSync } from "node:child_process";
import fs from "node:fs";

/**
 * Spawn a native binary (or a Node.js script when the path has a JS/TS
 * extension) with the given args and return the `spawnSync` result. Sets a
 * generous 256 MiB output buffer so large projects do not truncate.
 *
 * When `options.encoding` is omitted it defaults to `"utf8"`. Pass an explicit
 * value when the caller needs a different encoding or raw `Buffer` output.
 */
export function spawnNative(
  binary: string,
  args: readonly string[],
  options: {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    encoding?: BufferEncoding;
  },
) {
  const viaNode = /\.(?:[cm]?js|ts)$/i.test(binary);
  if (!viaNode) {
    ensureExecutable(binary);
  }
  return spawnSync(
    viaNode ? process.execPath : binary,
    viaNode ? [binary, ...args] : [...args],
    {
      cwd: options.cwd,
      encoding: options.encoding ?? "utf8",
      env: options.env,
      maxBuffer: 1024 * 1024 * 256,
      windowsHide: true,
    },
  );
}

/**
 * Ensure the binary has the executable bit set on POSIX systems. Silently skips
 * on Windows and swallows `chmod` errors to let the original spawn error
 * surface instead of masking it with a permission error.
 */
export function ensureExecutable(binary: string): void {
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

/** Coerce a `spawnSync` output value to a plain string, defaulting to `""`. */
export function outputText(value: string | Buffer | null | undefined): string {
  if (value == null) {
    return "";
  }
  return typeof value === "string" ? value : value.toString("utf8");
}
