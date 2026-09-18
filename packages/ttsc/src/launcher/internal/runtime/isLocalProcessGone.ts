import os from "node:os";

/**
 * Whether the process an owner record names has certainly exited: it ran on
 * this host, and no process with its pid is alive.
 *
 * A record from another host proves nothing, because its pid names a process
 * this machine cannot see, so it is never reported gone. An `EPERM` from the
 * probe means a process with that pid exists and belongs to someone else, so it
 * counts as alive. What this cannot rule out is a recycled pid, which makes the
 * answer err toward "alive": a caller that reclaims on "gone" never takes a
 * live owner's state.
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
    return (error as NodeJS.ErrnoException).code !== "EPERM";
  }
}
