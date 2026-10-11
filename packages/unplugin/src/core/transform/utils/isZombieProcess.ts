import fs from "node:fs";

/**
 * Whether process `pid` has exited and only waits for its parent to collect its
 * status.
 *
 * Signal zero still reaches such a zombie, so a liveness probe built on it
 * alone counts the process alive. A parent that never collects, such as a
 * container's PID 1 that is not an init or a subreaper that collects only when
 * its own command ends, keeps the zombie indefinitely, and the locks and
 * directories it owned would never be reclaimed. Only Linux exposes the state,
 * through `/proc`; elsewhere, and whenever it cannot be read, this answers
 * `false` so the caller's existing probe decides. A leader whose own thread
 * exited also reads as a zombie while its other threads run, so the zombie must
 * be the process's last thread. A zombie keeps its id until collected, so this
 * never names a live process.
 *
 * @param pid A positive process id that signal zero just found.
 * @evidence contracts/common.md#principled-implementation The kernel's own process status, zombie or dead with no other thread, establishes the exit; any unreadable or other status leaves the caller's signal-zero answer standing.
 * @evidence contracts/common.md#clear-and-simple-design One predicate serves the shared-compile lock, session-owner and watch-probe owners alike.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No PID list, timeout or error-to-exited fallback substitutes for the kernel status.
 * @evidence contracts/common.md#meaningful-documentation The paragraph explains why signal zero misses a zombie, which parents leave one behind, why a zombie leader with running threads is not one and why its id cannot name a live process.
 * @evidence contracts/portability.md#os-neutral-implementation Only Linux exposes zombies through /proc; other platforms keep their probe's answer.
 * @evidence contracts/performance.md#efficient-algorithms One small /proc read on Linux, nothing elsewhere.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Process state is a current observation and is never cached.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The read retains no handle; the status text becomes reclaimable on return.
 */
export function isZombieProcess(pid: number): boolean {
  if (process.platform !== "linux") return false;
  let status: string;
  try {
    status = fs.readFileSync(`/proc/${pid}/status`, "utf8");
  } catch {
    return false;
  }
  const state = /^State:\s*(\S)/m.exec(status)?.[1];
  const threads = /^Threads:\s*(\d+)/m.exec(status)?.[1];
  return (state === "Z" || state === "X") && threads === "1";
}
