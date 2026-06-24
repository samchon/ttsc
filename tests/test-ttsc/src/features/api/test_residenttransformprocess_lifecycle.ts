import assert from "node:assert/strict";

import { ResidentTransformProcess } from "../../../../../packages/ttsc/lib/compiler/internal/residentTransformProcess.js";

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
 */
export const test_residenttransformprocess_lifecycle = async () => {
  // 1. FIFO: two concurrent requests each resolve to their own ordered reply.
  {
    const proc = spawnStub(ECHO_STUB);
    try {
      const [a, b] = await Promise.all([
        proc.request({ file: "a.ts" }),
        proc.request({ file: "b.ts" }),
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
    const warm = await proc.request({ file: "warm.ts" });
    assert.equal(warm.typescript, "echo:warm.ts");
    proc.dispose();
    await assert.rejects(() => proc.request({ file: "after.ts" }));
    proc.dispose(); // idempotent
  }

  // 3. A host that dies mid-session rejects the in-flight request and does not
  //    crash the consumer; the stream "error" handlers swallow the broken pipe.
  {
    const proc = spawnStub(DIE_STUB);
    await assert.rejects(() => proc.request({ file: "x.ts" }));
    proc.dispose(); // safe on an already-dead host
  }
};
