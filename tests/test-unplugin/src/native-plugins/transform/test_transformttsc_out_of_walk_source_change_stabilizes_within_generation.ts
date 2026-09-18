import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createCacheProject } from "../../internal/transform-project-cache/createCacheProject";
import { externalSourceModules } from "../../internal/transform-project-cache/externalSourceModules";

/**
 * Verifies an out-of-walk source that changes after the compiler read it is
 * discarded before any output is delivered.
 *
 * An out-of-walk source is proven through its own snapshot, not the walk. A
 * change after the compiler read it means the output may not match the recorded
 * bytes, so the raced attempt must be discarded and every delivery must share
 * its stable retry.
 *
 * 1. Create a project whose first external source changes after its compiler read
 *    on the first attempt.
 * 2. Deliver the entry.
 * 3. Assert the raced attempt was discarded and its stable retry is the shared
 *    generation.
 */
export async function test_transformttsc_out_of_walk_source_change_stabilizes_within_generation(): Promise<void> {
  // Share one Go fixture build per process; transformTtsc shells out to it.
  TestUnpluginProject.ensureSharedCacheDir();
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const project = createCacheProject({
    externalSourceChangesAfterRead: true,
    externalSourceOutputs: 1,
    fileCount: 2,
    graphFanout: 1,
  });
  const cache = createTtscTransformCache();
  const options = resolveOptions({
    project: path.join(project.root, "tsconfig.json"),
  });
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
  const external = externalSourceModules(project.root, 1)[0]!;
  const result = await transformTtsc(
    external,
    fs.readFileSync(external, "utf8"),
    options,
    undefined,
    cache,
  );
  assert.ok(result);
  assert.match(result.code, /PROBED-AFTER/);
  assert.equal(
    fs.readFileSync(project.runLog, "utf8").length,
    2,
    "the raced attempt must be discarded and its stable retry shared",
  );
}
