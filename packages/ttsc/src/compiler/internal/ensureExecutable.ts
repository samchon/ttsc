import fs from "node:fs";

/**
 * Ensure the binary has the executable bit set on POSIX systems. Silently skips
 * on Windows and swallows `chmod` errors to let the original spawn error
 * surface instead of masking it with a permission error.
 *
 * @evidence contracts/common.md#principled-implementation X_OK checks current access first; a failed check permits a best-effort POSIX repair that preserves the low nine permission bits and adds 0755. Special mode bits are not preserved by that masked repair.
 * @evidence contracts/common.md#clear-and-simple-design This boundary attempts permission preparation only; spawning retains ownership of the definitive error and process outcome.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Permission preparation uses supported filesystem APIs and does not intercept spawning or turn missing binaries into success.
 * @evidence contracts/common.md#meaningful-documentation The native comment explains the Windows branch and why chmod failure remains for the spawn path, following the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation Windows execution does not use POSIX mode bits; other supported hosts use Node X_OK and chmod with the native path, isolating that real OS distinction here.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The synchronous access/stat/chmod APIs do not return retained handles, and this declaration owns no live child or cache after returning.
 * @evidence contracts/performance.md#efficient-algorithms Windows returns before I/O; other hosts attempt one access check and, only on failure, one stat and one chmod. Work includes native path lookup and permission-operation costs; the fixed call count does not bound native duration.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work It does not coordinate compilation or memoize permission results: each call consults current access so an earlier successful check is not reused as authority after permission changes.
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
