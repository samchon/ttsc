import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createCacheProject } from "../../internal/transform-project-cache/createCacheProject";
import { externalSourceModules } from "../../internal/transform-project-cache/externalSourceModules";

/** A raced out-of-walk source must stabilize before any output is delivered. */
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
