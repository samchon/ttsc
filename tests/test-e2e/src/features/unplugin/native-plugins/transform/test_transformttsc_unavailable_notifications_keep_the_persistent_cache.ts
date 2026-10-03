import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createCacheProject } from "../../../../internal/unplugin/internal/transform-project-cache/createCacheProject";
import { projectModules } from "../../../../internal/unplugin/internal/transform-project-cache/projectModules";

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
 * 2. Edit a source and verify a second actual capture delivers changed output.
 * 3. Assert a steady project stops recompiling once its snapshot matches again.
 *
 * @evidence contracts/testing.md#behavioral-verification The public transformTtsc operation delivers all six actual Go-plugin outputs with refused watcher registrations, reuses one complete snapshot, then captures one edited source and serves the settled generation without a third producer invocation.
 * @evidence contracts/testing.md#independent-expectations The fixture Go contributor replaces PROBE with PROBED and appends one byte per invocation; literal output markers and run-log counts 1 then 2 distinguish native delivery and redundant capture independently of cache internals.
 * @evidence contracts/testing.md#distinguishing-cases All six unchanged modules contrast with a changed source whose PROBED-EDITED output must be delivered. An ENOSPC registration refusal leaves no tracker. Independent source/add/remove/external snapshot invalidations and fresh-checkpoint replay are covered by test_snapshot_delivery_actions_preserve_each_change_without_watchers.
 * @evidence contracts/testing.md#execution-ownership This named E2E calls the built public API and real Go contributor through the native compiler host; the portable four-class decision unit remains in src/features/transform and does not claim a producer invocation.
 * @evidence contracts/e2e.md#necessary-boundary A correct capture decision alone cannot establish that the public coordinator invokes the native producer, admits its complete proof despite watcher refusal and delivers its changed TypeScript output; this survivor owns that connection.
 * @evidence contracts/e2e.md#shared-execution One immutable cache-probe source producer is reused through createCacheProject. One six-module project and cache need two actual captures because source bytes change; the unchanged deliveries share each recorded generation instead of launching one host per module or portable mutation class.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The project and run log are unique while source artifact identity is shared. ENOSPC is supplied by the supported cache-local watcher provider, not a global patch. The exact source edit invalidates generation one and finally resets retained cache observers on every outcome.
 * @evidence contracts/e2e.md#preserved-coverage Original six-module output assertions, initial real invocation count and absent-tracker assertion remain. The source-edit count 2 and steady replay now stay at 2 with stronger changed-output proof. Original add/external/remove counts 3/4/5 map to each exact capture request and fresh-checkpoint serving in test_snapshot_delivery_actions_preserve_each_change_without_watchers; those units prove decisions, and this survivor proves actual request-to-producer connection.
 */
export async function test_transformttsc_unavailable_notifications_keep_the_persistent_cache(): Promise<void> {
  const {
    createTtscTransformCache,
    resetTtscTransformCache,
    resolveOptions,
    transformTtsc,
  } = await TestUnpluginRuntime.loadUnpluginApi();
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

  try {
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

    // Keep the real invalidation request connected to the native producer.
    fs.writeFileSync(
      path.join(project.root, "src", "mod4.ts"),
      'export const value4: string = "PROBE-EDITED";\n',
      "utf8",
    );
    const edited = await deliver(modules[4]!);
    assert.ok(edited);
    assert.match(edited.code, /PROBED-EDITED/);
    assert.equal(pluginRuns(), 2, "an edited project source must recompile");

    // A steady project must then stop recompiling.
    for (const file of modules) {
      assert.ok(await deliver(file));
    }
    assert.equal(
      pluginRuns(),
      2,
      "a steady project must not recompile once its snapshot matches again",
    );
  } finally {
    resetTtscTransformCache(cache);
  }
}
