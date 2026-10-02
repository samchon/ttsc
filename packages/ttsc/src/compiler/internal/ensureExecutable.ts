import fs from "node:fs";

/**
 * Ensure the binary has the executable bit set on POSIX systems. Silently skips
 * on Windows and swallows `chmod` errors to let the original spawn error
 * surface instead of masking it with a permission error.
 *
 * @evidence contracts/common.md#principled-implementation X_OK checks usable execution first; a POSIX permission repair preserves existing mode bits while supplying the shipped executable's read and execute permissions.
 * @evidence contracts/common.md#clear-and-simple-design This boundary attempts permission preparation only; spawning retains ownership of the definitive error and process outcome.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Permission preparation uses supported filesystem APIs and does not intercept spawning or turn missing binaries into success.
 * @evidence contracts/common.md#meaningful-documentation The native comment explains the Windows branch and why chmod failure remains for the spawn path, following the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation Windows execution does not use POSIX mode bits; other supported hosts use Node X_OK and chmod with the native path, isolating that real OS distinction here.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Both filesystem calls are synchronous and finish before return, so no handle outlives the call.
 * @evidenceExclude contracts/performance.md#efficient-algorithms At most one access check and one chmod on a single file; there is no loop.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work It checks one binary per call and keeps no state that a later call could reuse.
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
