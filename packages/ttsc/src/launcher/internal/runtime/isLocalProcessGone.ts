import os from "node:os";

/**
 * Whether the process an owner record names has certainly exited: it ran on
 * this host, and no process with its pid is alive.
 *
 * A record from another host proves nothing, because its pid names a process
 * this machine cannot see, so it is never reported gone. An `EPERM` from the
 * probe does not establish absence, so it counts as alive. Only `ESRCH` proves
 * absence; other probe failures remain unknown. A recycled pid makes the answer
 * err toward "alive": a caller that reclaims on "gone" never takes a live
 * owner's state.
 *
 * Callers supply a validated positive process id, not a process-group selector.
 * Hostname comparison is a host-label convention, not machine authentication:
 * shared-cache participants need distinct labels under this comparison. ESRCH
 * is an observation at probe time, not a lease preventing later state changes.
 * An optional diagnostic receives this same observation without another probe;
 * a diagnostic failure cannot change the ownership decision.
 *
 * @evidence contracts/common.md#principled-implementation Reclamation requires both the recorded local hostname and ESRCH from the native pid probe; permission, invalid-pid and unknown failures cannot establish that an owner is gone.
 * @evidence contracts/common.md#clear-and-simple-design One conservative predicate supplies the same owner-liveness decision to lock recovery and directory sweeping.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Native process existence is queried through process.kill(pid, 0); no fixture pid or broad error-to-dead fallback substitutes for ownership evidence.
 * @evidence contracts/common.md#meaningful-documentation The native explanation distinguishes a remote host, a denied or unknown probe and pid recycling, stating why ambiguity protects a live owner's state.
 * @evidence contracts/portability.md#os-neutral-implementation Node exposes the host's process-existence probe and portable error codes; hostname comparison scopes pid identity to this host without assuming POSIX signals can terminate Windows processes.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources This observation retains no handle, historical state or cache; temporary lowercase hostname strings become reclaimable after return.
 * @evidence contracts/performance.md#efficient-algorithms Native hostname lookup and two lowercase string constructions/comparison process host-label text before at most one native pid probe; the fixed probe count is not a fixed text or operating-system cost.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Host labels and native process existence are current observations; this predicate coordinates no cross-call cache or reusable liveness proof.
 */
export function isLocalProcessGone(
  owner: {
    /** The process id the owner recorded. */
    pid: number;

    /** The `os.hostname()` of the machine the owner ran on. */
    hostname: string;
  },
  observe?: (
    result: "remote" | "present" | "absent" | "unknown",
    errorCode?: string,
  ) => void,
): boolean {
  const report = (
    result: "remote" | "present" | "absent" | "unknown",
    errorCode?: string,
  ): void => {
    try {
      observe?.(result, errorCode);
    } catch {
      // Diagnostics own no policy.
    }
  };
  if (owner.hostname.toLowerCase() !== os.hostname().toLowerCase()) {
    report("remote");
    return false;
  }
  try {
    process.kill(owner.pid, 0);
    report("present");
    return false;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException | null)?.code;
    const absent = code === "ESRCH";
    report(absent ? "absent" : "unknown", code);
    return absent;
  }
}
