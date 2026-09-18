import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createCacheProject } from "../../internal/transform-project-cache/createCacheProject";

/**
 * Verifies an A-B-A race on an independent graph leaf is discarded like any
 * other project input.
 *
 * A leaf with no graph edges is still a compiler input, so the proof that
 * discards a transiently changed and restored input must cover it too. Without
 * that, a leaf nothing else depends on would be the one place transient output
 * could settle.
 *
 * 1. Create a project whose independent leaf is rewritten and restored during the
 *    first compile.
 * 2. Deliver the entry, then the leaf.
 * 3. Assert the output carries no transient text, and the stable generation came
 *    from a second compile.
 */
export async function test_transformttsc_independent_graph_leaf_compile_snapshot_aba_race_cannot_authorize_stale_output(): Promise<void> {
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const project = createCacheProject({
    fileCount: 2,
    graphFanout: 1,
    independentGraphLeaf: "src/mod1.ts",
    snapshotAbaRace: true,
  });
  const cache = createTtscTransformCache();
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
    "an independent leaf race must stabilize before the first delivery",
  );
  assert.equal(fs.readFileSync(project.runLog, "utf8").length, 2);
}
