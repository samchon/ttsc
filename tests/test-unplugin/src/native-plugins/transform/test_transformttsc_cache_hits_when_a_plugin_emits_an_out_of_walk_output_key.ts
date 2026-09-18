import { TestUnpluginProject } from "@ttsc/testing";
import assert from "node:assert/strict";

import { runProjectBuild } from "../../internal/transform-project-cache/runProjectBuild";

/**
 * Verifies the cache still hits when the transform output includes an entry
 * keyed outside the project walk (samchon/ttsc#252).
 *
 * The stored snapshot and the per-module validation snapshot must draw their
 * keys from the same project walk. The regression overlaid the compiler's
 * output keys, including `node_modules` declarations the validator never
 * re-hashes, on the store side only, so the snapshots never matched and the
 * whole project was re-transformed once per file. Any real project importing a
 * typed dependency triggers this.
 *
 * 1. Build a six-file project whose fixture emits one output key under
 *    `node_modules`.
 * 2. Transform every module through one persistent cache.
 * 3. Assert the plugin ran once and every output is transformed.
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
