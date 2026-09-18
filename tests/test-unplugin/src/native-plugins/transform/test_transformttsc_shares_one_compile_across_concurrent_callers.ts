import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createCacheProject } from "../../internal/transform-project-cache/createCacheProject";

/**
 * Verifies concurrent transforms of one module still compile the project once.
 *
 * The eviction fix must not weaken the single-flight guarantee: two callers
 * racing for the same key share the one in-flight generation stored in the
 * cache. The run-log fixture counts whole-project compiles, so two concurrent
 * `transformTtsc` calls must produce exactly one.
 */
export async function test_transformttsc_shares_one_compile_across_concurrent_callers(): Promise<void> {
  // Share one Go fixture build per process; transformTtsc shells out to it.
  TestUnpluginProject.ensureSharedCacheDir();
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
