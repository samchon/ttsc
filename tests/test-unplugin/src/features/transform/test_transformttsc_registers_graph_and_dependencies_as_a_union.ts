import { assertGraphAndDependenciesRegisterAsUnion } from "../../internal/transform-graph";

/**
 * Verifies transformTtsc unions the host-owned graph inputs with the
 * plugin-reported dependency list.
 *
 * Pins the union semantics samchon/ttsc#716 declares for the two channels: a
 * plugin's self-reported `dependencies` can only widen the host-owned
 * language-semantic bound, never narrow it, and an input reported through both
 * channels must register exactly once.
 *
 * 1. Run one fixture entry emitting `dependencies` and another emitting a `graph`
 *    whose edge targets overlap the dependency list.
 * 2. Collect addWatchFile invocations.
 * 3. Assert the deduplicated union of both channels arrives.
 */
export const test_transformttsc_registers_graph_and_dependencies_as_a_union =
  async () => {
    await assertGraphAndDependenciesRegisterAsUnion();
  };
