import fs from "node:fs";

/**
 * Ensure a resolved native binary can be executed on POSIX installs.
 *
 * Some package managers or non-POSIX pack hosts can materialize platform
 * package binaries without executable bits. The ttsc launcher already repairs
 * its native helper before spawning; @ttsc/graph has its own ttscgraph spawn
 * paths, so it must apply the same first-run repair here.
 */
export function ensureExecutable(binary: string): void {
  if (process.platform === "win32") return;
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
