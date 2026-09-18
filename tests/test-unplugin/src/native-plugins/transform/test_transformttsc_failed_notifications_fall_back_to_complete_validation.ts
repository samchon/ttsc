import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createCacheProject } from "../../internal/transform-project-cache/createCacheProject";
import { projectModules } from "../../internal/transform-project-cache/projectModules";

/**
 * Verifies a watcher that fails after generation falls back instead of
 * evicting.
 *
 * A failed notification is the absence of a membership proof, never evidence of
 * a change. The generation must keep serving through complete-snapshot
 * validation, while a real membership event — which is evidence — still
 * replaces it.
 */
export async function test_transformttsc_failed_notifications_fall_back_to_complete_validation(): Promise<void> {
  // Share one Go fixture build per process; transformTtsc shells out to it.
  TestUnpluginProject.ensureSharedCacheDir();
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const project = createCacheProject({ fileCount: 6, graphFanout: 6 });
  const modules = projectModules(project.root);
  const failures: (() => void)[] = [];
  const cache = createTtscTransformCache({
    watch: (_directory: string, _listener: unknown, onError: () => void) => {
      failures.push(onError);
      return { close: () => undefined };
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
  assert.equal(pluginRuns(), 1);
  const generation = [...cache.values()][0];
  assert.notEqual(
    (await generation!).projectMutationTracker,
    undefined,
    "a healthy watcher must be attached so the narrow path stays available",
  );

  // The watchers stop reporting after the generation was produced.
  assert.ok(failures.length > 0, "the seam must have registered a watcher");
  for (const fail of failures) {
    fail();
  }
  for (const file of modules) {
    assert.ok(await deliver(file));
  }
  assert.equal(
    pluginRuns(),
    1,
    "a failed watcher must fall back to complete validation, not evict",
  );
  assert.equal(
    [...cache.values()][0],
    generation,
    "the fallback must keep the same generation",
  );

  fs.writeFileSync(
    path.join(project.root, "src", "mod2.ts"),
    'export const value2: string = "PROBE-EDITED";\n',
    "utf8",
  );
  assert.ok(await deliver(modules[0]!));
  assert.equal(
    pluginRuns(),
    2,
    "an edit must still invalidate once notifications have failed",
  );
}
