import fs from "node:fs";

/**
 * Observe whether process `pid` on this host is still running.
 *
 * Signal zero answers whether the kernel still holds a process with that id.
 * Only `ESRCH` proves absence; `EPERM` and other failures remain unknown. On
 * Linux a successful probe can still name a zombie: a process that has exited
 * and holds its id only until its parent collects its status. A parent that
 * never collects, such as a container's PID 1 that is not an init or a
 * subreaper that collects only when its own command ends, keeps the zombie
 * indefinitely, so its `/proc` status reports it absent too. A leader whose own
 * thread exited also reads as a zombie while its other threads run, so the
 * zombie must be the process's last thread. Its id cannot be reused while the
 * zombie holds it, so this never names a live process absent. An absent answer
 * carries its evidence: ESRCH, the /proc read's code when collection raced it,
 * or the zombie's state, so a diagnostic reader can check which one held.
 *
 * @evidence contracts/common.md#principled-implementation ESRCH, or a Linux /proc status of zombie or dead with no other thread, proves the process exited; success with any other status is presence, and every other failure stays unknown.
 * @evidence contracts/common.md#clear-and-simple-design One probe gives the ttsx run, dependency-lock and plugin-lock owners the same exit decision.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The native signal-zero probe and the kernel's own process status decide; no PID list, timeout or error-to-absent fallback substitutes for them.
 * @evidence contracts/common.md#meaningful-documentation The paragraph explains why a zombie answers signal zero, which parents leave one behind, why a zombie leader with running threads is not one, and why its id cannot name a live process.
 * @evidence contracts/portability.md#os-neutral-implementation Node's signal-zero probe works on every platform; only Linux exposes zombies through /proc, and elsewhere the probe's answer stands.
 * @evidence contracts/performance.md#efficient-algorithms One syscall, plus one small /proc read on Linux when the process exists.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Process state is a current observation and is never cached as proof for a later decision.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The probe retains no handle; the status text becomes reclaimable on return.
 */
export function probeLocalProcess(pid: number): {
  result: "present" | "absent" | "unknown";
  errorCode?: string;

  /** The Linux /proc state that proved an exited process absent. */
  state?: string;
} {
  try {
    process.kill(pid, 0);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException | null)?.code;
    return { result: code === "ESRCH" ? "absent" : "unknown", errorCode: code };
  }
  if (process.platform !== "linux") return { result: "present" };
  let status: string;
  try {
    status = fs.readFileSync(`/proc/${pid}/status`, "utf8");
  } catch (error) {
    const code = (error as NodeJS.ErrnoException | null)?.code;
    // The process was collected between the probe and the read.
    if (code === "ENOENT" || code === "ESRCH")
      return { result: "absent", errorCode: code };
    return { result: "unknown", errorCode: code };
  }
  // A leader whose own thread exited reads as a zombie while its other threads
  // still run; only a zombie that is the process's last thread has exited.
  const state = /^State:\s*(\S)/m.exec(status)?.[1];
  const threads = /^Threads:\s*(\d+)/m.exec(status)?.[1];
  // The state travels with an absent answer: signal zero succeeded, so it is the
  // only evidence of the exit a diagnostic reader can check.
  return (state === "Z" || state === "X") && threads === "1"
    ? { result: "absent", state }
    : { result: "present" };
}
