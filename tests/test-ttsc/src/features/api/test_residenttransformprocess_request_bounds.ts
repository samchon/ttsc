import assert from "node:assert/strict";

import { ResidentTransformProcess } from "../../../../../packages/ttsc/lib/compiler/internal/residentTransformProcess.js";

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
 */
export const test_residenttransformprocess_request_bounds = async () => {
  // A host may be slow without being failed, and nothing bounds how slow.
  {
    const proc = spawnStub(delayedReplyStub(40));
    try {
      const reply = await proc.request({ file: "slow.ts" }, "transform");
      assert.equal(reply.typescript, "slow.ts");
    } finally {
      proc.dispose();
    }
  }

  // An already-aborted signal is never written into the FIFO. It rejects only
  // that call and leaves the still-healthy host available to another caller.
  {
    const proc = spawnStub(delayedReplyStub(0));
    const controller = new AbortController();
    controller.abort("caller stopped before write");
    try {
      await assert.rejects(
        () =>
          proc.request({ file: "cancelled.ts" }, "transform", {
            signal: controller.signal,
          }),
        (error: Error) =>
          error.name === "AbortError" &&
          /caller stopped before write/.test(error.message),
      );
      const reply = await proc.request({ file: "healthy.ts" }, "transform");
      assert.equal(reply.typescript, "healthy.ts");
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
