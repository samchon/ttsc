import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createCacheProject } from "../../internal/transform-project-cache/createCacheProject";

/**
 * Verifies one project-walk failure during capture is recovered inside the same
 * shared generation.
 *
 * A directory that fails to list while the generation is captured leaves an
 * incomplete snapshot, which may never authorize reuse. One transient failure
 * should cost exactly one retry, and only the retry's complete generation may
 * settle in the cache.
 *
 * 1. Fail one directory listing once, after the compile has started.
 * 2. Deliver a module and assert the walk exercised the failure.
 * 3. Assert exactly one retry ran and the cached generation is the complete one.
 */
export async function test_transformttsc_incomplete_project_snapshot_retries_within_generation(): Promise<void> {
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const project = createCacheProject({ fileCount: 2, graphFanout: 2 });
  const transientDirectory = path.join(project.root, "src", "transient");
  fs.mkdirSync(transientDirectory, { recursive: true });
  fs.writeFileSync(
    path.join(transientDirectory, "hidden.ts"),
    "declare const hiddenDuringSnapshot: string;\n",
    "utf8",
  );
  let failed = false;
  const cache = createTtscTransformCache({
    readdir: (location: string) => {
      if (
        path.resolve(location) === transientDirectory &&
        !failed &&
        fs.existsSync(project.runLog)
      ) {
        failed = true;
        throw new Error("transient project snapshot failure");
      }
      return fs.readdirSync(location, { withFileTypes: true });
    },
  });
  const options = resolveOptions();
  const main = path.join(project.root, "src", "mod0.ts");

  assert.ok(
    await transformTtsc(
      main,
      fs.readFileSync(main, "utf8"),
      options,
      undefined,
      cache,
    ),
  );
  assert.equal(failed, true, "the generation walk must exercise the failure");
  const stableGeneration = [...cache.values()][0];
  assert.equal(
    (await stableGeneration)?.projectSnapshotComplete,
    true,
    "only the retry's complete generation may settle in the cache",
  );
  assert.equal(
    fs.readFileSync(project.runLog, "utf8").length,
    2,
    "one transient walk failure must cost exactly one retry",
  );
  assert.ok(
    await transformTtsc(
      main,
      fs.readFileSync(main, "utf8"),
      options,
      undefined,
      cache,
    ),
  );
  assert.equal([...cache.values()][0], stableGeneration);
  assert.equal(fs.readFileSync(project.runLog, "utf8").length, 2);
}
