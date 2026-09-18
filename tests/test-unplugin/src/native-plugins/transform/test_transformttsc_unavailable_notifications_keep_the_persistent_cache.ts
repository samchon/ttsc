import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createCacheProject } from "../../internal/transform-project-cache/createCacheProject";
import { projectModules } from "../../internal/transform-project-cache/projectModules";

/**
 * Verifies a generation whose watchers cannot be registered is still validated
 * from its snapshot.
 *
 * Folding watcher health into the generation's completeness flag left an entry
 * neither validation path would accept, so every delivery evicted it and
 * recompiled, the state an inotify-exhausted or network-filesystem dev server
 * lands in. Losing notifications must cost the narrow path, not the cache, and
 * the recorded snapshot must keep proving every class of change on its own.
 *
 * 1. Compile through a cache whose watch registrations are refused, and assert the
 *    generation is kept without a watcher.
 * 2. Edit a source, add an input, edit an out-of-walk graph member, and remove an
 *    input, and assert each recompiles.
 * 3. Assert a steady project stops recompiling once its snapshot matches again.
 */
export async function test_transformttsc_unavailable_notifications_keep_the_persistent_cache(): Promise<void> {
  // Share one Go fixture build per process; transformTtsc shells out to it.
  TestUnpluginProject.ensureSharedCacheDir();
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const project = createCacheProject({ fileCount: 6, graphFanout: 6 });
  const modules = projectModules(project.root);
  const cache = createTtscTransformCache({
    watch: () => {
      const error = new Error(
        "watch registration refused",
      ) as NodeJS.ErrnoException;
      error.code = "ENOSPC";
      throw error;
    },
  });
  const options = resolveOptions();
  const deliver = (file: string) =>
    transformTtsc(
      file,
      fs.readFileSync(file, "utf8"),
      options,
      undefined,
      cache,
    );
  const pluginRuns = (): number =>
    fs.existsSync(project.runLog)
      ? fs.readFileSync(project.runLog, "utf8").length
      : 0;

  for (const file of modules) {
    const result = await deliver(file);
    assert.ok(result);
    assert.match(result.code, /PROBED/);
  }
  assert.equal(
    pluginRuns(),
    1,
    "a generation with no notifications must still be validated from its snapshot",
  );
  const generation = [...cache.values()][0];
  assert.equal(
    (await generation!).projectMutationTracker,
    undefined,
    "an unusable watcher must not be attached to the generation",
  );

  // Every change class must still invalidate without a single notification.
  fs.writeFileSync(
    path.join(project.root, "src", "mod4.ts"),
    'export const value4: string = "PROBE-EDITED";\n',
    "utf8",
  );
  assert.ok(await deliver(modules[0]!));
  assert.equal(pluginRuns(), 2, "an edited project source must recompile");

  fs.writeFileSync(
    path.join(project.root, "src", "added.d.ts"),
    "declare const added: string;\n",
    "utf8",
  );
  assert.ok(await deliver(modules[0]!));
  assert.equal(pluginRuns(), 3, "a new project input must recompile");

  fs.writeFileSync(
    path.join(project.root, "node_modules", "dep2", "index.d.ts"),
    "export declare const dep2: string;\n",
    "utf8",
  );
  assert.ok(await deliver(modules[0]!));
  assert.equal(
    pluginRuns(),
    4,
    "an edited out-of-walk graph member must recompile",
  );

  fs.rmSync(path.join(project.root, "src", "added.d.ts"));
  assert.ok(await deliver(modules[0]!));
  assert.equal(pluginRuns(), 5, "a removed project input must recompile");

  // A steady project must then stop recompiling.
  for (const file of modules) {
    assert.ok(await deliver(file));
  }
  assert.equal(
    pluginRuns(),
    5,
    "a steady project must not recompile once its snapshot matches again",
  );
}
