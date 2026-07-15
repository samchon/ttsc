import assert from "node:assert/strict";

import { ResidentTransformProcess } from "../../../../../packages/ttsc/lib/compiler/internal/residentTransformProcess.js";

/**
 * A stub serve host that answers every request line with one fixed JSON reply
 * object. `reply` is a plain object serialized to one line, so the reply is a
 * well-formed JSON object whose *shape* may not match the operation requested.
 */
function jsonReplyStub(reply: unknown): string {
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
    process.stdout.write(JSON.stringify(${JSON.stringify(reply)}) + "\\n");
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
 * 1. Answer a transform request with `{ updated: true }` and with
 *    `{ found: true }` (no `typescript`); both must reject.
 * 2. Answer an update request with `{ found: true, typescript: "x" }`; it must
 *    reject.
 * 3. Assert each rejection names the offending operation.
 */
export const test_residenttransformprocess_rejects_wrong_operation_shape =
  async () => {
    // A transform request answered with an update-shaped reply.
    {
      const proc = spawnStub(jsonReplyStub({ updated: true }));
      try {
        await assert.rejects(
          () => proc.request({ file: "a.ts" }, "transform"),
          /invalid transform reply/,
        );
      } finally {
        proc.dispose();
      }
    }
    // A transform reply that claims the file was found but omits its text.
    {
      const proc = spawnStub(jsonReplyStub({ found: true }));
      try {
        await assert.rejects(
          () => proc.request({ file: "a.ts" }, "transform"),
          /invalid transform reply/,
        );
      } finally {
        proc.dispose();
      }
    }
    // An update request answered with a transform-shaped reply.
    {
      const proc = spawnStub(jsonReplyStub({ found: true, typescript: "x" }));
      try {
        await assert.rejects(
          () =>
            proc.request({ content: "x", update: "a.ts" }, "update"),
          /invalid update reply/,
        );
      } finally {
        proc.dispose();
      }
    }
  };
