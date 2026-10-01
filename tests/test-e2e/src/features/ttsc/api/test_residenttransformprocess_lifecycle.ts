import assert from "node:assert/strict";

import { ResidentTransformProcess } from "../../../../../../packages/ttsc/lib/compiler/internal/ResidentTransformProcess.js";

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
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Each client owns one fixture child and disposal ends its session; no reply or queue is shared across terminal-state scenarios. Every session disposes in finally, including failures before the intended terminal transition.
 * @evidence contracts/e2e.md#preserved-coverage Original FIFO identities, disposal rejection and host-death rejection remain. All three peer lifetimes are released on assertion failure as well as success.
 */
export const test_residenttransformprocess_lifecycle = async () => {
  // 1. FIFO: two concurrent requests each resolve to their own ordered reply.
  {
    const proc = spawnStub(ECHO_STUB);
    try {
      const [a, b] = await Promise.all([
        proc.request({ file: "a.ts" }, "transform"),
        proc.request({ file: "b.ts" }, "transform"),
      ]);
      assert.equal(a.found, true);
      assert.equal(a.typescript, "echo:a.ts");
      assert.equal(b.typescript, "echo:b.ts");
    } finally {
      proc.dispose();
    }
  }

  // 2. dispose() rejects any later request.
  {
    const proc = spawnStub(ECHO_STUB);
    try {
      const warm = await proc.request({ file: "warm.ts" }, "transform");
      assert.equal(warm.typescript, "echo:warm.ts");
      proc.dispose();
      await assert.rejects(() => proc.request({ file: "after.ts" }, "transform"));
    } finally {
      proc.dispose(); // idempotent
    }
  }

  // 3. A host that dies mid-session rejects the in-flight request and does not
  //    crash the consumer; the stream "error" handlers swallow the broken pipe.
  {
    const proc = spawnStub(DIE_STUB);
    try {
      await assert.rejects(() => proc.request({ file: "x.ts" }, "transform"));
    } finally {
      proc.dispose(); // safe on an already-dead host
    }
  }
};
