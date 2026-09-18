import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createCacheProject } from "../../internal/transform-project-cache/createCacheProject";
import { externalSourceModules } from "../../internal/transform-project-cache/externalSourceModules";

/**
 * Verifies transformable outputs outside the walk share the project's one
 * generation.
 *
 * A whole-project transform can emit sources that live outside the walk, under
 * `node_modules` here. Delivering one of them must be served from the same
 * generation instead of treated as a separate project.
 *
 * 1. Create a project that emits two transformable outputs under `node_modules`.
 * 2. Deliver the entry and both external sources.
 * 3. Assert each is transformed and the project compiled once.
 */
export async function test_transformttsc_out_of_walk_source_outputs_share_one_generation(): Promise<void> {
  // Share one Go fixture build per process; transformTtsc shells out to it.
  TestUnpluginProject.ensureSharedCacheDir();
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const project = createCacheProject({
    externalSourceOutputs: 2,
    fileCount: 2,
    graphFanout: 1,
  });
  const cache = createTtscTransformCache();
  const options = resolveOptions({
    project: path.join(project.root, "tsconfig.json"),
  });
  const modules = [
    path.join(project.root, "src", "mod0.ts"),
    ...externalSourceModules(project.root, 2),
  ];
  for (const file of modules) {
    const result = await transformTtsc(
      file,
      fs.readFileSync(file, "utf8"),
      options,
      undefined,
      cache,
    );
    assert.ok(result, `expected transformed output for ${file}`);
    assert.match(result.code, /PROBED/);
  }
  assert.equal(
    fs.readFileSync(project.runLog, "utf8").length,
    1,
    "out-of-walk source siblings must reuse the project generation",
  );
}
