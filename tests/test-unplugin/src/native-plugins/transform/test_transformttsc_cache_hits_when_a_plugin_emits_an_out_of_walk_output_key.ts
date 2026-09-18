import { TestUnpluginProject } from "@ttsc/testing";
import assert from "node:assert/strict";

import { runProjectBuild } from "../../internal/transform-project-cache/runProjectBuild";

/**
 * Verifies samchon/ttsc#252: the cache still hits when the transform output
 * includes an entry keyed outside the project's directory walk.
 *
 * The stored hash snapshot and the per-module validation snapshot must draw
 * their keys from the same project walk. The regression overlaid the compiler's
 * output keys — which include `node_modules` declarations the validator never
 * re-hashes — on only the store side, so the snapshots never matched, the cache
 * missed on every module, and the whole project was re-transformed once per
 * file. Any real project importing a typed dependency triggers this.
 *
 * 1. Build a multi-file project whose fixture transform emits one
 *    `node_modules/**` output key.
 * 2. Run a transform over every module sharing one persistent cache.
 * 3. Assert the plugin ran exactly once (cache hit), not once per module.
 */
export async function test_transformttsc_cache_hits_when_a_plugin_emits_an_out_of_walk_output_key(): Promise<void> {
  // Share one Go fixture build per process; transformTtsc shells out to it.
  TestUnpluginProject.ensureSharedCacheDir();
  const { pluginRuns, outputs } = await runProjectBuild({
    emitExternalKey: true,
    fileCount: 6,
  });
  assert.equal(pluginRuns, 1);
  assert.equal(outputs.length, 6);
  for (const code of outputs) {
    assert.match(code, /PROBED/);
  }
}
