import assert from "node:assert/strict";

import { ResidentTransformProcess } from "../../../../../../packages/ttsc/lib/compiler/internal/ResidentTransformProcess.js";
import { observeResidentTransformClose } from "../../../internal/ttsc/internal/observeResidentTransformClose";

/**
 * A stub that, on the first request it reads, writes one malformed line and
 * then the real (valid) transform reply — the exact corruption pattern where a
 * bad line steals a FIFO slot and the genuine reply arrives one slot late. It
 * ignores every later request so no other reply can rescue the queue.
 */
const CORRUPT_THEN_VALID_STUB = `
process.stdin.setEncoding("utf8");
let count = 0;
let buf = "";
process.stdin.on("data", (chunk) => {
  buf += chunk;
  let i;
  while ((i = buf.indexOf("\\n")) !== -1) {
    const line = buf.slice(0, i);
    buf = buf.slice(i + 1);
    if (line.trim().length === 0) continue;
    if (++count === 1) {
      process.stdout.write("not-json\\n");
      process.stdout.write(
        JSON.stringify({ typescript: "echo", found: true }) + "\\n",
      );
    }
  }
});
`;

function spawnStub(stub: string): ResidentTransformProcess {
  return new ResidentTransformProcess({
    binary: process.execPath,
    args: ["-e", stub],
  });
}

/**
 * Verifies a malformed reply fails the whole resident process so a later valid
 * line can never be mispaired with the wrong queued request.
 *
 * A malformed line steals the first request's FIFO slot; the host's real reply
 * then arrives one slot late and, if accepted, would answer the _next_ request
 * with the _previous_ request's data. Treating the malformed line as fatal
 * seals that desync: every in-flight request rejects, the trailing valid line
 * is discarded as benign, and no subsequent request is served.
 *
 * 1. Queue two transform requests before any reply arrives.
 * 2. The host emits one malformed line then a valid reply for the first.
 * 3. Assert both queued requests reject and a third request also rejects (the
 *    process is failed, not silently answering the late reply).
 *
 * @evidence contracts/testing.md#behavioral-verification Queues two requests to a real pipe peer emitting not-json then one valid line; asserts both reject and a third request cannot consume the trailing valid reply.
 * @evidence contracts/testing.md#independent-expectations The independently authored peer emits one corrupt frame and a first-request reply while ignoring later inputs; accepting the trailing line for a later slot would violate positional ownership.
 * @evidence contracts/testing.md#distinguishing-cases This malformed-before-valid ordering distinguishes terminal framing corruption from valid negative results and wrong-operation object shape.
 * @evidence contracts/testing.md#execution-ownership The named API feature runs ResidentTransformProcess against an actual Node child under TestExecutor.
 * @evidence contracts/e2e.md#necessary-boundary The corruption and valid tail traverse real stdout/readline delivery, exposing FIFO desynchronization and retirement that pure JSON validation cannot detect.
 * @evidence contracts/e2e.md#shared-execution One child consumes both queued requests and the later-request probe; no separate host or build is needed per assertion.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Both queued promises have settlement observers before sequential assertions; the actual fixture child close is subscribed before requests. Finally disposes and awaits that close, retaining primary and cleanup errors. A timeout is failure, not termination proof; arbitrary descendants and a Go producer are not certified.
 * @evidence contracts/e2e.md#preserved-coverage Both queued rejections, malformed error text and post-failure rejection remain. The peer is a deliberate corrupt transport fixture, not evidence of Go producer correctness.
 */
export const test_residenttransformprocess_malformed_reply_fails_queued_requests =
  async () => {
    let proc: ResidentTransformProcess | undefined;
    let release: (() => Promise<void>) | undefined;
    const failures: unknown[] = [];
    try {
      proc = spawnStub(CORRUPT_THEN_VALID_STUB);
      release = observeResidentTransformClose(proc);
      const client = proc;
      const first = proc.request({ file: "a.ts" }, "transform");
      const second = proc.request({ file: "b.ts" }, "transform");
      await Promise.allSettled([first, second]);
      // The malformed line must not be delivered to the second request; both
      // reject rather than the late valid reply pairing with `second`.
      await assert.rejects(() => first, /malformed reply/);
      await assert.rejects(() => second);
      // The process is failed, so a fresh request rejects immediately instead
      // of being answered by the discarded valid line.
      await assert.rejects(() => client.request({ file: "c.ts" }, "transform"));
    } catch (error) {
      failures.push(error);
    } finally {
      try {
        if (release) await release();
        else proc?.dispose();
      } catch (error) { failures.push(error); }
    }
    if (failures.length === 1) throw failures[0];
    if (failures.length > 1)
      throw new AggregateError(failures, "Malformed reply and fixture cleanup failed");
  };
