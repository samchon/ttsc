import { assertUnprovenRealizedInputRefusesReuse } from "../../internal/transform-project-cache";

/**
 * Verifies a realized graph member without a compiler proof refuses reuse.
 *
 * Pins the boundary of the candidate relaxation: an edge target is a file the
 * compile read, so a missing proof leaves the generation unable to show it
 * describes one coherent state, and replaying it could serve output computed
 * from bytes that changed mid-compile.
 *
 * 1. Build a four-file project whose envelope drops one edge target's proof.
 * 2. Transform every module through one persistent cache.
 * 3. Assert the project recompiled for every module.
 */
export const test_transformttsc_refuses_reuse_for_an_unproven_realized_graph_input =
  async () => {
    await assertUnprovenRealizedInputRefusesReuse();
  };
