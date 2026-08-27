import { assertUnprovenOutOfWalkSourceFailsAfterBoundedAttempts } from "../../internal/transform-project-cache";

/**
 * Verifies an unproven out-of-walk source fails after bounded attempts.
 *
 * A graph-free external source has no compiler-time coherence proof. Accepting
 * a post-compile snapshot can serve stale output, while evicting it per sibling
 * recreates the whole-project compile amplification from #1290.
 *
 * 1. Emit two external source outputs without a graph or compiler proofs.
 * 2. Request the project source, then both external siblings through one cache.
 * 3. Assert exactly two compiles and one shared terminal proof failure.
 */
export async function test_transformttsc_unproven_out_of_walk_source_fails_after_bounded_attempts(): Promise<void> {
  await assertUnprovenOutOfWalkSourceFailsAfterBoundedAttempts();
}
