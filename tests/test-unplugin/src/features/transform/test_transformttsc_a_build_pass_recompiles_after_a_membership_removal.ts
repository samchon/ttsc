import { assertAPassRecompilesAfterAMembershipRemoval } from "../../internal/transform-delivery-epoch";

/**
 * Verifies a pass recompiles when a file leaves the project or changes kind.
 *
 * The membership digest replaced a directory metadata stamp, so it has to be at
 * least as strong for everything the walk can see and not only for the creation
 * case its sibling covers. A removal has no recorded hash to differ from and a
 * kind swap keeps the name, so both are invisible to the content comparison.
 *
 * 1. Plant a non-source file, then deliver every module inside one pass.
 * 2. Remove it and open a second pass.
 * 3. Recreate the same name as a directory, open a third, and assert a compile for
 *    each.
 */
export const test_transformttsc_a_build_pass_recompiles_after_a_membership_removal =
  async () => {
    await assertAPassRecompilesAfterAMembershipRemoval();
  };
