import { assertAPassRecompilesAfterAMembershipChange } from "../../internal/transform-delivery-epoch";

/**
 * Verifies a pass recompiles when a file enters the project.
 *
 * A created file is the one change a content comparison cannot see, because it
 * has no recorded entry to differ from. The directory-membership half of the
 * generation's snapshot is what answers for it, so the pass gate has to consult
 * that half and not the input hashes alone.
 *
 * 1. Deliver every module inside one pass.
 * 2. Create a new source file under the project's `src` directory.
 * 3. Open a second pass, deliver one module, assert a second compile.
 */
export const test_transformttsc_a_build_pass_recompiles_after_a_membership_change =
  async () => {
    await assertAPassRecompilesAfterAMembershipChange();
  };
