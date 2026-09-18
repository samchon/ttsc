import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createCacheProject } from "../../internal/transform-project-cache/createCacheProject";

/**
 * Verifies concurrent transforms of one module compile the project once.
 *
 * Eviction on failure must not weaken the single-flight guarantee: two callers
 * racing for the same key share the one in-flight generation stored in the
 * cache.
 *
 * 1. Create a single-module project that counts its compiles.
 * 2. Transform the module twice concurrently through one cache.
 * 3. Assert both succeed and the project compiled once.
 */
export async function test_transformttsc_shares_one_compile_across_concurrent_callers(): Promise<void> {
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const project = createCacheProject({ fileCount: 1 });
  const cache = createTtscTransformCache();
  const file = path.join(project.root, "src", "mod0.ts");
  const source = fs.readFileSync(file, "utf8");
  const options = resolveOptions();

  const [first, second] = await Promise.all([
    transformTtsc(file, source, options, undefined, cache),
    transformTtsc(file, source, options, undefined, cache),
  ]);
  assert.ok(first);
  assert.ok(second);
  assert.match(first.code, /PROBED/);
  assert.match(second.code, /PROBED/);

  const pluginRuns = fs.existsSync(project.runLog)
    ? fs.readFileSync(project.runLog, "utf8").length
    : 0;
  assert.equal(pluginRuns, 1, "concurrent callers must share one compile");
}
