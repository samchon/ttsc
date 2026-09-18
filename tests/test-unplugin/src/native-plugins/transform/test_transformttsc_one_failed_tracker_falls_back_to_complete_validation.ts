import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createCacheProject } from "../../internal/transform-project-cache/createCacheProject";
import { projectModules } from "../../internal/transform-project-cache/projectModules";

/**
 * Verifies one failed tracker is enough to leave the narrow path.
 *
 * Membership has two halves — the project walk and the universal inputs — and a
 * generation may take the narrow path only while both are still proven by
 * notification. The neighbouring cases refuse or fail every watcher at once, so
 * a regression that consulted a single tracker would keep them green while
 * serving a module whose universal inputs nothing is watching.
 */
export async function test_transformttsc_one_failed_tracker_falls_back_to_complete_validation(): Promise<void> {
  // Share one Go fixture build per process; transformTtsc shells out to it.
  TestUnpluginProject.ensureSharedCacheDir();
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const project = createCacheProject({ fileCount: 6, graphFanout: 6 });
  const modules = projectModules(project.root);
  const cache = createTtscTransformCache({
    watch: () => {
      // The project tracker registers before the compile and the host-input
      // tracker after it, so the fixture's own run log separates the two
      // phases: on the first generation this refuses the host-input
      // registrations only. A later recompile finds the log already written and
      // refuses both, which the assertions after it do not depend on.
      if (!fs.existsSync(project.runLog)) {
        return { close: () => undefined };
      }
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
    assert.ok(await deliver(file));
  }
  assert.equal(
    pluginRuns(),
    1,
    "one unusable tracker must not cost the cache its generation",
  );
  const generation = await [...cache.values()][0]!;
  assert.equal(
    generation.hostInputMutationTracker,
    undefined,
    "the tracker that could not register must not be attached",
  );
  assert.equal(
    generation.projectMutationTracker,
    undefined,
    "its healthy sibling must not be attached either: the narrow path needs both",
  );

  fs.writeFileSync(
    path.join(project.root, "src", "mod3.ts"),
    'export const value3: string = "PROBE-EDITED";\n',
    "utf8",
  );
  assert.ok(await deliver(modules[0]!));
  assert.equal(
    pluginRuns(),
    2,
    "an edit must still invalidate through the fallback",
  );
}
