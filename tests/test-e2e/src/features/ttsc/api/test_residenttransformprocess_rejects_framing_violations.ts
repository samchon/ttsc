import assert from "node:assert/strict";

import { ResidentTransformProcess } from "../../../../../../packages/ttsc/lib/compiler/internal/ResidentTransformProcess.js";
import { observeResidentTransformClose } from "../../../internal/ttsc/internal/observeResidentTransformClose";

/**
 * A stub serve host that answers every request line with one fixed raw reply
 * line. `raw` is written verbatim (no JSON framing), so a caller can inject a
 * line that is deliberately not a JSON object.
 */
function rawReplyStub(raw: string): string {
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
    process.stdout.write(${JSON.stringify(raw)} + "\\n");
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
 * Verifies a reply line that is not a JSON object rejects the request as a
 * protocol failure instead of resolving an empty object.
 *
 * `parseReply` used to swallow every unparseable or non-object line into `{}`,
 * which `TtscService` then read as a valid negative result (a missing file or a
 * failed update). A malformed line, an array, a primitive, and `null` cannot
 * carry a reply's fields; each is a framing violation and must reject, not
 * masquerade as a domain negative.
 *
 * 1. For each of `not-json`, `[]`, `42`, `"str"`, `true`, and `null`, spawn a stub
 *    that answers with exactly that raw line.
 * 2. Send one transform request.
 * 3. Assert the request rejects with a "malformed reply" protocol error.
 *
 * @evidence contracts/testing.md#behavioral-verification Sends a transform request to real pipe peers replying not-json, array, number, string, boolean or null and requires malformed-reply rejection for every frame.
 * @evidence contracts/testing.md#independent-expectations The protocol requires a JSON object carrying operation fields; each authored raw literal violates that framing contract independently of parsing behavior.
 * @evidence contracts/testing.md#distinguishing-cases Six nonobject/malformed forms exercise framing rejection; valid negative and operation-shape cases provide complementary legal-object distinctions.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers the exported process feature and invokes actual Node peer sessions through ResidentTransformProcess.
 * @evidence contracts/e2e.md#necessary-boundary Each malformed frame must retire an actual line-reader session rather than masquerade as a domain-negative reply; transport retirement remains distinct from pure JSON parsing.
 * @evidence contracts/e2e.md#shared-execution Each malformed frame terminates its session, so six separate Node lifetimes remain; all are lightweight peer scripts without Go preparation or package installation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Every frame owns a separate client with actual child close subscribed before requests; finally attempts disposal and awaits that receipt. Each row retains preparation, assertion and cleanup failures before continuing independently. Timeout is failure, not arbitrary descendant termination; the private child read is solely cleanup ownership.
 * @evidence contracts/e2e.md#preserved-coverage All six original raw literals and malformed-reply predicates remain, with every row attempted even after an earlier failure. Programmed peers do not certify Go producer compatibility, malformed-byte decoding or total process completeness.
 */
export const test_residenttransformprocess_rejects_framing_violations =
  async () => {
    const nonObjectReplies = ["not-json", "[]", "42", '"str"', "true", "null"];
    const failures: unknown[] = [];
    for (const raw of nonObjectReplies) {
      let proc: ResidentTransformProcess | undefined;
      let release: (() => Promise<void>) | undefined;
      try {
        proc = spawnStub(rawReplyStub(raw));
        release = observeResidentTransformClose(proc);
        const client = proc;
        await assert.rejects(
          () => client.request({ file: "a.ts" }, "transform"),
          /malformed reply/,
          `non-object reply ${raw} should reject as a framing violation`,
        );
      } catch (error) {
        failures.push(new Error(raw, { cause: error }));
      } finally {
        try {
          if (release) await release();
          else proc?.dispose();
        } catch (error) {
          failures.push(new Error(`${raw} cleanup`, { cause: error }));
        }
      }
    }
    if (failures.length)
      throw new AggregateError(failures, "Resident framing failures");
  };
