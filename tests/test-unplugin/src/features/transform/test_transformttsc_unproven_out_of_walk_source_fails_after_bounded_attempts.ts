import { assertUnprovenOutOfWalkSourceFailsAfterBoundedAttempts } from "../../internal/transform-project-cache";

/**
 * Verifies a graph-free external transformed source rejects one bounded shared
 * generation instead of accepting a post-compile snapshot or recompiling per
 * sibling.
 */
export async function test_transformttsc_unproven_out_of_walk_source_fails_after_bounded_attempts(): Promise<void> {
  await assertUnprovenOutOfWalkSourceFailsAfterBoundedAttempts();
}
