import fs from "node:fs";

/**
 * Observe a spawned Linux child's current proc incarnation for a later observer
 * in the same native view. This is neither a wait nor an exit/stdio-close proof.
 * The private spawn observer calls it only with tracing enabled.
 *
 * Two child records bracketed by equal writer views reject observed identity
 * changes. Read failures stay unavailable; a zombie is still a present record.
 * PID reuse before the first read is not excluded by these samples alone.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Actual child records retain decimal start ticks and state separately; equal
 *   boot, namespace and proc identities qualify the sampled view. Disagreement
 *   and unavailable reads provide no incarnation or departure certificate.
 * @evidence contracts/common.md#clear-and-simple-design
 *   One private observation returns facts or an explicit unknown outcome, with
 *   bounded text reads and view/record parsing local to the observation.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   No PID-only lifetime inference, synthetic terminal event, foreign process
 *   mutation, product stop API or inferred child/runtime count is introduced.
 * @evidence contracts/common.md#meaningful-documentation
 *   Prose distinguishes sampled native identity, prior PID reuse and later
 *   departure from Node exit status, stdio closure and descendant joins.
 * @evidence contracts/portability.md#os-neutral-implementation
 *   Linux proc observations use native bigint dev/ino, namespace links and boot
 *   identity. Other platforms or missing PIDs return unavailable without proc IO.
 * @evidence contracts/performance.md#efficient-algorithms
 *   A fixed number of native reads and metadata queries observe one child.
 *   Each opened text file reads at most 4097 bytes; parsing follows those bytes
 *   and native namespace-link text, with no process or directory enumeration.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   An incarnation/view can change between invocations, so prior samples cannot
 *   replace this actual spawn observation and no cross-call proof is cached.
 * @evidence contracts/performance.md#bound-retention-and-release-resources
 *   Each text descriptor has a finally close attempt; buffers and records are
 *   call-owned. The trace caller retains returned facts under its existing budget.
 */
export function traceNativeIncarnation(
  pid: number | undefined,
): Record<string, unknown> {
  if (process.platform !== "linux" || pid === undefined) {
    return { outcome: "unavailable", pid: pid ?? null };
  }
  const readText = (file: string): string => {
    const handle = fs.openSync(file, "r");
    try {
      const bytes = Buffer.alloc(4097);
      let length = 0;
      while (length < bytes.length) {
        const read = fs.readSync(
          handle,
          bytes,
          length,
          bytes.length - length,
          null,
        );
        if (read === 0) break;
        length += read;
      }
      if (length > 4096) throw new Error("proc-text-budget");
      return bytes.toString("utf8", 0, length);
    } finally {
      fs.closeSync(handle);
    }
  };
  const readView = () => {
    const proc = fs.statSync("/proc", { bigint: true });
    const bootId = readText("/proc/sys/kernel/random/boot_id").trim();
    const pidNamespace = fs.readlinkSync("/proc/self/ns/pid");
    const mountNamespace = fs.readlinkSync("/proc/self/ns/mnt");
    if (
      !bootId ||
      !/^pid:\[[0-9]+\]$/.test(pidNamespace) ||
      !/^mnt:\[[0-9]+\]$/.test(mountNamespace)
    ) {
      throw new Error("invalid-proc-view");
    }
    return {
      bootId,
      pidNamespace,
      mountNamespace,
      procDevice: proc.dev.toString(),
      procInode: proc.ino.toString(),
    };
  };
  const readChild = () => {
    const text = readText(`/proc/${pid}/stat`);
    const end = text.lastIndexOf(")");
    if (!text.startsWith(`${pid} (`) || end < 0) {
      throw new Error("invalid-proc-record");
    }
    const fields = text.slice(end + 1).trim().split(/\s+/);
    const state = fields[0];
    const parentPid = fields[1];
    const startTicks = fields[19];
    if (
      state === undefined ||
      !/^[A-Za-z]$/.test(state) ||
      parentPid === undefined ||
      !/^[0-9]+$/.test(parentPid) ||
      startTicks === undefined ||
      !/^[0-9]+$/.test(startTicks)
    ) {
      throw new Error("invalid-proc-record");
    }
    return { state, parentPid, startTicks };
  };
  try {
    const before = readView();
    const first = readChild();
    const second = readChild();
    const after = readView();
    if (
      JSON.stringify(before) !== JSON.stringify(after) ||
      first.startTicks !== second.startTicks ||
      first.parentPid !== String(process.pid) ||
      second.parentPid !== String(process.pid)
    ) {
      return { outcome: "unstable", pid };
    }
    return {
      outcome: "observed",
      pid,
      startTicks: second.startTicks,
      state: second.state,
      view: after,
    };
  } catch (error) {
    return {
      outcome: "unavailable",
      pid,
      errorCode: (error as NodeJS.ErrnoException)?.code ?? "observation-failed",
    };
  }
}
