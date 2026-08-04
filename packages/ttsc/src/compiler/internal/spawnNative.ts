import { type SpawnSyncReturns, spawnSync } from "node:child_process";
import fs from "node:fs";

import { captureProcessOutput } from "./captureProcessOutput";

/**
 * Spawn a native binary (or a Node.js script when the path has a JS/TS
 * extension) and return its result with `stdout` and `stderr` as text.
 *
 * The child's streams are written to files rather than piped, and the files are
 * read once it exits. `spawnSync` buffers a _piped_ stream in this process's
 * memory and refuses to hold more than `maxBuffer` bytes, so a piped capture
 * has to name a ceiling — and any ceiling is a number nobody chose for this
 * machine, deciding that a large but legitimate compile said too much. A file
 * has no such limit: the bytes never pass through this heap on their way out of
 * the child, and how many there may be is the filesystem's business.
 *
 * When `options.encoding` is omitted it defaults to `"utf8"`. Pass `"buffer"`
 * when the caller needs raw bytes.
 */
export function spawnNative(
  binary: string,
  args: readonly string[],
  options: {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    encoding?: BufferEncoding | "buffer";
  },
): SpawnSyncReturns<string | Buffer> {
  const viaNode = /\.(?:[cm]?js|ts)$/i.test(binary);
  if (!viaNode) {
    ensureExecutable(binary);
  }
  const capture = captureProcessOutput();
  try {
    const result = spawnSync(
      viaNode ? process.execPath : binary,
      viaNode ? [binary, ...args] : [...args],
      {
        cwd: options.cwd,
        env: options.env,
        stdio: ["ignore", capture.stdoutFd, capture.stderrFd],
        windowsHide: true,
      },
    );
    const stdout = capture.read("stdout", options.encoding);
    const stderr = capture.read("stderr", options.encoding);
    return {
      ...result,
      output: [null, stdout, stderr],
      stderr,
      stdout,
    } as SpawnSyncReturns<string | Buffer>;
  } finally {
    capture.dispose();
  }
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

/** Coerce a `spawnSync` output value to a plain string, defaulting to `""`. */
export function outputText(value: string | Buffer | null | undefined): string {
  if (value == null) {
    return "";
  }
  return typeof value === "string" ? value : value.toString("utf8");
}
