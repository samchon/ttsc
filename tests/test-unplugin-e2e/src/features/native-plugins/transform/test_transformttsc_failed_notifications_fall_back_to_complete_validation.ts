import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createCacheProject } from "../../../internal/transform-project-cache/createCacheProject";
import { projectModules } from "../../../internal/transform-project-cache/projectModules";

/**
 * Verifies a watcher that fails after generation falls back to complete
 * validation instead of evicting.
 *
 * A failed notification is the absence of a membership proof, never evidence of
 * a change. The generation must keep serving through complete-snapshot
 * validation, while a real edit, which is evidence, still replaces it.
 *
 * 1. Compile through a cache whose watchers can be failed on demand, and assert a
 *    healthy watcher was attached.
 * 2. Fail every watcher and assert the next delivery keeps the same generation.
 * 3. Edit an input and assert the next delivery replaces it.
 *
 * @evidence contracts/testing.md#behavioral-verification Failing every attached watcher preserves the same one-compile generation through fallback; subsequent source edit adds exactly one compile.
 * @evidence contracts/testing.md#independent-expectations The captured onError callbacks deliberately invalidate notification authority while bytes stay fixed; run log and identity separately detect eviction.
 * @evidence contracts/testing.md#distinguishing-cases Healthy watchers, failed notification without edit and failed-notification-plus-edit distinguish uncertainty from actual input change.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers test_transformttsc_failed_notifications_fall_back_to_complete_validation in native-plugins/transform in the E2E population. Its local callbacks and helper-driven module matrix execute under this named entry; embedded native operations are fixture inputs, not separately selectable test hosts.
 * @evidence contracts/e2e.md#necessary-boundary The built transform API must hand an actual native fixture envelope to generation capture/validation and then serve the selected modules. The native run log and reported graph/proofs expose that connection; synthetic graph options test envelope transport and admission, not correctness of TypeScript-Go graph construction.
 * @evidence contracts/e2e.md#shared-execution createCacheProject reuses the materialized cache Go fixture and content-addressed build cache unless this case requests isolatedPluginSource; unique consumer and run-log roots keep mutable inputs private. Within each consumer/cache scenario, repeated deliveries reuse that scenario's transform cache; distinct consumers or policies keep separate caches. Changed declared inputs or rejected capture require the counted new invocation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Consumer, source edits, hook counters and transform cache belong to this case; shared producer inputs remain equivalent or their changed content selects a new build key. TestProject owns its managed temporary roots through runner cleanup. This case does not explicitly reset every retained transform cache; generation disposal and runner termination bound native observer lifetime, rather than a claimed per-case cleanup.
 * @evidence contracts/e2e.md#preserved-coverage Failing every attached watcher preserves the same one-compile generation through fallback; subsequent source edit adds exactly one compile. These assertions remain in test_transformttsc_failed_notifications_fall_back_to_complete_validation, with their stated fixture/oracle limits; portable decisions are not claimed covered by an unnamed unit or by a synthetic envelope alone.
 */
export async function test_transformttsc_failed_notifications_fall_back_to_complete_validation(): Promise<void> {
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
