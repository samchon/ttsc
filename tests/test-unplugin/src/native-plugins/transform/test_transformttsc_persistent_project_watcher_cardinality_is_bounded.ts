import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createCacheProject } from "../../internal/transform-project-cache/createCacheProject";
import { projectModules } from "../../internal/transform-project-cache/projectModules";

/** Prove persistent project observers stay constant at any tree size. */
export async function test_transformttsc_persistent_project_watcher_cardinality_is_bounded(): Promise<void> {
  // Share one Go fixture build per process; transformTtsc shells out to it.
  TestUnpluginProject.ensureSharedCacheDir();
  const {
    beginTtscTransformBuild,
    createTtscTransformCache,
    resetTtscTransformCache,
    resolveOptions,
    transformTtsc,
  } = await TestUnpluginRuntime.loadUnpluginApi();
  const project = createCacheProject({
    fileCount: 1,
    graphFanout: 1,
    unrelatedDirectoryCount: 250,
  });
  const opened: { directory: string; recursive: boolean }[] = [];
  let active = 0;
  const cache = createTtscTransformCache({
    watch: (
      directory: string,
      _listener: unknown,
      _onError: unknown,
      recursive = false,
    ) => {
      opened.push({ directory: path.resolve(directory), recursive });
      active += 1;
      return { close: () => (active -= 1) };
    },
  });
  const main = projectModules(project.root)[0]!;
  try {
    assert.ok(
      await transformTtsc(
        main,
        fs.readFileSync(main, "utf8"),
        resolveOptions(),
        undefined,
        cache,
      ),
    );
    const recursive = opened.filter((watcher) => watcher.recursive);
    assert.ok(
      recursive.length <= 2,
      "project membership and host inputs may own at most one observer each",
    );
    assert.equal(
      new Set(
        recursive.map((watcher) =>
          fs.realpathSync.native(watcher.directory).toLowerCase(),
        ),
      ).size,
      1,
      "both logical observers must share the one physical project root",
    );
  } finally {
    resetTtscTransformCache(cache);
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
  assert.equal(active, 0, "cache reset must close every logical observer");
  const persistentOpenCount = opened.length;
  beginTtscTransformBuild(cache);
  try {
    assert.ok(
      await transformTtsc(
        main,
        fs.readFileSync(main, "utf8"),
        resolveOptions(),
        undefined,
        cache,
      ),
    );
    const buildObservers = opened
      .slice(persistentOpenCount)
      .filter((watcher) => watcher.recursive);
    assert.equal(
      buildObservers.length,
      1,
      "a build attempt needs one bounded compile-race observer",
    );
    assert.equal(
      active,
      0,
      "a build-scoped generation must retain no background observer",
    );
  } finally {
    resetTtscTransformCache(cache);
  }
}
