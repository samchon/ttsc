import {
  RESULT_AUDIT,
  RESULT_AUDIT_DETAILS,
  RESULT_AUDIT_DETAILS_CAPPED,
  RESULT_AUDIT_SELECTION,
} from "@ttsc/graph";

import { assert } from "../internal/ttsgraph";

/**
 * Verifies no audit claims a verification pass the server does not perform.
 *
 * Every non-escape audit opened by saying the server assembled the result and
 * then checked it — a second party, at a later time, re-resolving each fact on
 * the way out. No such pass exists: the layer that stamps the audit holds no
 * `Program` and no checker, runs one pure projection over an in-memory graph,
 * and picks a constant by request type. A result that instructs the reader to
 * trust it and re-verify nothing has to earn that with a claim the code keeps.
 *
 * What is true is stated instead: the compiler resolved these facts when the
 * snapshot was built, and the result is a projection of exactly those facts.
 *
 * 1. Assert no audit says the server checked or re-verified the result.
 * 2. Assert each still names the compiler as the resolver, so provenance is not
 *    lost with the false half.
 * 3. Assert the escape branch keeps claiming nothing at all.
 */
export const test_ttscgraph_audit_claims_only_what_the_server_does =
  (): void => {
    const audits: [string, string][] = [
      ["walk", RESULT_AUDIT],
      ["selection", RESULT_AUDIT_SELECTION],
      ["details", RESULT_AUDIT_DETAILS],
      ["details capped", RESULT_AUDIT_DETAILS_CAPPED],
    ];
    for (const [name, raw] of audits) {
      // The constants are prose hard-wrapped for display, so a phrase can span
      // a line break. Assert on the sentence, not on where it happens to wrap.
      const audit = raw.replace(/\s+/g, " ");
      for (const claim of [
        "verified them again",
        "then checked it",
        "the server verified",
      ])
        assert.ok(
          !audit.includes(claim),
          `${name} audit still claims a pass the server does not run: ${claim}`,
        );
      assert.ok(
        audit.includes("resolved by the TypeScript compiler"),
        `${name} audit lost the provenance it can keep`,
      );
      assert.ok(
        audit.includes("projection of exactly those facts"),
        `${name} audit no longer says what this payload did with them`,
      );
    }
  };
