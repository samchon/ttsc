import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";

import { createCacheProject } from "../../../../internal/unplugin/internal/transform-project-cache/createCacheProject";
import { projectModules } from "../../../../internal/unplugin/internal/transform-project-cache/projectModules";

/**
 * Verifies a host with no delivery pass surfaces a generation's diagnostics
 * once.
 *
 * The guard is two fields, because a persistent host's epoch is `undefined`,
 * which is also the initial value. Collapsing them into one epoch comparison
 * would silently suppress the very first report for Metro, the Turbopack
 * loader, and a watching dev server. No fixture plugin emits a warning, so the
 * cached generation is re-published with a `warning`-category diagnostic
 * attached.
 *
 * 1. Deliver one module through a persistent cache, then replace its cached
 *    generation with one carrying a warning.
 * 2. Deliver every module while capturing stderr.
 * 3. Assert the warning was written once.
 *
 * @evidence contracts/testing.md#behavioral-verification Persistent deliveries across four modules write the deliberately attached warning exactly once.
 * @evidence contracts/testing.md#independent-expectations Literal warning marker and independent stderr-write counter establish reporting count; the warning is a planted envelope, not a native diagnostic production test.
 * @evidence contracts/testing.md#distinguishing-cases Undefined persistent epoch must still report its first warning and suppress subsequent same-generation duplicates.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers test_transformttsc_persistent_diagnostics_are_reported_once_per_generation in native-plugins/transform in the E2E population. Its local callbacks and helper-driven module matrix execute under this named entry; embedded native operations are fixture inputs, not separately selectable test hosts.
 * @evidence contracts/e2e.md#necessary-boundary The built transform API must hand an actual native fixture envelope to generation capture/validation and then serve the selected modules. The native run log and reported graph/proofs expose that connection; synthetic graph options test envelope transport and admission, not correctness of TypeScript-Go graph construction.
 * @evidence contracts/e2e.md#shared-execution createCacheProject reuses the materialized cache Go fixture and content-addressed build cache unless this case requests isolatedPluginSource; unique consumer and run-log roots keep mutable inputs private. Within each consumer/cache scenario, repeated deliveries reuse that scenario's transform cache; distinct consumers or policies keep separate caches. Changed declared inputs or rejected capture require the counted new invocation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Consumer, source edits, hook counters and transform cache belong to this case; shared producer inputs remain equivalent or their changed content selects a new build key. TestProject owns its managed temporary roots through runner cleanup. The existing finally reset/close path releases retained cache or session observers on success and assertion failure; no prior case supplies this generation. The stderr hook is restored in finally.
 * @evidence contracts/e2e.md#preserved-coverage Persistent deliveries across four modules write the deliberately attached warning exactly once. These assertions remain in test_transformttsc_persistent_diagnostics_are_reported_once_per_generation, with their stated fixture/oracle limits; portable decisions are not claimed covered by an unnamed unit or by a synthetic envelope alone.
 */
export async function test_transformttsc_persistent_diagnostics_are_reported_once_per_generation(): Promise<void> {
  const api = await TestUnpluginRuntime.loadUnpluginApi();
  const project = createCacheProject({ fileCount: 4, graphFanout: 1 });
  const modules = projectModules(project.root);
  const cache = api.createTtscTransformCache();
  const options = api.resolveOptions();
  const deliver = (file: string) =>
    api.transformTtsc(
      file,
      fs.readFileSync(file, "utf8"),
      options,
      undefined,
      cache,
    );
  const marker = "TTSC-TEST-PERSISTENT-WARNING";
  const originalDescriptor = Object.getOwnPropertyDescriptor(process.stderr, "write");
  const original = process.stderr.write;
  let writes = 0;
  try {
    // No `beginTtscTransformBuild` anywhere: this is the persistent lifecycle.
    assert.ok(await deliver(modules[0]!));
    const key = [...cache.keys()][0]!;
    const good = (await cache.get(key)) as Record<string, unknown>;
    cache.set(
      key,
      Promise.resolve({
        ...good,
        diagnosticsEpoch: undefined,
        diagnosticsReported: false,
        result: {
          ...(good.result as Record<string, unknown>),
          diagnostics: [
            {
              category: "warning",
              character: 1,
              file: "src/mod0.ts",
              line: 1,
              messageText: marker,
            },
          ],
        },
        servedFiles: new Set<string>(),
      }),
    );

    (process.stderr as { write: unknown }).write = (
      chunk: unknown,
      ...rest: unknown[]
    ) => {
      if (String(chunk).includes(marker)) writes += 1;
      return Reflect.apply(original, process.stderr, [chunk, ...rest]);
    };

    for (const file of modules) {
      assert.ok(await deliver(file));
    }
    assert.equal(
      writes,
      1,
      `a persistent host must surface one generation's diagnostics once; wrote ${writes} times for ${modules.length} deliveries`,
    );
  } finally {
    try {
      if (originalDescriptor) Object.defineProperty(process.stderr, "write", originalDescriptor);
      else delete (process.stderr as { write?: typeof process.stderr.write }).write;
    } finally {
      api.resetTtscTransformCache(cache);
    }
    assert.equal(process.stderr.write, original);
    assert.deepEqual(Object.getOwnPropertyDescriptor(process.stderr, "write"), originalDescriptor);
  }
}
