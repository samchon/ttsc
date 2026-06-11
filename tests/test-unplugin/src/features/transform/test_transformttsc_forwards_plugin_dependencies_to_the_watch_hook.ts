import { assertTransformForwardsDependenciesToWatchHook } from "../../internal/transform-dependencies";

/**
 * Verifies transformTtsc forwards the plugin-reported dependency list to the
 * addWatchFile hook.
 *
 * Implements samchon/ttsc#214: bundlers erase type-only imports from their
 * module graph, so editing a type a transform consulted does not invalidate the
 * module and HMR serves stale generated code. The transform envelope's optional
 * `dependencies` field carries the consulted files; the adapter must receive
 * them absolutized against the project root, deduplicated, and without the
 * transformed module itself (the bundler already watches it).
 *
 * 1. Run the fixture plugin's `emit-dependencies` operation reporting a relative
 *    path, an absolute path, a duplicate, and the module itself.
 * 2. Collect addWatchFile invocations through the new hooks parameter.
 * 3. Assert exactly the two distinct foreign paths arrive, both absolute.
 */
export const test_transformttsc_forwards_plugin_dependencies_to_the_watch_hook =
  async () => {
    await assertTransformForwardsDependenciesToWatchHook();
  };
