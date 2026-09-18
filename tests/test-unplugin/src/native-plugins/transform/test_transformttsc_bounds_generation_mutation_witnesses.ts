import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createCacheProject } from "../../internal/transform-project-cache/createCacheProject";

/**
 * Verifies a generation keeps only a bounded number of paths from a burst of
 * mutation events.
 *
 * A retained generation records the paths its project watch reports, as
 * witnesses for later diagnostics. An unbounded record would grow with every
 * event a busy directory produces for the life of the generation, so extra
 * paths must collapse into one omission flag.
 *
 * 1. Compile a project through a cache whose watch hands out its listeners, and
 *    assert the generation retains its project watch.
 * 2. Fire 32 rename events.
 * 3. Assert eight paths are kept and the omission flag is set.
 */
export async function test_transformttsc_bounds_generation_mutation_witnesses(): Promise<void> {
  // Share one Go fixture build per process; transformTtsc shells out to it.
  TestUnpluginProject.ensureSharedCacheDir();
  const {
    createTtscTransformCache,
    resetTtscTransformCache,
    resolveOptions,
    transformTtsc,
  } = await TestUnpluginRuntime.loadUnpluginApi();
  const listeners: ((eventType: string, filename: string | null) => void)[] =
    [];
  const cache = createTtscTransformCache({
    watch: (
      _directory: string,
      listener: (eventType: string, filename: string | null) => void,
    ) => {
      listeners.push(listener);
      return { close: () => undefined };
    },
  });
  const project = createCacheProject({ fileCount: 2, graphFanout: 2 });
  const main = path.join(project.root, "src", "mod0.ts");
  assert.ok(
    await transformTtsc(
      main,
      fs.readFileSync(main, "utf8"),
      resolveOptions(),
      undefined,
      cache,
    ),
  );
  const generation = (await [...cache.values()][0]!) as unknown as {
    projectMutationTracker?: {
      changes: Set<string>;
      changesOmitted: boolean;
    };
  };
  const tracker = generation.projectMutationTracker;
  assert.ok(
    tracker,
    "a stable cached generation must retain its project watch",
  );

  for (let index = 0; index < 32; index += 1) {
    for (const listener of listeners) listener("rename", `burst-${index}.ts`);
  }
  assert.equal(tracker.changes.size, 8);
  assert.equal(
    tracker.changesOmitted,
    true,
    "additional event paths must collapse into one bounded omission flag",
  );
  resetTtscTransformCache(cache);
}
