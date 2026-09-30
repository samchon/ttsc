import { TestProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { waitFor } from "../../internal/adapter-vite-serve/waitFor";
import { createCacheProject } from "../../internal/transform-project-cache/createCacheProject";
import { projectModules } from "../../internal/transform-project-cache/projectModules";

/**
 * Verifies a compile that failed on a source repaired while it ran is compiled
 * again instead of being delivered as the project's current verdict.
 *
 * A failed compile used to be returned as it was, even when the project changed
 * under it. A host that re-runs a module on a later change recovers from that,
 * but Turbopack takes a loader's dependencies when the loader returns, with
 * their state at that moment as its baseline. A repair saved while a worker
 * still compiled the broken source was already in that baseline, so the stale
 * failure stayed on screen, and `next dev --turbopack` never recovered. A
 * failure is now held to the rule a success already was: the project must hold
 * still across the compile, or it is compiled again.
 *
 * 1. Mark a module failing, deliver it with no delivery pass, as the Turbopack
 *    loader does, and repair the module once the compile has read it.
 * 2. Assert the delivery resolves with the repaired module's output, from a second
 *    compile.
 *
 * @evidence contracts/testing.md#behavioral-verification transformTtsc runs without a delivery pass on a BROKEN source; after the native read stamp appears, the source is repaired during the delayed failure. The pending delivery must resolve with output containing no BROKEN marker and exactly two native invocations.
 * @evidence contracts/testing.md#independent-expectations The fixture publishes its read stamp before its 1500ms failure delay, establishing that the first attempt consumed broken bytes. Repaired source and literal two-attempt count independently require a retry rather than surfacing the stale failure; the fixture failure is a protocol double, not a compiler diagnostic.
 * @evidence contracts/testing.md#distinguishing-cases The first consumed state fails and the later filesystem state succeeds within one pending delivery. The test owns the no-pass repair race; terminal failure replay and ordinary next-pass recovery remain separate entries.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers test_transformttsc_a_failed_compile_that_raced_its_repair_is_compiled_again in native-plugins/transform. This exported E2E entry owns its local scenario callbacks and assertions; the suite runner selects the native population independently of unit cases.
 * @evidence contracts/e2e.md#necessary-boundary The real JS-to-native process connection stays pending while filesystem repair lands after the producer read. An isolated validator with a completed envelope cannot prove the failure delivery rechecks that timing boundary.
 * @evidence contracts/e2e.md#shared-execution createCacheProject shares its counting Go sidecar source and native build cache. One project/cache and one pending delivery use two necessary native attempts because the first read raced its repair; the fixture read stamp avoids repeating build preparation or relying on a fixed startup delay.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Unique source, run-log and read-stamp paths isolate the race. waitFor establishes the actual first read before the rewrite; finally resets the cache on success or failure. TestProject owns temporary directories through runner exit.
 * @evidence contracts/e2e.md#preserved-coverage All assertions described above remain in test_transformttsc_a_failed_compile_that_raced_its_repair_is_compiled_again; no case or assertion is removed or transferred. This entry retains its actual boundary checks, while synthetic fixture envelopes do not establish native compiler semantics.
 */
export async function test_transformttsc_a_failed_compile_that_raced_its_repair_is_compiled_again(): Promise<void> {
  const api = await TestUnpluginRuntime.loadUnpluginApi();
  const readStamp = path.join(
    TestProject.tmpdir("ttsc-unplugin-failure-read-"),
    "read",
  );
  const project = createCacheProject({
    failingSource: { delayMs: 1_500, marker: "BROKEN", readStamp },
    fileCount: 2,
    graphFanout: 1,
  });
  const module = projectModules(project.root)[0]!;
  const repaired = fs.readFileSync(module, "utf8");
  fs.writeFileSync(module, `${repaired}// BROKEN\n`);
  const cache = api.createTtscTransformCache();
  try {
    const delivery = api.transformTtsc(
      module,
      fs.readFileSync(module, "utf8"),
      api.resolveOptions(),
      undefined,
      cache,
    );
    // The first compile may build the fixture's native plugin on a cold cache.
    await waitFor(
      () => fs.existsSync(readStamp),
      "the compile to read the marked module",
      240_000,
    );
    fs.writeFileSync(module, repaired);
    const result = await delivery;
    assert.ok(result, "the repaired module is transformed");
    assert.doesNotMatch(result.code, /BROKEN/);
    assert.equal(
      fs.readFileSync(project.runLog, "utf8").length,
      2,
      "the failed compile raced its repair, so the project compiled again",
    );
  } finally {
    api.resetTtscTransformCache(cache);
  }
}
