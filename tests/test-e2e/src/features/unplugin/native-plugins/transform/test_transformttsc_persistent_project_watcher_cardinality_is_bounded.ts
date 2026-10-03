import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createCacheProject } from "../../../../internal/unplugin/internal/transform-project-cache/createCacheProject";
import { projectModules } from "../../../../internal/unplugin/internal/transform-project-cache/projectModules";

/**
 * Verifies persistent project observers stay constant regardless of the tree's
 * size.
 *
 * A per-directory watcher would exhaust descriptors on a large tree. Project
 * membership and host inputs may own at most one observer each, sharing the one
 * physical project root, and a build-scoped generation may keep none once its
 * bounded compile-race observer closes. A plugin's Go source outside the
 * project is watched as a whole subtree of its own (samchon/ttsc#1487): one
 * observer per plugin source, however large the project.
 *
 * 1. Compile a project with 250 unrelated directories through a persistent cache
 *    that records each opened watch.
 * 2. Assert at most two observers on the project root and one on the plugin's
 *    source, and a cache reset closes them all.
 * 3. Compile through a build-scoped cache and assert one compile-race observer
 *    that is released before delivery.
 *
 * @evidence contracts/testing.md#behavioral-verification Native capture over 250 unrelated directories opens at most two project subtree observers plus one producer observer; reset closes all, and build pass retains none after one race observer.
 * @evidence contracts/testing.md#independent-expectations Injected watch records count actual registrations/closures independently of tracker internals; filesystem realpath compares observer roots.
 * @evidence contracts/testing.md#distinguishing-cases Persistent versus build-scoped lifetime and large irrelevant tree distinguish bounded observers from per-directory growth.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers test_transformttsc_persistent_project_watcher_cardinality_is_bounded in native-plugins/transform in the E2E population. Its local callbacks and helper-driven module matrix execute under this named entry; embedded native operations are fixture inputs, not separately selectable test hosts.
 * @evidence contracts/e2e.md#necessary-boundary The built transform API must hand an actual native fixture envelope to generation capture/validation and then serve the selected modules. The native run log and reported graph/proofs expose that connection; synthetic graph options test envelope transport and admission, not correctness of TypeScript-Go graph construction.
 * @evidence contracts/e2e.md#shared-execution createCacheProject reuses the materialized cache Go fixture and content-addressed build cache unless this case requests isolatedPluginSource; unique consumer and run-log roots keep mutable inputs private. Within each consumer/cache scenario, repeated deliveries reuse that scenario's transform cache; distinct consumers or policies keep separate caches. Changed declared inputs or rejected capture require the counted new invocation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Consumer, source edits, hook counters and transform cache belong to this case; shared producer inputs remain equivalent or their changed content selects a new build key. TestProject owns its managed temporary roots through runner cleanup. The existing finally reset/close path releases retained cache or session observers on success and assertion failure; no prior case supplies this generation.
 * @evidence contracts/e2e.md#preserved-coverage Native capture over 250 unrelated directories opens at most two project subtree observers plus one producer observer; reset closes all, and build pass retains none after one race observer. These assertions remain in test_transformttsc_persistent_project_watcher_cardinality_is_bounded, with their stated fixture/oracle limits; portable decisions are not claimed covered by an unnamed unit or by a synthetic envelope alone.
 */
export async function test_transformttsc_persistent_project_watcher_cardinality_is_bounded(): Promise<void> {
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
    const physical = (directory: string) =>
      fs.realpathSync.native(directory).toLowerCase();
    const source = physical(TestUnpluginProject.pluginSource(project.root));
    const recursive = opened.filter((watcher) => watcher.recursive);
    const projectObservers = recursive.filter(
      (watcher) => physical(watcher.directory) !== source,
    );
    assert.ok(
      projectObservers.length <= 2,
      "project membership and host inputs may own at most one observer each",
    );
    assert.equal(
      new Set(projectObservers.map((watcher) => physical(watcher.directory)))
        .size,
      1,
      "both logical observers must share the one physical project root",
    );
    assert.equal(
      recursive.length - projectObservers.length,
      1,
      "the plugin's source is one subtree observer",
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
