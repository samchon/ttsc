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
 * indefinitely, so its `/proc` state reports it absent too. Its id cannot be
 * reused while the zombie holds it, so this never names a live process absent.
 *
 * @evidence contracts/common.md#principled-implementation ESRCH, or a Linux /proc state of zombie or dead, proves the process exited; success with any other state is presence, and every other failure stays unknown.
 * @evidence contracts/common.md#clear-and-simple-design One probe gives the ttsx run, dependency-lock and plugin-lock owners the same exit decision.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The native signal-zero probe and the kernel's own process state decide; no PID list, timeout or error-to-absent fallback substitutes for them.
 * @evidence contracts/common.md#meaningful-documentation The paragraph explains why a zombie answers signal zero, which parents leave one behind, and why its id cannot name a live process.
 * @evidence contracts/portability.md#os-neutral-implementation Node's signal-zero probe works on every platform; only Linux exposes zombies through /proc, and elsewhere the probe's answer stands.
 * @evidence contracts/performance.md#efficient-algorithms One syscall, plus one small /proc read on Linux when the process exists.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Process state is a current observation and is never cached as proof for a later decision.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The probe retains no handle; the stat text becomes reclaimable on return.
 */
export function probeLocalProcess(pid: number): {
  result: "present" | "absent" | "unknown";
  errorCode?: string;
} {
  try {
    process.kill(pid, 0);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException | null)?.code;
    return { result: code === "ESRCH" ? "absent" : "unknown", errorCode: code };
  }
  if (process.platform !== "linux") return { result: "present" };
  let stat: string;
  try {
    stat = fs.readFileSync(`/proc/${pid}/stat`, "utf8");
  } catch (error) {
    const code = (error as NodeJS.ErrnoException | null)?.code;
    // The process was collected between the probe and the read.
    if (code === "ENOENT" || code === "ESRCH") return { result: "absent" };
    return { result: "unknown", errorCode: code };
  }
  // The state follows the parenthesized command name, which may contain spaces
  // and parentheses of its own.
  const state = stat.charAt(stat.lastIndexOf(")") + 2);
  return { result: state === "Z" || state === "X" ? "absent" : "present" };
}
