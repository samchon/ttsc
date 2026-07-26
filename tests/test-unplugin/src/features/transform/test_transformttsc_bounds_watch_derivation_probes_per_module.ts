import { assertSiblingDeliveriesDoNotReprobeGraph } from "../../internal/transform-project-cache";

/**
 * Verifies cached sibling deliveries derive watch inputs without re-probing the
 * filesystem per module.
 *
 * Pins samchon/ttsc#1007: a graph-bearing envelope (typia >= 13.1.19) made
 * every cache-hit delivery re-walk the whole reference graph with real
 * filesystem identity probes, scaling O(modules x edges) into the #970 residual
 * build stall. The shared resolver's physical-path probe makes that work
 * observable on every CI host without changing the process platform.
 *
 * 1. Compile a six-module project whose envelope carries a ~150-edge graph.
 * 2. Deliver every sibling from the cache under a probe counter.
 * 3. Assert identical watch lists and a bounded probe count per delivery.
 */
export const test_transformttsc_bounds_watch_derivation_probes_per_module =
  async () => {
    await assertSiblingDeliveriesDoNotReprobeGraph();
  };
