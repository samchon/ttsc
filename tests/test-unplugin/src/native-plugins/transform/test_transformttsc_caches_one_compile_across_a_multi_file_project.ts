import { TestUnpluginProject } from "@ttsc/testing";
import assert from "node:assert/strict";

import { runProjectBuild } from "../../internal/transform-project-cache/runProjectBuild";

/**
 * Verifies the shared project cache compiles a multi-file project once and
 * serves every other module from it.
 *
 * This is the happy-path baseline: a single persistent cache over N modules
 * must spawn the native transform once and serve the rest from the
 * whole-project result. Every output key sits inside the project walk here, and
 * the out-of-walk regression is pinned separately by
 * `test_transformttsc_cache_hits_when_a_plugin_emits_an_out_of_walk_output_key`.
 *
 * 1. Build a six-file project through one shared cache.
 * 2. Assert the plugin ran once.
 * 3. Assert all six outputs are transformed.
 */
export async function test_transformttsc_caches_one_compile_across_a_multi_file_project(): Promise<void> {
  // Share one Go fixture build per process; transformTtsc shells out to it.
  TestUnpluginProject.ensureSharedCacheDir();
  const { pluginRuns, outputs } = await runProjectBuild({ fileCount: 6 });
  assert.equal(pluginRuns, 1);
  assert.equal(outputs.length, 6);
  for (const code of outputs) {
    assert.match(code, /PROBED/);
  }
}
