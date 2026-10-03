import assert from "node:assert/strict";

import { ResidentTransformProcess } from "../../../../../../packages/ttsc/lib/compiler/internal/ResidentTransformProcess.js";
import { observeResidentTransformClose } from "../../../internal/ttsc/internal/observeResidentTransformClose";

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
 * @evidence contracts/e2e.md#necessary-boundary Operation-specific rejection and later legal reply settle through actual pipes on the owning client. No new validator API is introduced merely to reclassify these assertions; this fixture is not a real Go transform producer.
 * @evidence contracts/e2e.md#shared-execution One ordered peer supplies three invalid objects and the legal negative reply. This is one actual fixture lifetime, not a measured historical startup reduction or total native/Program count.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity One client owns the ordered reply sequence; requests settle before the next is sent. Actual child close is subscribed before requests and awaited after disposal in finally, with primary and cleanup failures retained. The private child read is cleanup-only; timeout remains failure and close is not arbitrary descendant shutdown.
 * @evidence contracts/e2e.md#preserved-coverage Every original operation-specific rejection remains. The fixture peers do not exercise a real Go host, and a legal found:false reply after all three errors additionally proves the session remains usable.
 */
export const test_residenttransformprocess_rejects_wrong_operation_shape =
  async () => {
    let proc: ResidentTransformProcess | undefined;
    let release: (() => Promise<void>) | undefined;
    const failures: unknown[] = [];
    try {
      proc = spawnStub(jsonReplyStub([
      { updated: true },
      { found: true },
      { found: true, typescript: "x" },
      { found: false },
      ]));
      release = observeResidentTransformClose(proc);
      const client = proc;
      await assert.rejects(
        () => client.request({ file: "a.ts" }, "transform"),
        /invalid transform reply/,
      );
      await assert.rejects(
        () => client.request({ file: "a.ts" }, "transform"),
        /invalid transform reply/,
      );
      await assert.rejects(
        () => client.request({ content: "x", update: "a.ts" }, "update"),
        /invalid update reply/,
      );
      const healthy = await proc.request({ file: "missing.ts" }, "transform");
      assert.equal(healthy.found, false);
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
      throw new AggregateError(failures, "Operation shape and fixture cleanup failed");
  };
