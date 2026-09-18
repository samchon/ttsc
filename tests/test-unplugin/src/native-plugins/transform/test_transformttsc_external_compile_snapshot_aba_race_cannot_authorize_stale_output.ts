import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createCacheProject } from "../../internal/transform-project-cache/createCacheProject";

/** External graph input A-B-A churn obeys the same generation invariant. */
export async function test_transformttsc_external_compile_snapshot_aba_race_cannot_authorize_stale_output(): Promise<void> {
  // Share one Go fixture build per process; transformTtsc shells out to it.
  TestUnpluginProject.ensureSharedCacheDir();
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
