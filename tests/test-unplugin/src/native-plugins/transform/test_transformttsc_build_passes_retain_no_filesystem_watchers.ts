import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";

import { createCacheProject } from "../../internal/transform-project-cache/createCacheProject";
import { projectModules } from "../../internal/transform-project-cache/projectModules";

/**
 * Verifies build-scoped caches retain no native filesystem watchers between
 * deliveries.
 *
 * A pass revalidates at its own boundary, so a watcher kept past the compile
 * would cost descriptors for nothing and outlive the build. Each compile still
 * needs one bounded watcher as its A-B-A witness, which has to close before
 * delivery.
 *
 * 1. Run a pass that delivers every module through a cache that counts opened and
 *    closed watchers.
 * 2. Edit a module and run a second pass over every module.
 * 3. Assert two witnesses were opened and all closed, the edit recompiled, and
 *    teardown leaves no watcher open.
 */
export async function test_transformttsc_build_passes_retain_no_filesystem_watchers(): Promise<void> {
  const api = await TestUnpluginRuntime.loadUnpluginApi();
  const project = createCacheProject({ fileCount: 4, graphFanout: 1 });
  let opened = 0;
  let closed = 0;
  const cache = api.createTtscTransformCache({
    watch: () => {
      opened += 1;
      return { close: () => (closed += 1) };
    },
  });
  const options = api.resolveOptions();
  const modules = projectModules(project.root);
  const deliver = (file: string) =>
    api.transformTtsc(
      file,
      fs.readFileSync(file, "utf8"),
      options,
      undefined,
      cache,
      { addWatchFile: () => undefined },
    );
  try {
    api.beginTtscTransformBuild(cache);
    for (const file of modules) assert.ok(await deliver(file));
    api.beginTtscTransformBuild(cache);
    fs.appendFileSync(modules[0]!, "\nexport const changed = 1;\n", "utf8");
    for (const file of modules) assert.ok(await deliver(file));
    assert.equal(
      opened,
      2,
      "each native compile must open one bounded A-B-A witness",
    );
    assert.equal(
      closed,
      opened,
      "a build-scoped generation must close its witness before delivery",
    );
    assert.equal(
      fs.readFileSync(project.runLog, "utf8").length,
      2,
      "the watcher-free pass must still recompile after an input edit",
    );
  } finally {
    api.resetTtscTransformCache(cache);
  }
  assert.equal(closed, opened, "teardown must retain no build-scoped watcher");
}
