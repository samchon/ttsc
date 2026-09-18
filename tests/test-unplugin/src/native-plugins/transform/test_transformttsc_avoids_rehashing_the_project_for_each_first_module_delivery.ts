import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createCacheProject } from "../../internal/transform-project-cache/createCacheProject";
import { projectModules } from "../../internal/transform-project-cache/projectModules";

/**
 * Verifies the first delivery of each module does not re-read the entire
 * project.
 *
 * A project transform already returns output and an input snapshot for every
 * module. Re-hashing all P project files before selecting each of N outputs
 * makes the first build O(N x P), even though no generation has crossed a build
 * boundary. The cache can compare each supplied module source with its snapshot
 * entry and reserve complete validation for a repeated module request.
 */
export async function test_transformttsc_avoids_rehashing_the_project_for_each_first_module_delivery(): Promise<void> {
  // Share one Go fixture build per process; transformTtsc shells out to it.
  TestUnpluginProject.ensureSharedCacheDir();
  const {
    beginTtscTransformBuild,
    createTtscTransformCache,
    resolveOptions,
    transformTtsc,
  } = await TestUnpluginRuntime.loadUnpluginApi();
  const project = createCacheProject({ fileCount: 24 });
  const modules = projectModules(project.root);
  const sources = new Map(
    modules.map((file) => [file, fs.readFileSync(file, "utf8")]),
  );
  const cache = createTtscTransformCache();
  beginTtscTransformBuild(cache);
  const options = resolveOptions();

  const first = modules[0]!;
  assert.ok(
    await transformTtsc(first, sources.get(first)!, options, undefined, cache),
  );

  fs.appendFileSync(
    path.join(project.root, "plugin.cjs"),
    "\n// changed after the build-scoped generation started\n",
    "utf8",
  );
  for (const file of modules.slice(1)) {
    assert.ok(
      await transformTtsc(file, sources.get(file)!, options, undefined, cache),
    );
  }

  assert.equal(fs.readFileSync(project.runLog, "utf8").length, 1);
}
