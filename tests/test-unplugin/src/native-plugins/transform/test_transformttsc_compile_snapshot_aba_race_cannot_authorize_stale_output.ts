import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createCacheProject } from "../../internal/transform-project-cache/createCacheProject";

/**
 * Verifies a graph-free input changed and restored during a build-scoped
 * compile cannot authorize the transient output.
 *
 * The snapshot taken before the compile and the one after it are byte-identical
 * when an input is changed and then restored during the compile, yet the output
 * may have read the transient bytes. Only the mutation witness opened before
 * the compile can tell, and the generation must be discarded before it
 * resolves.
 *
 * 1. Open a pass over a graph-free project that rewrites and restores `mod1.ts`
 *    during its first compile.
 * 2. Deliver the entry, then the restored module.
 * 3. Assert the output carries no transient text, and the stable generation came
 *    from a second compile.
 */
export async function test_transformttsc_compile_snapshot_aba_race_cannot_authorize_stale_output(): Promise<void> {
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
