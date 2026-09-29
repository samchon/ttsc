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
 * @evidence contracts/common.md#principled-implementation Reclamation requires both the recorded local hostname and ESRCH from the native pid probe; permission, invalid-pid and unknown failures cannot establish that an owner is gone.
 * @evidence contracts/common.md#clear-and-simple-design One conservative predicate supplies the same owner-liveness decision to lock recovery and directory sweeping.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Native process existence is queried through process.kill(pid, 0); no fixture pid or broad error-to-dead fallback substitutes for ownership evidence.
 * @evidence contracts/common.md#meaningful-documentation The native explanation distinguishes a remote host, a denied or unknown probe and pid recycling, stating why ambiguity protects a live owner's state.
 * @evidence contracts/portability.md#os-neutral-implementation Node exposes the host's process-existence probe and portable error codes; hostname comparison scopes pid identity to this host without assuming POSIX signals can terminate Windows processes.
 */
export function isLocalProcessGone(owner: {
  /** The process id the owner recorded. */
  pid: number;

  /** The `os.hostname()` of the machine the owner ran on. */
  hostname: string;
}): boolean {
  if (owner.hostname.toLowerCase() !== os.hostname().toLowerCase()) {
    return false;
  }
  try {
    process.kill(owner.pid, 0);
    return false;
  } catch (error) {
    return (error as NodeJS.ErrnoException | null)?.code === "ESRCH";
  }
}
