import { assertProvenOutOfWalkSourceWithoutGraphNodeKeepsGeneration } from "../../internal/transform-project-cache";

/** A compiler-proved source output survives a legacy graph that omits its node. */
export async function test_transformttsc_proven_out_of_walk_source_without_graph_node_keeps_generation(): Promise<void> {
  await assertProvenOutOfWalkSourceWithoutGraphNodeKeepsGeneration();
}
