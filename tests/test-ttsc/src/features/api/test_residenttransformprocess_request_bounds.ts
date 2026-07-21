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

function spawnStub(
  stub: string,
  requestTimeoutMs: number,
): ResidentTransformProcess {
  return new ResidentTransformProcess({
    args: ["-e", stub],
    binary: process.execPath,
    requestTimeoutMs,
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
 * Verifies the resident client bounds a live-silent FIFO host without losing
 * reply ownership.
 *
 * A timeout or in-flight cancellation cannot remove one positional slot and
 * continue reading, because a reply that arrives later would then be paired to
 * the wrong caller. The process is consequently retired and this client fails
 * closed. The request that caused retirement retains its specific error, while
 * other pending calls receive the host-retirement error.
 *
 * 1. Reject invalid deadlines and preserve a delayed reply within the bound.
 * 2. Time out two pipelined requests, clear their pending state, and fail a later
 *    call closed.
 * 3. Preserve cancellation before write as one caller's concern, then prove an
 *    in-flight cancellation retires a shared host without leaving another
 *    pending request behind.
 * 4. Deliver a synthetic late protocol line after retirement and prove it cannot
 *    settle a later caller; dispose remains idempotent after timeout.
 */
export const test_residenttransformprocess_request_bounds = async () => {
  for (const value of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(() => spawnStub(SILENT_STUB, value), /requestTimeoutMs/);
  }
  assert.throws(
    () => spawnStub(SILENT_STUB, 2_147_483_648),
    /requestTimeoutMs/,
  );

  // A host may be slow without being failed. Its reply remains valid while it
  // lands inside the caller-selected bound.
  {
    const proc = spawnStub(delayedReplyStub(40), 500);
    try {
      const reply = await proc.request({ file: "slow.ts" }, "transform");
      assert.equal(reply.typescript, "slow.ts");
    } finally {
      proc.dispose();
    }
  }

  // A silent host leaves no request pending forever. Every concurrent entry
  // settles, and future requests fail closed instead of reusing an untrusted
  // FIFO stream.
  {
    const proc = spawnStub(SILENT_STUB, 60);
    try {
      const first = proc.request({ file: "first.ts" }, "transform");
      const second = proc.request({ file: "second.ts" }, "transform");
      await assert.rejects(() => first, /timed out after 60 ms/);
      await assert.rejects(
        () => second,
        /retired after another request timed out/,
      );
      assert.equal(pendingCount(proc), 0);
      await assert.rejects(
        () => proc.request({ file: "after.ts" }, "transform"),
        /retired after another request timed out/,
      );
      proc.dispose();
      proc.dispose();
    } finally {
      proc.dispose();
    }
  }

  // An already-aborted signal is never written into the FIFO. It rejects only
  // that call and leaves the still-healthy host available to another caller.
  {
    const proc = spawnStub(delayedReplyStub(0), 500);
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
    const proc = spawnStub(SILENT_STUB, 500);
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
    const proc = spawnStub(SILENT_STUB, 40);
    try {
      await assert.rejects(
        () => proc.request({ file: "late.ts" }, "transform"),
        /timed out after 40 ms/,
      );
      (
        proc as unknown as {
          onLine: (line: string) => void;
        }
      ).onLine(JSON.stringify({ found: true, typescript: "late.ts" }));
      await delay(10);
      await assert.rejects(
        () => proc.request({ file: "later.ts" }, "transform"),
        /retired after another request timed out/,
      );
    } finally {
      proc.dispose();
      proc.dispose();
    }
  }
};
