import fs from "node:fs";

/**
 * Whether a process with `pid` is still running.
 *
 * Signal zero still reaches a zombie, which has ended and only awaits its
 * parent's collection. On Linux the E2E suite's native carrier is a child
 * subreaper that collects its orphans only once its entry finishes, so a
 * descendant orphaned and ended mid-suite stays a zombie there; its `/proc`
 * status tells the two apart. A leader whose own thread exited also reads as a
 * zombie while its other threads run, so only a zombie that is the process's
 * last thread has ended. `EPERM` means a process exists that this one may not
 * signal.
 *
 * @param pid A positive process id.
 * @evidence contracts/common.md#principled-implementation ESRCH, or a Linux /proc status of zombie or dead with no other thread, establishes the end; signal success with any other status, or EPERM, is running.
 * @evidence contracts/common.md#clear-and-simple-design One predicate serves every test that waits for a descendant to end.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The kernel's own answers decide; no timeout or error-to-ended fallback substitutes for them, and an unexpected /proc failure is thrown.
 * @evidence contracts/common.md#meaningful-documentation The paragraph explains why signal zero alone misreads a zombie and where the suite leaves one.
 * @evidence contracts/portability.md#os-neutral-implementation Node's signal-zero probe works on every platform; only Linux exposes zombies through /proc.
 * @evidence contracts/performance.md#efficient-algorithms One syscall, plus one small /proc read on Linux when the process exists.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Process state is a current observation and is never cached.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The read retains no handle; the status text becomes reclaimable on return.
 */
export function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
  if (process.platform !== "linux") return true;
  let status: string;
  try {
    status = fs.readFileSync(`/proc/${pid}/status`, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
  const state = /^State:\s*(\S)/m.exec(status)?.[1];
  const threads = /^Threads:\s*(\d+)/m.exec(status)?.[1];
  return !((state === "Z" || state === "X") && threads === "1");
}
