import { assertOutOfWalkSourceOutputsShareGeneration } from "../../internal/transform-project-cache";

/**
 * Verifies transformable source outputs outside the project walk use their
 * external snapshot when they validate a shared generation.
 */
export async function test_transformttsc_out_of_walk_source_outputs_share_one_generation(): Promise<void> {
  await assertOutOfWalkSourceOutputsShareGeneration();
}
