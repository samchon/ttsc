import { assertAPassRecompilesAfterAMembershipChange } from "../../internal/transform-delivery-epoch/assertAPassRecompilesAfterAMembershipChange";

/**
 * Verifies a pass recompiles when project membership changes.
 *
 * A created file is the one change a content comparison cannot see, because it
 * has no recorded entry to differ from. The directory-membership half of the
 * generation's snapshot is what answers for it, and the pass gate has to
 * consult that half rather than the input hashes alone.
 */
export async function test_transformttsc_a_build_pass_recompiles_after_a_membership_change(): Promise<void> {
  await assertAPassRecompilesAfterAMembershipChange();
}
