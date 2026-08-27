import { assertAliasedProofFailureConflictsWithProof } from "../../internal/transform-project-cache";

/**
 * A proof and a producer failure for one aliased identity cannot authorize
 * reuse.
 */
export async function test_transformttsc_aliased_proof_failure_conflicts_with_proof(): Promise<void> {
  await assertAliasedProofFailureConflictsWithProof();
}
