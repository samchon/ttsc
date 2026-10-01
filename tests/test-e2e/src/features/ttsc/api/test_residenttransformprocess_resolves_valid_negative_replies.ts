import assert from "node:assert/strict";

import { ResidentTransformProcess } from "../../../../../../packages/ttsc/lib/compiler/internal/ResidentTransformProcess.js";

/**
 * A stub that answers a transform request (`file` set) with a valid `{
 * typescript: "", found: false }` and an update request (`update` set) with a
 * valid `{ updated: false }`. Both are the host's genuine negative results, so
 * they must resolve, not reject.
 */
const NEGATIVE_STUB = `
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
    if (req.update !== undefined) {
      process.stdout.write(JSON.stringify({ updated: false }) + "\\n");
    } else {
      process.stdout.write(
        JSON.stringify({ typescript: "", found: false }) + "\\n",
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
 * Verifies the host's valid negative replies still resolve after the framing
 * and operation-shape hardening — the negative twin of the rejection tests.
 *
 * The stricter protocol boundary must reject only replies the host could never
 * validly send; it must not reclassify a legitimate `found: false` or `updated:
 * false` as a protocol failure. Losing these would turn every absent file and
 * every non-compiling edit into a rejection instead of the documented
 * `undefined` / `false` domain result.
 *
 * 1. Answer a transform request with `{ found: false }`; it resolves with `found
 *    === false`.
 * 2. Answer an update request with `{ updated: false }`; it resolves with `updated
 *    === false`.
 *
 * @evidence contracts/testing.md#behavioral-verification Sends transform and update requests through one real pipe peer and requires found:false and updated:false to resolve instead of rejecting.
 * @evidence contracts/testing.md#independent-expectations The authored peer explicitly answers domain-negative results allowed by the serve protocol; these booleans are independent expected values, not client-derived snapshots.
 * @evidence contracts/testing.md#distinguishing-cases The missing-file and unsuccessful-edit negatives complement the framing/shape rejections, distinguishing legal domain absence from corrupt transport.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers this named process feature; it creates an actual Node child and exchanges two request/reply lines.
 * @evidence contracts/e2e.md#necessary-boundary Both legal negative replies must survive client shape validation and promise settlement on a live session; this proves transport acceptance rather than Go transformation semantics.
 * @evidence contracts/e2e.md#shared-execution One peer lifetime handles both operation kinds with no Go build or installation, retaining shared session state between requests.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The private client queue belongs only to this entry and finally disposes its child on success or failure; no fixture filesystem or global environment is changed.
 * @evidence contracts/e2e.md#preserved-coverage Original found:false and updated:false assertions remain. They do not inspect optional fields or subsequent positive transformation behavior.
 */
export const test_residenttransformprocess_resolves_valid_negative_replies =
  async () => {
    const proc = spawnStub(NEGATIVE_STUB);
    try {
      const transform = await proc.request({ file: "a.ts" }, "transform");
      assert.equal(transform.found, false);

      const update = await proc.request(
        { content: "x", update: "a.ts" },
        "update",
      );
      assert.equal(update.updated, false);
    } finally {
      proc.dispose();
    }
  };
