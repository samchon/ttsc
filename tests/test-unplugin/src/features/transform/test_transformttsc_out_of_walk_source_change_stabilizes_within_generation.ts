import { assertOutOfWalkSourceChangeStabilizesWithinGeneration } from "../../internal/transform-project-cache";

/**
 * Verifies an out-of-walk source change stabilizes within one generation.
 *
 * An external transformed source is absent from the project walk, so only its
 * compiler-time proof can prevent post-compile bytes from blessing stale output
 * produced from the earlier content.
 *
 * 1. Change an external source immediately after the first compiler read.
 * 2. Let the shared generation retry against the settled source.
 * 3. Assert the first output is discarded and exactly two compiles run.
 */
export async function test_transformttsc_out_of_walk_source_change_stabilizes_within_generation(): Promise<void> {
  await assertOutOfWalkSourceChangeStabilizesWithinGeneration();
}
