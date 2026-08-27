import { assertAliasedProofFailureConflictsWithProof } from "../../internal/transform-project-cache";

/**
 * Verifies an aliased proof failure conflicts with a proof for the same input.
 *
 * A producer can name one physical file through two lexical spellings. A valid
 * proof under one spelling must not hide the authoritative failure reported
 * under the other and authorize a stale generation.
 *
 * 1. Report a valid proof and a proof failure through two filesystem aliases.
 * 2. Let the shared generation spend its one stabilization retry.
 * 3. Assert one path-specific terminal conflict after exactly two compiles.
 */
export async function test_transformttsc_aliased_proof_failure_conflicts_with_proof(): Promise<void> {
  await assertAliasedProofFailureConflictsWithProof();
}
