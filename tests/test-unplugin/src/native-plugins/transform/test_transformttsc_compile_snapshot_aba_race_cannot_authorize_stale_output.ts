import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createCacheProject } from "../../internal/transform-project-cache/createCacheProject";

/**
 * Verifies a graph-free build-scoped project input changed and restored during
 * native compilation cannot pair transient output with identical snapshots.
 */
export async function test_transformttsc_compile_snapshot_aba_race_cannot_authorize_stale_output(): Promise<void> {
  // Share one Go fixture build per process; transformTtsc shells out to it.
  TestUnpluginProject.ensureSharedCacheDir();
  const {
    beginTtscTransformBuild,
    createTtscTransformCache,
    resolveOptions,
    transformTtsc,
  } = await TestUnpluginRuntime.loadUnpluginApi();
  const project = createCacheProject({
    fileCount: 2,
    graphFanout: 0,
    snapshotAbaRace: true,
  });
  const cache = createTtscTransformCache();
  beginTtscTransformBuild(cache);
  const options = resolveOptions();
  const main = path.join(project.root, "src", "mod0.ts");
  const lazy = path.join(project.root, "src", "mod1.ts");

  assert.ok(
    await transformTtsc(
      main,
      fs.readFileSync(main, "utf8"),
      options,
      undefined,
      cache,
    ),
  );
  const stableGeneration = [...cache.values()][0];
  assert.equal(
    fs.readFileSync(lazy, "utf8"),
    'export const value1: string = "PROBE";\n',
  );

  const result = await transformTtsc(
    lazy,
    fs.readFileSync(lazy, "utf8"),
    options,
    undefined,
    cache,
  );
  assert.ok(result);
  assert.doesNotMatch(result.code, /DURING/);
  assert.equal(
    [...cache.values()][0],
    stableGeneration,
    "an ABA mutation must be discarded before the generation resolves",
  );
  assert.equal(fs.readFileSync(project.runLog, "utf8").length, 2);
}
