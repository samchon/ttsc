import { RESULT_AUDIT_DETAILS, RESULT_AUDIT_DETAILS_CAPPED } from "@ttsc/graph";

import { assert } from "../internal/ttsgraph";

/**
 * Verifies the details audit stops claiming whole-member coverage once a caller
 * cap has cut the list.
 *
 * The unconditional audit tells the reader a symbol's members are complete and
 * not to open the file for them. After `memberLimit` truncates, that is the one
 * claim a caller cannot check against the result: the members that were removed
 * left nothing behind to notice. A two-member node requested with `memberLimit:
 * 1` returned one member under a completeness claim.
 *
 * The capped text is derived from the uncapped one, and this file is stored
 * with CRLF, so a literal `\n` in the needle would never match the template
 * literal's real line breaks and the derivation would silently produce an
 * identical string. Asserting the two differ is what pins that.
 *
 * 1. Assert the capped audit is not the uncapped audit.
 * 2. Assert it no longer claims the members are complete.
 * 3. Assert it keeps the halves that are still true: the fan-out slice and the
 *    instruction to follow `next`.
 */
export const test_ttscgraph_details_audit_withdraws_completeness_when_capped =
  (): void => {
    assert.notEqual(
      RESULT_AUDIT_DETAILS_CAPPED,
      RESULT_AUDIT_DETAILS,
      "the capped audit must actually differ from the uncapped one",
    );
    assert.ok(
      RESULT_AUDIT_DETAILS.includes("its signature — is complete"),
      "the uncapped audit still claims a complete identity",
    );
    assert.ok(
      !RESULT_AUDIT_DETAILS_CAPPED.includes(
        "members, its values, its signature — is complete",
      ),
      `the capped audit still claims complete members:\n${RESULT_AUDIT_DETAILS_CAPPED}`,
    );
    assert.ok(
      RESULT_AUDIT_DETAILS_CAPPED.includes("memberLimit"),
      "the capped audit names the cap the caller asked for",
    );
    for (const kept of ["short orientation", "Follow"])
      assert.ok(
        RESULT_AUDIT_DETAILS_CAPPED.includes(kept),
        `the capped audit dropped a half that is still true: ${kept}`,
      );
  };
