import { TestUnpluginProject } from "@ttsc/testing";
import assert from "node:assert/strict";

import { runProjectBuild } from "../../internal/transform-project-cache/runProjectBuild";

/**
 * Verifies the shared project cache compiles a multi-file project once and
 * serves every other module from cache — the happy-path baseline.
 *
 * Every compiler output key sits inside the project walk, so this holds on both
 * the old and fixed code; the out-of-walk regression is pinned separately by
 * {@link assertCacheHitsDespiteOutOfWalkOutputKey}. A single `transformTtsc`
 * over N modules sharing one cache must spawn the native transform once; the
 * remaining modules read their output from the cached whole-project result.
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
