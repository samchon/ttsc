import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/**
 * Open one private observation correlation under the coordinator's absolute
 * scratch root. Unset tracing performs no IO and emits no events. The caller
 * reports only observations it actually made, never inferred child counts.
 *
 * Writes close their file immediately. Missing or over-budget trace output is
 * an observation integrity failure, never a replacement product result. The
 * coordinator owns the trusted root and joins writers before removing it.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Each actual invocation gets a writer-local ordinal; correlated events
 *   carry observed fields without changing product replies or process streams.
 * @evidence contracts/common.md#clear-and-simple-design
 *   One optional sink owns correlation, sequence, byte budget and JSONL writes.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Approved opt-in observation uses actual caller data, with no fixture oracle,
 *   foreign mutation, public option or tests/utils production dependency.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native paragraphs distinguish disabled IO, integrity failure and root ownership.
 * @evidence contracts/portability.md#os-neutral-implementation
 *   Native path.isAbsolute/join and appendFileSync address a coordinator-owned
 *   root; native PID, process.version and UTC ISO timestamps describe this writer,
 *   not an OS start or an inferred child runtime.
 * @evidence contracts/performance.md#efficient-algorithms
 *   Disabled calls read one environment value. Enabled events serialize their
 *   supplied fields and append their UTF8 bytes; temporary text follows event size.
 * @evidence contracts/performance.md#reuse-equivalent-work
 *   One process-local nonce and counters correlate this helper's events; actual
 *   invocations and effectful writes are never deduplicated into inferred work.
 * @evidence contracts/performance.md#bound-retention-and-release-resources
 *   Scalar counters and one nonce persist for this module copy. Each append closes
 *   its handle; output is capped at 64MiB/event and 256MiB/writer. Caller-held sink
 *   closures retain their root/correlation until their actual operation releases them.
 */
export function traceInvocation():
  | ((event: string, fields?: Record<string, unknown>) => void)
  | undefined {
  const root = process.env.TTSC_E2E_TRACE;
  if (!root || !path.isAbsolute(root)) return undefined;
  try {
    instance ??= randomUUID();
  } catch {
    return undefined;
  }
  const writerInstance = instance;
  const invocation = `${writerInstance}:${++ordinal}`;
  const file = path.join(root, `${process.pid}-${writerInstance}.jsonl`);
  return (event, fields = {}): void => {
    try {
      const core = {
        schema: 1,
        event,
        writerPid: process.pid,
        instance: writerInstance,
        sequence: ++sequence,
        at: new Date().toISOString(),
        invocation,
      };
      let line = `${JSON.stringify({
        ...fields,
        ...core,
        data: {
          ...(fields.data !== null && typeof fields.data === "object"
            ? fields.data
            : {}),
          writerRuntime: process.version,
        },
      })}\n`;
      let bytes = Buffer.byteLength(line);
      if (bytes > EVENT_LIMIT || written + bytes > WRITER_LIMIT) {
        line = `${JSON.stringify({
          ...core,
          event: "integrity-failure",
          pid: process.pid,
          data: {
            reason: "trace-byte-budget",
            observedBytes: bytes,
            writerRuntime: process.version,
          },
        })}\n`;
        bytes = Buffer.byteLength(line);
        if (written + bytes > WRITER_LIMIT) return;
      }
      fs.appendFileSync(file, line, { encoding: "utf8", mode: 0o600 });
      written += bytes;
    } catch {
      // Missing events make the coordinator's observation incomplete. Never
      // replace a product result/error or contaminate stdout/stderr/protocol IO.
    }
  };
}

let instance: string | undefined;
let ordinal = 0;
let sequence = 0;
let written = 0;
const EVENT_LIMIT = 64 * 1024 * 1024;
const WRITER_LIMIT = 256 * 1024 * 1024;
