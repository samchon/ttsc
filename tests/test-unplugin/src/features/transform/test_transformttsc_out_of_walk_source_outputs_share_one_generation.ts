import { assertOutOfWalkSourceOutputsShareGeneration } from "../../internal/transform-project-cache";

/**
 * Verifies out-of-walk source outputs share one transform generation.
 *
 * Transformable source keys under an excluded directory cannot enter the
 * complete project-walk hash universe, but their compiler proofs and external
 * snapshots must still let sibling deliveries reuse one coherent result.
 *
 * 1. Emit two transformable source outputs below `node_modules`.
 * 2. Deliver one project source and both external sources through one cache.
 * 3. Assert every output is transformed by the same single compiler run.
 */
export async function test_transformttsc_out_of_walk_source_outputs_share_one_generation(): Promise<void> {
  await assertOutOfWalkSourceOutputsShareGeneration();
}
