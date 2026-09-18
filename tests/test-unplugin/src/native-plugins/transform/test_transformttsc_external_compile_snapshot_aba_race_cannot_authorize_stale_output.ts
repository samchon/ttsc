import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createCacheProject } from "../../internal/transform-project-cache/createCacheProject";

/**
 * Verifies an external graph input changed and restored during a compile cannot
 * authorize the transient output.
 *
 * This is the out-of-walk twin of the project-input A-B-A race. An external
 * declaration rewritten and restored during the compile leaves identical
 * snapshots before and after, yet the output may have read the transient bytes,
 * so the attempt must be discarded before the generation resolves.
 *
 * 1. Open a pass over a project whose external declaration is rewritten and
 *    restored during the first compile.
 * 2. Deliver the entry and assert it never receives the discarded attempt.
 * 3. Deliver the sibling and assert the stable generation came from a second
 *    compile.
 */
export async function test_transformttsc_external_compile_snapshot_aba_race_cannot_authorize_stale_output(): Promise<void> {
  const {
    beginTtscTransformBuild,
    createTtscTransformCache,
    resolveOptions,
    transformTtsc,
  } = await TestUnpluginRuntime.loadUnpluginApi();
  const project = createCacheProject({
    externalSnapshotAbaRace: true,
    fileCount: 2,
    graphFanout: 1,
  });
  const cache = createTtscTransformCache();
  beginTtscTransformBuild(cache);
  const options = resolveOptions();
  const main = path.join(project.root, "src", "mod0.ts");
  const lazy = path.join(project.root, "src", "mod1.ts");

  const first = await transformTtsc(
    main,
    fs.readFileSync(main, "utf8"),
    options,
    undefined,
    cache,
  );
  assert.ok(first);
  assert.doesNotMatch(
    first.code,
    /EXTERNAL-DURING/,
    "the first delivery must never receive the discarded ABA attempt",
  );
  const stableGeneration = [...cache.values()][0];

  const second = await transformTtsc(
    lazy,
    fs.readFileSync(lazy, "utf8"),
    options,
    undefined,
    cache,
  );
  assert.ok(second);
  assert.doesNotMatch(second.code, /EXTERNAL-DURING/);
  assert.equal(
    [...cache.values()][0],
    stableGeneration,
    "external ABA output must be discarded before the generation resolves",
  );
  assert.equal(fs.readFileSync(project.runLog, "utf8").length, 2);
}
