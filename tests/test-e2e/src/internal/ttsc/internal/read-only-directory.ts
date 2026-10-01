import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";

/**
 * Refuse new entries in `directory` until the returned function runs: the mode
 * bits on POSIX, a deny entry for everyone on Windows, where a directory's
 * read-only attribute does not stop file creation.
 *
 * Root ignores both, so callers skip when {@link runsAsRoot} holds.
 */
export function denyWrites(directory: string): () => void {
  if (process.platform === "win32") {
    const deny = spawnSync("icacls", [directory, "/deny", "*S-1-1-0:(WD,AD)"], {
      encoding: "utf8",
    });
    assert.equal(deny.status, 0, deny.stderr || deny.stdout);
    return () => {
      spawnSync("icacls", [directory, "/remove:d", "*S-1-1-0"], {
        encoding: "utf8",
      });
    };
  }
  const mode = fs.statSync(directory).mode;
  fs.chmodSync(directory, 0o555);
  return () => fs.chmodSync(directory, mode);
}

/** Whether this process runs as root, which directory permissions do not bind. */
export function runsAsRoot(): boolean {
  return process.getuid?.() === 0;
}
