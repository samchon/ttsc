import assert from "node:assert/strict";

import { ResidentTransformProcess } from "../../../../../packages/ttsc/lib/compiler/internal/ResidentTransformProcess.js";

/**
 * A stub serve host that sends the next authored JSON object per request line.
 * All replies have valid framing; their operation shapes differ deliberately.
 */
function jsonReplyStub(replies: unknown[]): string {
  return `
process.stdin.setEncoding("utf8");
let buf = "";
const replies = ${JSON.stringify(replies)};
process.stdin.on("data", (chunk) => {
  buf += chunk;
  let i;
  while ((i = buf.indexOf("\\n")) !== -1) {
    const line = buf.slice(0, i);
    buf = buf.slice(i + 1);
    if (line.trim().length === 0) continue;
    process.stdout.write(JSON.stringify(replies.shift()) + "\\n");
  }
});
`;
}

function spawnStub(stub: string): ResidentTransformProcess {
  return new ResidentTransformProcess({
    binary: process.execPath,
    args: ["-e", stub],
  });
}

/**
 * Verifies a well-formed JSON object of the wrong operation shape rejects with
 * an operation-specific protocol error rather than resolving as a valid reply.
 *
 * Framing (a JSON object) is necessary but not sufficient: a transform request
 * must be answered with a boolean `found` (and a string `typescript` when
 * found), an update request with a boolean `updated`. An update-shaped reply to
 * a transform request, or a `found: true` reply that omits `typescript`, is a
 * protocol error the FIFO cannot detect, so the client validates the shape per
 * operation and rejects a mismatch. The negative twins — valid `found: false`
 * and `updated: false` — must still resolve (a separate test).
 *
 * 1. Answer a transform request with `{ updated: true }` and with `{ found: true
 *    }` (no `typescript`); both must reject.
 * 2. Answer an update request with `{ found: true, typescript: "x" }`; it must
 *    reject.
 * 3. Assert each rejection names the offending operation.
 *
 * @evidence contracts/testing.md#behavioral-verification Requires invalid-transform rejection for update-shaped and missing-text found replies, and invalid-update rejection for a transform-shaped reply.
 * @evidence contracts/testing.md#independent-expectations The serve wire contract requires found boolean and found text for transform, and updated boolean for update; authored mismatched objects independently violate those fields.
 * @evidence contracts/testing.md#distinguishing-cases Three well-formed-object negatives isolate operation shape from malformed JSON; valid found:false and updated:false are covered separately.
 * @evidence contracts/testing.md#execution-ownership The named API feature runs actual Node peer processes and ResidentTransformProcess request/line settlement through TestExecutor.
 * @evidence contracts/e2e.md#necessary-boundary Operation-kind validation must reach request promises through actual pipe transport. These shape semantics could transfer to an extracted pure validator, but the present client owns no such public seam.
 * @evidence contracts/e2e.md#shared-execution One queued-reply peer serves all three invalid shapes and a legal negative reply, reducing three startups to one while proving recovery.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The ordered reply fixture belongs to one private client disposed in finally; each settled FIFO slot must leave the next request healthy.
 * @evidence contracts/e2e.md#preserved-coverage Every original operation-specific rejection remains. The fixture peers do not exercise a real Go host, and a legal found:false reply after all three errors additionally proves the session remains usable.
 */
export const test_residenttransformprocess_rejects_wrong_operation_shape =
  async () => {
    const proc = spawnStub(jsonReplyStub([
      { updated: true },
      { found: true },
      { found: true, typescript: "x" },
      { found: false },
    ]));
    try {
      await assert.rejects(
        () => proc.request({ file: "a.ts" }, "transform"),
        /invalid transform reply/,
      );
      await assert.rejects(
        () => proc.request({ file: "a.ts" }, "transform"),
        /invalid transform reply/,
      );
      await assert.rejects(
        () => proc.request({ content: "x", update: "a.ts" }, "update"),
        /invalid update reply/,
      );
      const healthy = await proc.request({ file: "missing.ts" }, "transform");
      assert.equal(healthy.found, false);
    } finally {
      proc.dispose();
    }
  };
