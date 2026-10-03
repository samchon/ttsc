import assert from "node:assert/strict";

import { ResidentTransformProcess } from "../../../../../../packages/ttsc/lib/compiler/internal/ResidentTransformProcess.js";
import { observeResidentTransformClose } from "../../../internal/ttsc/internal/observeResidentTransformClose";

/**
 * A stub serve host: echoes one `{"typescript":"echo:<file>","found":true}`
 * reply per request line. Lets the protocol client be exercised in isolation
 * without building the real Go host.
 */
const ECHO_STUB = `
process.stdin.setEncoding("utf8");
let buf = "";
process.stdin.on("data", (chunk) => {
  buf += chunk;
  let i;
  while ((i = buf.indexOf("\\n")) !== -1) {
    const line = buf.slice(0, i);
    buf = buf.slice(i + 1);
    if (line.trim().length === 0) continue;
    const req = JSON.parse(line);
    process.stdout.write(
      JSON.stringify({ typescript: "echo:" + req.file, found: true }) + "\\n",
    );
  }
});
`;

/** A stub that exits on the first request without replying (host dies). */
const DIE_STUB = `
process.stdin.resume();
process.stdin.once("data", () => process.exit(7));
`;

function spawnStub(stub: string): ResidentTransformProcess {
  return new ResidentTransformProcess({
    binary: process.execPath,
    args: ["-e", stub],
  });
}

/**
 * Verifies the resident protocol client's lifecycle against a stub host: FIFO
 * matching of concurrent replies, dispose rejecting later requests, and a host
 * that dies mid-session rejecting the in-flight request without crashing the
 * consumer (the stream "error" handlers added for samchon/ttsc#255).
 *
 * This is the direct regression test for the pipe-error hardening: reaching the
 * end of the host-death case is itself the no-crash assertion, because an
 * unhandled pipe "error" would take the whole test process down.
 *
 * 1. Resolve two concurrent replies from one echo peer in FIFO order.
 * 2. Warm another peer, dispose it and reject a subsequent request.
 * 3. Exit a third peer during a request and require rejection without crashing.
 *
 * @evidence contracts/testing.md#behavioral-verification Sends concurrent a.ts/b.ts requests to an actual Node pipe host, verifies FIFO echo identities, rejects requests after disposal and rejects in-flight work when a host exits with code 7.
 * @evidence contracts/testing.md#independent-expectations The independent echo fixture returns the received filename and the exit fixture sends no reply; authored names establish reply ownership without querying client queue logic.
 * @evidence contracts/testing.md#distinguishing-cases The entry owns healthy concurrent replies, terminal disposal, repeated disposal and abrupt host death; malformed framing and cancellation have separate cases.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers this named API feature; ResidentTransformProcess starts real Node children and exchanges stdin/stdout protocol lines.
 * @evidence contracts/e2e.md#necessary-boundary Real pipes can close or emit unhandled errors independently of promise/JSON logic; the abrupt-host case protects consumer survival, while the echo fixture supplies a controlled peer rather than a real Go transform oracle.
 * @evidence contracts/e2e.md#shared-execution One echo host handles both concurrent requests; a second handles dispose-after-warmup and a third intentionally dies. These terminal states require distinct lifetimes, with no native build or installation per peer.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Every distinct client subscribes to its actual owned child's close before requests, then disposes and awaits that receipt in finally. The private child read is cleanup-only, not an oracle or method replacement. Close timeout remains failure, not a joined descendant tree; all independent scenario and cleanup causes are retained.
 * @evidence contracts/e2e.md#preserved-coverage Original FIFO identities, warm reply, later-request rejection, repeated disposal and host-death rejection remain. Both FIFO promises have settlement observers before assertions, and all three independent lifetimes are attempted even after a prior failure. Actual fixture close is separate from Go producer correctness or total process completeness.
 */
export const test_residenttransformprocess_lifecycle = async () => {
  const failures: unknown[] = [];
  // 1. FIFO: two concurrent requests each resolve to their own ordered reply.
  {
    let proc: ResidentTransformProcess | undefined;
    let release: (() => Promise<void>) | undefined;
    try {
      proc = spawnStub(ECHO_STUB);
      release = observeResidentTransformClose(proc);
      const replies = await Promise.allSettled([
        proc.request({ file: "a.ts" }, "transform"),
        proc.request({ file: "b.ts" }, "transform"),
      ]);
      const first = replies[0]!;
      const second = replies[1]!;
      if (first.status !== "fulfilled" || second.status !== "fulfilled") {
        const rejected: unknown[] = [];
        if (first.status === "rejected") rejected.push(first.reason);
        if (second.status === "rejected") rejected.push(second.reason);
        throw new AggregateError(rejected, "FIFO echo requests rejected");
      }
      const a = first.value;
      const b = second.value;
      assert.equal(a.found, true);
      assert.equal(a.typescript, "echo:a.ts");
      assert.equal(b.typescript, "echo:b.ts");
    } catch (error) {
      failures.push(new Error("FIFO echo", { cause: error }));
    } finally {
      try {
        if (release) await release();
        else proc?.dispose();
      } catch (error) {
        failures.push(new Error("FIFO echo cleanup", { cause: error }));
      }
    }
  }

  // 2. dispose() rejects any later request.
  {
    let proc: ResidentTransformProcess | undefined;
    let release: (() => Promise<void>) | undefined;
    try {
      proc = spawnStub(ECHO_STUB);
      release = observeResidentTransformClose(proc);
      const client = proc;
      const warm = await proc.request({ file: "warm.ts" }, "transform");
      assert.equal(warm.typescript, "echo:warm.ts");
      proc.dispose();
      await assert.rejects(() => client.request({ file: "after.ts" }, "transform"));
    } catch (error) {
      failures.push(new Error("Dispose after warmup", { cause: error }));
    } finally {
      try {
        if (release) await release();
        else proc?.dispose();
      } catch (error) {
        failures.push(new Error("Dispose after warmup cleanup", { cause: error }));
      }
    }
  }

  // 3. A host that dies mid-session rejects the in-flight request and does not
  //    crash the consumer; the stream "error" handlers swallow the broken pipe.
  {
    let proc: ResidentTransformProcess | undefined;
    let release: (() => Promise<void>) | undefined;
    try {
      proc = spawnStub(DIE_STUB);
      release = observeResidentTransformClose(proc);
      const client = proc;
      await assert.rejects(() => client.request({ file: "x.ts" }, "transform"));
    } catch (error) {
      failures.push(new Error("Abrupt host death", { cause: error }));
    } finally {
      try {
        if (release) await release();
        else proc?.dispose();
      } catch (error) {
        failures.push(new Error("Abrupt host death cleanup", { cause: error }));
      }
    }
  }
  if (failures.length)
    throw new AggregateError(failures, "Resident transform lifecycle failures");
};
