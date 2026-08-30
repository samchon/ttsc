import { assertAPassRecompilesAfterAMembershipRemoval } from "../../internal/transform-delivery-epoch";

/**
 * Verifies a pass recompiles when a source leaves the project or changes kind,
 * and does not when a file the program could never contain leaves.
 *
 * A removal has no recorded hash to differ from and a kind swap keeps the name,
 * so both are invisible to the content comparison and only the membership
 * digest answers for them. That digest answers for program membership, so a
 * stray `.txt` leaving is no more a membership change than editing one is
 * (samchon/ttsc#1307).
 *
 * 1. Plant a non-source file and deliver every module inside one pass.
 * 2. Remove it, open a pass, and assert no compile.
 * 3. Add a source, remove it, then recreate the name as a directory, asserting a
 *    compile for each.
 */
export const test_transformttsc_a_build_pass_recompiles_after_a_membership_removal =
  async () => {
    await assertAPassRecompilesAfterAMembershipRemoval();
  };
