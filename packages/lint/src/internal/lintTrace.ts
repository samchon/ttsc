import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

let writer:
  | {
      root: string;
      instance: string;
      ordinal: number;
      sequence: number;
      bytes: number;
    }
  | undefined;

/**
 * Begins a private observation identity for an actual owned native call.
 *
 * An unset marker disables IO. The absolute scratch root and process nonce are
 * fixed across calls. Events retain actual results and honest call bounds;
 * sink failures never change product bytes/errors or write protocol streams.
 * The coordinator detects missing/corrupt evidence and owns file retention.
 * Each append closes its own descriptor and output is capped at 256 MiB for
 * this writer. This helper does not count delegate calls as process starts.
 *
 * @evidence contracts/common.md#principled-implementation A process nonce, per-call ordinal and event sequence correlate actual owner observations in the shared private schema without modifying product requests.
 * @evidence contracts/common.md#clear-and-simple-design One private writer owns event encoding, the retained byte budget and closed appends; callers provide actual primitive results.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The issue-defined opt-in uses supported native APIs without foreign mutation, expected-output generation or consumer special cases.
 * @evidence contracts/common.md#meaningful-documentation Native prose states disabled IO, failure effects, root lifetime, per-write closure and the distinction between observation and inferred starts.
 */
export function beginLintTrace():
  | {
      record: (event: string, data: Record<string, unknown>) => void;
    }
  | undefined {
  const root = process.env.TTSC_E2E_TRACE;
  if (!root) return undefined;
  try {
    if (!writer) {
      if (!path.isAbsolute(root) || !fs.statSync(root).isDirectory())
        return undefined;
      writer = {
        root,
        instance: randomUUID(),
        ordinal: 0,
        sequence: 0,
        bytes: 0,
      };
    }
    const state = writer;
    const invocation = `${process.pid}-${state.instance}-${++state.ordinal}`;
    const observation = {
      record: (event: string, data: Record<string, unknown>): void => {
        let descriptor: number | undefined;
        let failure: string | undefined;
        try {
          const body = Buffer.from(
            JSON.stringify({
              schema: 1,
              event,
              writerPid: process.pid,
              instance: state.instance,
              sequence: ++state.sequence,
              at: new Date().toISOString(),
              invocation,
              pid: Object.hasOwn(data, "pid") ? data.pid : process.pid,
              data,
            }) + "\n",
          );
          if (body.length > 256 * 1024 * 1024 - state.bytes) return;
          descriptor = fs.openSync(
            path.join(state.root, `${process.pid}-${state.instance}.jsonl`),
            "a",
            0o600,
          );
          const written = fs.writeSync(descriptor, body);
          state.bytes += written;
          if (written !== body.length)
            failure = `partial trace write: ${written}/${body.length}`;
        } catch (error) {
          failure = error instanceof Error ? error.message : String(error);
          // Missing or partial observation is an integrity failure for the
          // coordinator; product responses and errors remain the owner's.
        } finally {
          if (descriptor !== undefined) {
            try {
              fs.closeSync(descriptor);
            } catch (error) {
              failure = error instanceof Error ? error.message : String(error);
              // The observation sink cannot replace a product outcome.
            }
          }
        }
        if (failure !== undefined && event !== "trace-integrity-failure")
          observation.record("trace-integrity-failure", {
            operation: "event-append",
            failedEvent: event,
            error: failure,
          });
      },
    };
    return observation;
  } catch {
    return undefined;
  }
}
