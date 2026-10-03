import assert from "node:assert/strict";

import { ResidentTransformProcess } from "../../../../../../packages/ttsc/lib/compiler/internal/ResidentTransformProcess.js";
import { observeResidentTransformClose } from "../../../internal/ttsc/internal/observeResidentTransformClose";

/** A host that stays alive and consumes stdin but intentionally never replies. */
const SILENT_STUB = `
process.stdin.resume();
setInterval(() => {}, 1_000);
`;

/** A host that answers one transform request after a controlled delay. */
function delayedReplyStub(delayMs: number): string {
  return `
process.stdin.setEncoding("utf8");
let buf = "";
process.stdin.on("data", (chunk) => {
  buf += chunk;
  let i;
  while ((i = buf.indexOf("\\n")) !== -1) {
    const line = buf.slice(0, i);
    buf = buf.slice(i + 1);
    if (line.trim().length === 0) continue;
    const request = JSON.parse(line);
    setTimeout(() => {
      process.stdout.write(JSON.stringify({ found: true, typescript: request.file }) + "\\n");
    }, ${String(delayMs)});
  }
});
`;
}

function spawnStub(stub: string): ResidentTransformProcess {
  return new ResidentTransformProcess({
    args: ["-e", stub],
    binary: process.execPath,
  });
}

