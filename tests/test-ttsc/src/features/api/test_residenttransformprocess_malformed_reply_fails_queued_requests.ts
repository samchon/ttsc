import assert from "node:assert/strict";

import { ResidentTransformProcess } from "../../../../../packages/ttsc/lib/compiler/internal/residentTransformProcess.js";

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
 */
export const test_residenttransformprocess_malformed_reply_fails_queued_requests =
  async () => {
    const proc = spawnStub(CORRUPT_THEN_VALID_STUB);
    try {
      const first = proc.request({ file: "a.ts" }, "transform");
      const second = proc.request({ file: "b.ts" }, "transform");
      // The malformed line must not be delivered to the second request; both
      // reject rather than the late valid reply pairing with `second`.
      await assert.rejects(() => first, /malformed reply/);
      await assert.rejects(() => second);
      // The process is failed, so a fresh request rejects immediately instead
      // of being answered by the discarded valid line.
      await assert.rejects(() => proc.request({ file: "c.ts" }, "transform"));
    } finally {
      proc.dispose();
    }
  };
