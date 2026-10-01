import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createCacheProject } from "../../../../internal/unplugin/internal/transform-project-cache/createCacheProject";

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
 *
 * @evidence contracts/testing.md#behavioral-verification After a real transform retains its project tracker, 32 synthetic rename events are sent through captured watch listeners. The tracker must keep exactly eight changed paths and set changesOmitted=true, distinguishing unbounded retention from conservative bounded evidence.
 * @evidence contracts/testing.md#independent-expectations Eight is the deliberate retained-witness bound, while 32 distinct filenames exceed it. Literal set size and omission flag independently check resource policy without constructing expectations by replaying the truncation implementation; actual OS burst delivery is outside this seam oracle.
 * @evidence contracts/testing.md#distinguishing-cases A retained stable generation and an event population four times the witness capacity exercise overflow retention. This entry does not separately test exactly-eight or zero-event boundaries.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers test_transformttsc_bounds_generation_mutation_witnesses in native-plugins/transform. This exported E2E entry owns its local scenario callbacks and assertions; the suite runner selects the native population independently of unit cases.
 * @evidence contracts/e2e.md#necessary-boundary The built public transform API launches the counting native sidecar and consumes its graph through a real filesystem cache across delivery-pass boundaries. This pins process-envelope delivery and generation reuse rather than native type semantics; the real-native-envelope entries own compiler calibration.
 * @evidence contracts/e2e.md#shared-execution One createCacheProject and shared counting-sidecar capture obtain a real retained generation; all 32 case events reuse its captured watch listeners. No additional native capture or observer startup is needed to test bounded retained witnesses.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Unique project root separates listener scopes. The captured listeners are local and own no real watch handles; resetTtscTransformCache runs after successful assertions. It is not inside finally, so assertion failure leaves cleanup to runner exit; TestProject owns temporary roots.
 * @evidence contracts/e2e.md#preserved-coverage All assertions described above remain in test_transformttsc_bounds_generation_mutation_witnesses; no case or assertion is removed or transferred. This entry retains its actual boundary checks, while synthetic fixture envelopes do not establish native compiler semantics.
 */
export async function test_transformttsc_bounds_generation_mutation_witnesses(): Promise<void> {
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