function pendingCount(process: ResidentTransformProcess): number {
  return (
    process as unknown as {
      pending: unknown[];
    }
  ).pending.length;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Verifies the resident client keeps reply ownership when a request leaves the
 * FIFO early.
 *
 * The client cannot remove one positional slot and keep reading: a reply that
 * arrived later would be paired to the wrong caller. So a cancellation retires
 * the host and this client fails closed, with the request that caused
 * retirement keeping its own error while the others receive the retirement
 * one.
 *
 * There is no deadline to exercise. A slow host is the user's own transform
 * running, and the client waits for it; a _dead_ host still settles every
 * pending call, because the reader closing is the signal that matters and it is
 * this entry exercises on its controlled peers. It does not establish a bound
 * for a permanently silent un-aborted request or descendant-held pipes.
 *
 * 1. Preserve a delayed reply, however late it lands.
 * 2. Keep a pre-write cancellation as one caller's concern, leaving the host
 *    healthy for the next.
 * 3. Prove an in-flight cancellation retires a shared host without leaving another
 *    pending request behind.
 * 4. Deliver a synthetic late protocol line after retirement and prove it cannot
 *    settle a later caller; dispose remains idempotent.
 *
 * @evidence contracts/testing.md#behavioral-verification Exercises delayed reply acceptance, pre-enqueue abort without host damage, post-enqueue abort with distinct collateral retirement, empty pending queue and ignored late line after retirement.
 * @evidence contracts/testing.md#independent-expectations Authored delayed/silent peers, abort reasons and filenames establish reply and error ownership independently. The pending-array length is a separate storage-shape observation, not an independent process or unsettled-request oracle.
 * @evidence contracts/testing.md#distinguishing-cases Pre-write and in-flight cancellation intentionally differ; delayed success distinguishes latency from failure, and synthetic late delivery checks the terminal reader branch.
 * @evidence contracts/testing.md#execution-ownership The named API feature runs three actual Node sessions through ResidentTransformProcess; one late-line probe also invokes the private reader boundary directly.
 * @evidence contracts/e2e.md#necessary-boundary Real pending requests, live pipes and abort delivery must settle without shifting FIFO ownership; the direct late-line injection isolates a race branch without claiming an actual OS kill ordering.
 * @evidence contracts/e2e.md#shared-execution Delayed success and preabort healthy reuse share one delayed peer; queued abort and late-tail terminal checks each require their own lifetime.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Each independent phase subscribes to actual child close before requests, then disposes and awaits that receipt in finally while preserving preparation/verdict/cleanup failures. Concurrent abort promises have settlement observers before abort. Private child access is cleanup-only and timeout is failure, not arbitrary descendant termination; controllers and slots remain phase-local.
 * @evidence contracts/e2e.md#preserved-coverage Original 40ms delayed identity, preabort reason/healthy reply, in-flight AbortError/editor reason/collateral error, pending-length0, private late-line input/10ms pause/later rejection and repeated disposal remain. A finite delay does not prove every latency, and direct late injection is not an observed OS kill race. All three phases remain independently attempted.
 */
export const test_residenttransformprocess_request_bounds = async () => {
  const failures: unknown[] = [];
  // A host may be slow without being failed, and nothing bounds how slow.
  {
    let proc: ResidentTransformProcess | undefined;
    let release: (() => Promise<void>) | undefined;
    try {
      proc = spawnStub(delayedReplyStub(40));
      release = observeResidentTransformClose(proc);
      const client = proc;
      const reply = await proc.request({ file: "slow.ts" }, "transform");
      assert.equal(reply.typescript, "slow.ts");
      // Pre-write cancellation rejects only this caller; the same peer remains healthy.
      const controller = new AbortController();
      controller.abort("caller stopped before write");
      await assert.rejects(
        () =>
          client.request({ file: "cancelled.ts" }, "transform", {
            signal: controller.signal,
          }),
        (error: Error) =>
          error.name === "AbortError" &&
          /caller stopped before write/.test(error.message),
      );
      const healthy = await proc.request({ file: "healthy.ts" }, "transform");
      assert.equal(healthy.typescript, "healthy.ts");
    } catch (error) {
      failures.push(new Error("Delayed/preabort phase", { cause: error }));
    } finally {
      try {
        if (release) await release();
        else proc?.dispose();
      } catch (error) {
        failures.push(new Error("Delayed/preabort cleanup", { cause: error }));
      }
    }
  }

  // Once a request has entered the FIFO, cancelling it retires the host. The
  // caller sees AbortError, while a concurrent request settles with a distinct
  // collateral failure instead of hanging or receiving a mismatched reply.
  {
    let proc: ResidentTransformProcess | undefined;
    let release: (() => Promise<void>) | undefined;
    const controller = new AbortController();
    try {
      proc = spawnStub(SILENT_STUB);
      release = observeResidentTransformClose(proc);
      const cancelled = proc.request({ file: "cancelled.ts" }, "transform", {
        signal: controller.signal,
      });
      const collateral = proc.request({ file: "other.ts" }, "transform");
      const settled = Promise.allSettled([cancelled, collateral]);
      controller.abort("editor closed the file");
      await settled;
      await assert.rejects(
        cancelled,
        (error: Error) =>
          error.name === "AbortError" &&
          /editor closed the file/.test(error.message),
      );
      await assert.rejects(
        collateral,
        /retired after another request was cancelled/,
      );
      assert.equal(pendingCount(proc), 0);
    } catch (error) {
      failures.push(new Error("In-flight abort phase", { cause: error }));
    } finally {
      try {
        if (release) await release();
        else proc?.dispose();
      } catch (error) {
        failures.push(new Error("In-flight abort cleanup", { cause: error }));
      }
    }
  }

  // A line buffered after retirement belongs to no new request. Calling the
  // reader boundary directly models that late pipe tail without relying on a
  // platform-specific child-process kill race.
  {
    let proc: ResidentTransformProcess | undefined;
    let release: (() => Promise<void>) | undefined;
    const controller = new AbortController();
    try {
      proc = spawnStub(SILENT_STUB);
      release = observeResidentTransformClose(proc);
      const client = proc;
      const cancelled = proc.request({ file: "late.ts" }, "transform", {
        signal: controller.signal,
      });
      controller.abort("caller gave up");
      await assert.rejects(
        cancelled,
        (error: Error) => error.name === "AbortError",
      );
      (
        proc as unknown as {
          onLine: (line: string) => void;
        }
      ).onLine(JSON.stringify({ found: true, typescript: "late.ts" }));
      await delay(10);
      await assert.rejects(
        () => client.request({ file: "later.ts" }, "transform"),
        /retired after another request was cancelled/,
      );
    } catch (error) {
      failures.push(new Error("Late-tail phase", { cause: error }));
    } finally {
      try {
        proc?.dispose();
      } catch (error) {
        failures.push(new Error("Late-tail first disposal", { cause: error }));
      }
      try {
        if (release) await release();
        else proc?.dispose();
      } catch (error) {
        failures.push(new Error("Late-tail cleanup", { cause: error }));
      }
    }
  }
  if (failures.length)
    throw new AggregateError(failures, "Resident request-bound failures");
};
