import fs from "node:fs";

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
