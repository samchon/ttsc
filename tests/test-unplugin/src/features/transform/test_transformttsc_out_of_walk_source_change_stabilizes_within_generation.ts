import { assertOutOfWalkSourceChangeStabilizesWithinGeneration } from "../../internal/transform-project-cache";

/**
 * Verifies an external transformed source changing after its compiler read
 * discards that attempt and shares the stable retry.
 */
export async function test_transformttsc_out_of_walk_source_change_stabilizes_within_generation(): Promise<void> {
  await assertOutOfWalkSourceChangeStabilizesWithinGeneration();
}
