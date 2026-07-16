import { assertTransformRegistersGraphReachGlobalsAndConfigs } from "../../internal/transform-graph";

/**
 * Verifies transformTtsc registers the host-owned reference graph's derived
 * watch inputs: reach(edges, F) ∪ globals ∪ configs.
 *
 * Implements samchon/ttsc#716: bundlers erase type-only imports from their
 * module graphs, so a persistent cache or watch graph invalidates a module only
 * when its registered inputs change. The transform envelope's `graph` section
 * carries direct edges (the minimal sufficient statistic); the adapter must
 * flatten them into the per-file closure the bundler's flat `fileDependencies`
 * snapshot needs, add every global-scope file and config, absolutize against
 * the project root, deduplicate, and drop the module itself even through a
 * cycle.
 *
 * 1. Run the fixture plugin's `emit-graph` operation with a two-hop edge chain, a
 *    cycle back to the module, an unreachable edge, a globals list naming the
 *    module, and a config entry.
 * 2. Collect addWatchFile invocations through the hooks parameter.
 * 3. Assert exactly the closure, the foreign global, and the config arrive.
 */
export const test_transformttsc_registers_graph_reach_globals_and_configs_as_watch_files =
  async () => {
    await assertTransformRegistersGraphReachGlobalsAndConfigs();
  };
