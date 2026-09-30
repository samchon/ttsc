import assert from "node:assert/strict";

import { ResidentTransformProcess } from "../../../../../packages/ttsc/lib/compiler/internal/ResidentTransformProcess.js";

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
 * one the host cannot withhold.
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
 * @evidence contracts/testing.md#independent-expectations The independent delayed/silent peers determine whether replies can arrive; explicit abort reasons and filenames establish caller ownership without deriving expectations from queue internals.
 * @evidence contracts/testing.md#distinguishing-cases Pre-write and in-flight cancellation intentionally differ; delayed success distinguishes latency from failure, and synthetic late delivery checks the terminal reader branch.
 * @evidence contracts/testing.md#execution-ownership The named API feature runs three actual Node sessions through ResidentTransformProcess; one late-line probe also invokes the private reader boundary directly.
 * @evidence contracts/e2e.md#necessary-boundary Real pending requests, live pipes and abort delivery must settle without shifting FIFO ownership; the direct late-line injection isolates a race branch without claiming an actual OS kill ordering.
 * @evidence contracts/e2e.md#shared-execution Delayed success and preabort healthy reuse share one delayed peer; queued abort and late-tail terminal checks each require their own lifetime.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Every private client is disposed in finally, including repeated disposal in the late-tail branch. AbortControllers and pending slots are case-local; no shared host survives retirement.
 * @evidence contracts/e2e.md#preserved-coverage All delay, abort-name/reason, collateral-error, empty-pending and later-request rejection assertions remain. The pending-array check couples to internal storage, while settlement predicates provide observable failure ownership.
 */
export const test_residenttransformprocess_request_bounds = async () => {
  // A host may be slow without being failed, and nothing bounds how slow.
  {
    const proc = spawnStub(delayedReplyStub(40));
    try {
      const reply = await proc.request({ file: "slow.ts" }, "transform");
      assert.equal(reply.typescript, "slow.ts");
      // Pre-write cancellation rejects only this caller; the same peer remains healthy.
      const controller = new AbortController();
      controller.abort("caller stopped before write");
      await assert.rejects(
        () =>
          proc.request({ file: "cancelled.ts" }, "transform", {
            signal: controller.signal,
          }),
        (error: Error) =>
          error.name === "AbortError" &&
          /caller stopped before write/.test(error.message),
      );
      const healthy = await proc.request({ file: "healthy.ts" }, "transform");
      assert.equal(healthy.typescript, "healthy.ts");
    } finally {
      proc.dispose();
    }
  }

  // Once a request has entered the FIFO, cancelling it retires the host. The
  // caller sees AbortError, while a concurrent request settles with a distinct
  // collateral failure instead of hanging or receiving a mismatched reply.
  {
    const proc = spawnStub(SILENT_STUB);
    const controller = new AbortController();
    try {
      const cancelled = proc.request({ file: "cancelled.ts" }, "transform", {
        signal: controller.signal,
      });
      const collateral = proc.request({ file: "other.ts" }, "transform");
      controller.abort("editor closed the file");
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
    } finally {
      proc.dispose();
    }
  }

  // A line buffered after retirement belongs to no new request. Calling the
  // reader boundary directly models that late pipe tail without relying on a
  // platform-specific child-process kill race.
  {
    const proc = spawnStub(SILENT_STUB);
    const controller = new AbortController();
    try {
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
        () => proc.request({ file: "later.ts" }, "transform"),
        /retired after another request was cancelled/,
      );
    } finally {
      proc.dispose();
      proc.dispose();
    }
  }
};
