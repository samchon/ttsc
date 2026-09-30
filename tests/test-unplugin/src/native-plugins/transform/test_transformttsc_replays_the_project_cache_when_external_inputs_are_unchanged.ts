import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";

import { cacheEntry } from "../../internal/transform-external/cacheEntry";
import { createProjectWithExternalInput } from "../../internal/transform-external/createProjectWithExternalInput";

/**
 * Verifies an untouched external input lets the second transform replay the
 * cached generation.
 *
 * This is the negative twin of external invalidation. Re-hashing the external
 * input on every call must not turn the cache into a per-call recompile, so the
 * second transform has to return the same cached promise.
 *
 * 1. Transform with a plugin that reads and reports a file outside the project.
 * 2. Transform again without touching that file.
 * 3. Assert the same generation was replayed.
 *
 * @evidence contracts/testing.md#behavioral-verification Two deliveries over untouched external input return equal code and the same cached generation promise.
 * @evidence contracts/testing.md#independent-expectations Strict promise identity checks reuse beyond equivalent output; unchanged input is authored premise, not a generated snapshot oracle.
 * @evidence contracts/testing.md#distinguishing-cases Repeated persistent request with stable out-of-project reported helper.
 * @evidence contracts/testing.md#execution-ownership Named native-plugin E2E test_transformttsc_replays_the_project_cache_when_external_inputs_are_unchanged is selected under native-plugins/transform by @ttsc/test-unplugin src/index.ts; this body and its invoked helpers own the distinctions above.
 * @evidence contracts/e2e.md#necessary-boundary Built transformTtsc coordinates the actual Go fixture envelope with cache delivery for repeated persistent request with stable out-of-project reported helper. A fabricated producer result would not establish that native proofs, output and consumer validation agree; portable helper assertions in this body still do not independently require a host.
 * @evidence contracts/e2e.md#shared-execution One project and loaded API share native fixture artifacts through TTSC_CACHE_DIR. Its modules and request waves reuse the local generation until the stated input/proof/lifecycle changes require replacement; the compile counts above are deliberate state boundaries.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private project/run-log/cache identities isolate this case's writes; immutable fixture Go sources may share artifact cache, while edited producer sources are copied locally. This body has no finally cache-reset guarantee; runner process exit bounds remaining observers and removes tracked roots. Cache-local seams avoid modifying another case's filesystem provider.
 * @evidence contracts/e2e.md#preserved-coverage Retained assertions: Two deliveries over untouched external input return equal code and the same cached generation promise. These tags transfer no portable cases and remove no behavioral checks. Native setup and cleanup limitations above remain explicit.
 */
export async function test_transformttsc_replays_the_project_cache_when_external_inputs_are_unchanged(): Promise<void> {
  const { resolveOptions, transformTtsc, createTtscTransformCache } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const { relative, root } = createProjectWithExternalInput("first\n");
  const options = resolveOptions({
    plugins: [
      {
        transform: "./plugin.cjs",
        name: "reader",
        operation: "read-configured-helper",
        path: relative,
      },
      {
        transform: "./plugin.cjs",
        name: "reporter",
        operation: "emit-dependencies",
        dependencies: [relative],
      },
    ],
  });
  const cache = createTtscTransformCache();

  const before = await transformTtsc(
    TestUnpluginProject.mainFile(root),
    TestUnpluginProject.mainSource(root),
    options,
    undefined,
    cache,
  );
  assert.ok(before);
  const generation = cacheEntry(cache);

  const after = await transformTtsc(
    TestUnpluginProject.mainFile(root),
    TestUnpluginProject.mainSource(root),
    options,
    undefined,
    cache,
  );
  assert.ok(after);
  assert.equal(after.code, before.code);
  assert.strictEqual(cacheEntry(cache), generation);
}
