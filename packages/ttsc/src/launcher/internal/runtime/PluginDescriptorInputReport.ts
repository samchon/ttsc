import fs from "node:fs";

import { PluginDescriptorInputObservation } from "./PluginDescriptorInputObservation";

/**
 * Own the isolated evaluator's ordered NDJSON report until its final snapshot.
 * One append descriptor is shared across records for the same destination. A
 * changed destination closes the previous one, and any open, write or close
 * failure permanently invalidates observation completeness.
 *
 * @evidence contracts/common.md#principled-implementation The in-memory envelope receives ordered records before synchronous file writes; finalization closes the report before the shim snapshots completeness, and every I/O refusal invalidates that proof.
 * @evidence contracts/common.md#clear-and-simple-design One namespace owns report append, path switch and final close while the runtime hooks own input observation.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The writer uses its own Node descriptor without replacing application filesystem functions or inferring missing input proof.
 * @evidence contracts/common.md#meaningful-documentation This comment states destination identity, finalization order and failure meaning.
 * @evidence contracts/portability.md#os-neutral-implementation Native output paths are passed to Node's file APIs and UTF-8 Buffer offsets count bytes on every host.
 * @evidence contracts/performance.md#efficient-algorithms A batch joins and encodes once; partial writes resume at the unwritten byte offset, without reopening for every observed input.
 * @evidence contracts/performance.md#reuse-equivalent-work Consecutive records for the same output reuse its open descriptor; a changed path closes the prior report before opening another.
 * @evidence contracts/performance.md#bound-retention-and-release-resources At most one descriptor is retained per process, from first write through finalization, destination change, write failure or process exit; failed close is never retried blindly and invalidates the proof.
 */
export namespace PluginDescriptorInputReport {
  /**
   * Append observations in order, invalidating proof if the report fails.
   *
   * @evidence contracts/common.md#principled-implementation The envelope records each supplied line first; any missing output, open failure, incomplete write or close refusal invalidates its completion bit.
   * @evidence contracts/common.md#clear-and-simple-design One append operation owns the current output descriptor and serialized batch.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Writes use this module's own descriptor, with no application method replacement or invented input record.
   * @evidence contracts/common.md#meaningful-documentation The comment states ordering and failure effects.
   * @evidence contracts/portability.md#os-neutral-implementation Node opens the native path and Buffer offsets count UTF-8 bytes independently of host character width.
   * @evidence contracts/performance.md#efficient-algorithms Each batch joins and encodes once, then retries only the unwritten suffix after a partial write.
   * @evidence contracts/performance.md#reuse-equivalent-work The same destination reuses its open descriptor across all batches in the evaluator; path changes close it first.
   * @evidence contracts/performance.md#bound-retention-and-release-resources One descriptor stays owned until finish, path switch, error or process exit, and a failed write closes it immediately.
   */
  export function append(lines: readonly string[]): void {
    if (lines.length === 0) return;
    if (process.env.TTSC_PLUGIN_DESCRIPTOR_INPUTS_ACTIVE !== "1") return;
    PluginDescriptorInputObservation.record(lines);
    const out = process.env.TTSC_PLUGIN_DESCRIPTOR_INPUTS_OUT;
    if (out === undefined || out.length === 0) {
      PluginDescriptorInputObservation.invalidate();
      return;
    }
    try {
      if (report?.out !== out) close();
      if (report === undefined) {
        report = { fd: fs.openSync(out, "a"), out };
        if (!exitRegistered) {
          process.on("exit", close);
          exitRegistered = true;
        }
      }
      const bytes = Buffer.from(lines.join(""), "utf8");
      for (let offset = 0; offset < bytes.length; ) {
        const written = fs.writeSync(
          report.fd,
          bytes,
          offset,
          bytes.length - offset,
        );
        if (written === 0)
          throw new Error("descriptor input report made no progress");
        offset += written;
      }
    } catch {
      PluginDescriptorInputObservation.invalidate();
      close();
    }
  }

  /**
   * Close the report and suspend recording before the final snapshot.
   *
   * @evidence contracts/common.md#principled-implementation The shim calls this after descriptor serialization so a close failure is included in the later completeness snapshot.
   * @evidence contracts/common.md#clear-and-simple-design One final transition joins report closure and input recording suspension.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Only the owned descriptor and protocol flag are changed, without treating a failed close as success.
   * @evidence contracts/common.md#meaningful-documentation The comment names closure, recording suspension and snapshot order.
   * @evidence contracts/portability.md#os-neutral-implementation The helper delegates native descriptor closure to Node and changes a process-local string flag only.
   * @evidenceExclude contracts/performance.md#efficient-algorithms One close and flag assignment are independent of report size.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Effectful finalization cannot share another evaluator's close.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Finalization releases the active descriptor, and repeating it after ownership clears is harmless.
   */
  export function finish(): void {
    close();
    process.env.TTSC_PLUGIN_DESCRIPTOR_INPUTS_ACTIVE = "0";
  }
}

let report: { fd: number; out: string } | undefined;
let exitRegistered = false;

/** Clear uncertain ownership before closing the current report. */
function close(): void {
  const current = report;
  report = undefined;
  if (current === undefined) return;
  try {
    fs.closeSync(current.fd);
  } catch {
    PluginDescriptorInputObservation.invalidate();
  }
}
