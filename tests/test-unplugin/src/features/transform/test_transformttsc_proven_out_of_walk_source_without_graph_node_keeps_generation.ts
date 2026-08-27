import { assertProvenOutOfWalkSourceWithoutGraphNodeKeepsGeneration } from "../../internal/transform-project-cache";

/**
 * Verifies a proved out-of-walk source survives an omitted graph node.
 *
 * A legacy or malformed graph can omit a transform-output leaf even while the
 * envelope carries its compiler proof. Output identity, not graph membership,
 * must preserve that proof and avoid a false terminal failure.
 *
 * 1. Emit an external source output and its compiler proof without a graph node.
 * 2. Deliver the project source and external source through one cache.
 * 3. Assert both reuse the same single compiler generation.
 */
export async function test_transformttsc_proven_out_of_walk_source_without_graph_node_keeps_generation(): Promise<void> {
  await assertProvenOutOfWalkSourceWithoutGraphNodeKeepsGeneration();
}
