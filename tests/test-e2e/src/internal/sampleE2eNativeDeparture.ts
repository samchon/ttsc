import fs from "node:fs";

/**
 * Samples a previously observed Linux incarnation after its writer has ended. A
 * first native sample after spawn cannot exclude earlier PID recycling, so this
 * does not certify that the sampled incarnation is the launched child. Absence
 * or replacement in the same native view establishes only departure of that
 * incarnation. It supplies no exit status, stdio close or descendant join, and
 * does not turn an incomplete process trace into a complete one.
 *
 * @evidence contracts/common.md#principled-implementation Requires recorded post-spawn PID/startTicks and matching boot, proc and namespace identities before interpreting a later native stat sample. Missing premises and unstable views remain unknown; pre-first-sample PID recycling remains uncertified.
 * @evidence contracts/common.md#clear-and-simple-design Returns an ancillary native observation separately from the Node process event stream and its admission policy.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Never manufactures process-result, exit or close rows, and does not interpret old PID-only traces as incarnation evidence.
 * @evidence contracts/common.md#meaningful-documentation States the narrow departure meaning and the unresolved status, pipe and descendant observations.
 * @evidence contracts/portability.md#os-neutral-implementation The Linux proc boundary is explicit; other platforms and inaccessible or changed native views return unknown rather than an OS-name-derived successful result.
 * @evidence contracts/performance.md#efficient-algorithms Reads a fixed number of bounded native files for one recorded incarnation, without scanning processes or descendants.
 * @evidence contracts/performance.md#reuse-equivalent-work Uses only the supplied spawn-time observation and fresh native samples; PID alone and a prior departure result are not reused as identity.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Each synchronous file handle closes in finally, each text read is limited to4096 bytes, and no process handle, timer or global state is retained.
 */
export function sampleE2eNativeDeparture(
  pid: number | null | undefined,
  incarnation: unknown,
): {
  outcome: "departed" | "present" | "unknown";
  reason: string;
  startTicks?: string;
  state?: string;
  sampledFrom: string;
  sampledUntil: string;
  launchIdentityCertified: false;
} {
  const sampledFrom = new Date().toISOString();
  let outcome: "departed" | "present" | "unknown" = "unknown";
  let reason = "missing-spawn-incarnation";
  let startTicks: string | undefined;
  let state: string | undefined;
  try {
    if (process.platform !== "linux") reason = "unsupported-native-view";
    else if (isIncarnation(incarnation) && incarnation.pid === pid) {
      const before = readView();
      let child: { startTicks: string; state: string } | null;
      try {
        child = readChild(incarnation.pid);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        child = null;
      }
      const after = readView();
      const expectedView = JSON.stringify({
        bootId: incarnation.view.bootId,
        pidNamespace: incarnation.view.pidNamespace,
        mountNamespace: incarnation.view.mountNamespace,
        procDevice: incarnation.view.procDevice,
        procInode: incarnation.view.procInode,
      });
      if (before !== after || before !== expectedView)
        reason = "native-view-mismatch";
      else if (child === null) {
        outcome = "departed";
        reason = "recorded-incarnation-absent";
      } else {
        startTicks = child.startTicks;
        state = child.state;
        outcome =
          child.startTicks === incarnation.startTicks ? "present" : "departed";
        reason =
          outcome === "present"
            ? "recorded-incarnation-present"
            : "pid-holds-another-incarnation";
      }
    }
  } catch (error) {
    reason =
      "native-sample-error:" +
      String((error as NodeJS.ErrnoException).code ?? error);
  }
  return {
    outcome,
    reason,
    startTicks,
    state,
    sampledFrom,
    sampledUntil: new Date().toISOString(),
    launchIdentityCertified: false,
  };
}

/** Reads the same native view fields as the enabled producer snapshot. */
function readView(): string {
  const proc = fs.statSync("/proc", { bigint: true });
  return JSON.stringify({
    bootId: readBoundedText("/proc/sys/kernel/random/boot_id").trim(),
    pidNamespace: fs.readlinkSync("/proc/self/ns/pid"),
    mountNamespace: fs.readlinkSync("/proc/self/ns/mnt"),
    procDevice: proc.dev.toString(),
    procInode: proc.ino.toString(),
  });
}

/** Reads a bounded proc record and releases its handle even on refusal. */
function readBoundedText(file: string): string {
  const handle = fs.openSync(file, "r");
  try {
    const buffer = Buffer.alloc(4097);
    let count = 0;
    while (count < buffer.length) {
      const length = fs.readSync(
        handle,
        buffer,
        count,
        buffer.length - count,
        null,
      );
      if (length === 0) return buffer.subarray(0, count).toString("utf8");
      count += length;
    }
    throw new Error("Native observation exceeds4096 bytes");
  } finally {
    fs.closeSync(handle);
  }
}

/** Parses native state and field22 after the complete parenthesized comm. */
function readChild(pid: number): { startTicks: string; state: string } {
  const text = readBoundedText(`/proc/${pid}/stat`);
  const delimiter = text.lastIndexOf(") ");
  if (!text.startsWith(`${pid} (`) || delimiter < 0)
    throw new Error("Invalid native PID stat");
  const fields = text
    .slice(delimiter + 2)
    .trim()
    .split(/\s+/);
  const state = fields[0];
  const startTicks = fields[19];
  if (
    state === undefined ||
    !/^[A-Za-z]$/.test(state) ||
    startTicks === undefined ||
    !/^\d+$/.test(startTicks)
  )
    throw new Error("Invalid native incarnation fields");
  return { startTicks, state };
}

/** Accepts only a complete producer observation, not a guessed PID identity. */
function isIncarnation(value: unknown): value is {
  outcome: "observed";
  pid: number;
  startTicks: string;
  view: {
    bootId: string;
    pidNamespace: string;
    mountNamespace: string;
    procDevice: string;
    procInode: string;
  };
} {
  if (value === null || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  if (
    item.outcome !== "observed" ||
    !Number.isSafeInteger(item.pid) ||
    (item.pid as number) <= 0 ||
    typeof item.startTicks !== "string" ||
    !/^\d+$/.test(item.startTicks) ||
    item.view === null ||
    typeof item.view !== "object"
  )
    return false;
  const view = item.view as Record<string, unknown>;
  return (
    typeof view.bootId === "string" &&
    view.bootId.length > 0 &&
    typeof view.pidNamespace === "string" &&
    view.pidNamespace.length > 0 &&
    typeof view.mountNamespace === "string" &&
    view.mountNamespace.length > 0 &&
    typeof view.procDevice === "string" &&
    /^\d+$/.test(view.procDevice) &&
    typeof view.procInode === "string" &&
    /^\d+$/.test(view.procInode)
  );
}
