import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";

import { createCacheProject } from "../../../../internal/unplugin/internal/transform-project-cache/createCacheProject";
import { projectModules } from "../../../../internal/unplugin/internal/transform-project-cache/projectModules";

/**
 * Verifies a generation's non-error diagnostics are surfaced once per pass, not
 * once per delivered module (samchon/ttsc#1304).
 *
 * The diagnostics describe one compile of one program, so writing them per
 * delivery printed the same warning once per module and scaled the noise with
 * exactly the reuse the cache provides. No fixture plugin emits a warning, so
 * the envelope is re-published with a `warning`-category diagnostic, the shape
 * `toCompilerTransformation` produces for `@ttsc/lint` rules below error
 * severity.
 *
 * 1. Attach a warning to the generation's envelope and capture stderr.
 * 2. Deliver every module in one pass and assert the warning was written once.
 * 3. Open a later pass and assert the standing warning is surfaced again, once.
 *
 * @evidence contracts/testing.md#behavioral-verification Injected native generation warning is printed once across six modules, then once again in later pass.
 * @evidence contracts/testing.md#independent-expectations Literal warning marker and stderr write count fix per-pass expectation; warning is injected because fixture emits none, so native warning production is not proven.
 * @evidence contracts/testing.md#distinguishing-cases Multiple modules same pass versus new pass with standing warning.
 * @evidence contracts/testing.md#execution-ownership Named native-plugin E2E test_transformttsc_reports_generation_diagnostics_once_per_pass is selected under native-plugins/transform by @ttsc/test-unplugin src/index.ts; this body and its invoked helpers own the distinctions above.
 * @evidence contracts/e2e.md#necessary-boundary Built transformTtsc coordinates the actual Go fixture envelope with cache delivery for multiple modules same pass versus new pass with standing warning. A fabricated producer result would not establish that native proofs, output and consumer validation agree; portable helper assertions in this body still do not independently require a host.
 * @evidence contracts/e2e.md#shared-execution One project and loaded API share native fixture artifacts through TTSC_CACHE_DIR. Its modules and request waves reuse the local generation until the stated input/proof/lifecycle changes require replacement; the compile counts above are deliberate state boundaries.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private project/run-log/cache identities isolate this case's writes; immutable fixture Go sources may share artifact cache, while edited producer sources are copied locally. Temporary stderr interception is restored in finally. Cache reset also runs in finally; tracked roots end at process exit.
 * @evidence contracts/e2e.md#preserved-coverage Retained assertions: Injected native generation warning is printed once across six modules, then once again in later pass. These tags transfer no portable cases and remove no behavioral checks. Native setup and cleanup limitations above remain explicit.
 */
export async function test_transformttsc_reports_generation_diagnostics_once_per_pass(): Promise<void> {
  const api = await TestUnpluginRuntime.loadUnpluginApi();
  const project = createCacheProject({ fileCount: 6, graphFanout: 1 });
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
  const marker = "TTSC-TEST-PROJECT-WIDE-WARNING";
  const originalDescriptor = Object.getOwnPropertyDescriptor(process.stderr, "write");
  const original = process.stderr.write;
  let writes = 0;
  try {
    api.beginTtscTransformBuild(cache);
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

    api.beginTtscTransformBuild(cache);
    for (const file of modules) {
      assert.ok(await deliver(file));
    }
    assert.equal(
      writes,
      1,
      `every module of one pass shares one generation, so its diagnostics belong to the pass; wrote ${writes} times for ${modules.length} modules`,
    );

    api.beginTtscTransformBuild(cache);
    for (const file of modules) {
      assert.ok(await deliver(file));
    }
    assert.equal(
      writes,
      2,
      "a later pass must surface the standing warning again, once",
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
