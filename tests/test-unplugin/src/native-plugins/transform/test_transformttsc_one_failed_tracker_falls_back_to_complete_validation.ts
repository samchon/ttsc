import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createCacheProject } from "../../internal/transform-project-cache/createCacheProject";
import { projectModules } from "../../internal/transform-project-cache/projectModules";

/**
 * Verifies one failed tracker is enough to leave the narrow validation path.
 *
 * Membership has two halves, the project walk and the universal inputs, and a
 * generation may take the narrow path only while both are still proven by
 * notification. The neighbouring cases fail every watcher at once, so a
 * regression that consulted a single tracker would keep them green while
 * serving a module whose universal inputs nothing watches.
 *
 * 1. Let the mutation witness open, then refuse every later watch registration.
 * 2. Deliver modules and assert the generation survives with neither tracker
 *    attached.
 * 3. Edit an input and assert the fallback still invalidates.
 *
 * @evidence contracts/testing.md#behavioral-verification Refused postcompile watcher registrations leave neither tracker attached but keep one compile; later source edit recompiles once.
 * @evidence contracts/testing.md#independent-expectations Native run-log existence controls refusal only after first compile; tracker fields and invocation counts independently expose authority/fallback.
 * @evidence contracts/testing.md#distinguishing-cases One unusable tracker withdraws its healthy sibling too, contrasted with all-watchers-fail cases.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers test_transformttsc_one_failed_tracker_falls_back_to_complete_validation in native-plugins/transform in the E2E population. Its local callbacks and helper-driven module matrix execute under this named entry; embedded native operations are fixture inputs, not separately selectable test hosts.
 * @evidence contracts/e2e.md#necessary-boundary The built transform API must hand an actual native fixture envelope to generation capture/validation and then serve the selected modules. The native run log and reported graph/proofs expose that connection; synthetic graph options test envelope transport and admission, not correctness of TypeScript-Go graph construction.
 * @evidence contracts/e2e.md#shared-execution createCacheProject reuses the materialized cache Go fixture and content-addressed build cache unless this case requests isolatedPluginSource; unique consumer and run-log roots keep mutable inputs private. Within each consumer/cache scenario, repeated deliveries reuse that scenario's transform cache; distinct consumers or policies keep separate caches. Changed declared inputs or rejected capture require the counted new invocation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Consumer, source edits, hook counters and transform cache belong to this case; shared producer inputs remain equivalent or their changed content selects a new build key. TestProject owns its managed temporary roots through runner cleanup. This case does not explicitly reset every retained transform cache; generation disposal and runner termination bound native observer lifetime, rather than a claimed per-case cleanup.
 * @evidence contracts/e2e.md#preserved-coverage Refused postcompile watcher registrations leave neither tracker attached but keep one compile; later source edit recompiles once. These assertions remain in test_transformttsc_one_failed_tracker_falls_back_to_complete_validation, with their stated fixture/oracle limits; portable decisions are not claimed covered by an unnamed unit or by a synthetic envelope alone.
 */
export async function test_transformttsc_one_failed_tracker_falls_back_to_complete_validation(): Promise<void> {
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
