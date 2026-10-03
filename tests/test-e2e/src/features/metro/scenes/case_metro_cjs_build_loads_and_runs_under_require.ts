import assert from "node:assert/strict";
import { createRequire } from "node:module";

import { MetroWorkspace } from "../../../internal/metro/internal/MetroWorkspace";
import { TestMetroRuntime } from "../../../internal/metro/internal/metro-runtime";

/**
 * Verifies the CommonJS build loads and runs under `require`.
 *
 * Metro loads `transformer.babelTransformerPath` with `require`, i.e. the CJS
 * build, whose `import.meta.url`/`createRequire` rely on Rollup's CJS rewrite.
 * The ESM-only tests can't catch a broken rewrite, so this is the negative twin
 * across the build-format dimension: it pins that the actual production module
 * loads and its exports run.
 *
 * 1. Require the CJS index and call withTtsc.
 * 2. Require the CJS transformer and assert callable transform/getCacheKey.
 * 3. Call getCacheKey through CJS and assert the original string/length shape.
 *
 * @evidence contracts/testing.md#behavioral-verification The built CommonJS index returns the configured transformer path and that required transformer exposes transform/getCacheKey with a 64-character key.
 * @evidence contracts/testing.md#independent-expectations Metro's require loader requires callable exports and the returned transformer.js path. Original key string/length64 is a return-shape observation, not an independent valid-fingerprint oracle; nonce fallback also satisfies it.
 * @evidence contracts/testing.md#distinguishing-cases Built CJS initialization contrasts ESM module loading. Callable transform is observed but not invoked, and projectRoot /a key shape neither proves a selected project nor discriminates fallback/valid fingerprint paths.
 * @evidence contracts/testing.md#execution-ownership test_e2e_metro invokes the scenario, which explicitly requires workspace-built CJS index/options/transformer paths rather than authored source. withTtsc and getCacheKey run, transform does not; this is emitted assembly interoperation, not an actual Metro server or packed consumer install.
 * @evidence contracts/e2e.md#necessary-boundary Metro requires the emitted CJS artifact, so source unit calls cannot establish its import.meta rewrite and runtime dependency assembly.
 * @evidence contracts/e2e.md#shared-execution Shared workspace-built artifacts and require cache serve index/transformer calls, with one bare project slot and no deliberate transform, installation or format-specific rebuild. Actual internal filesystem/runtime/session costs are not inferred as child/Program/cache totals from these parent calls.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Exact options env is restored in finally; confineSession restores previous session and temporary-root env after withTtsc. Its tracked temporary directory remains until TestProject cleanup, while the project slot belongs to parent workspace removal. Module retention remains shared and selected paths/returned values do not certify loaded-image equality or descendants.
 * @evidence contracts/e2e.md#preserved-coverage Original callable withTtsc/transform/getCacheKey, returned transformer.js and /a string-length64 observations remain. No broader portable-owner coverage or successful fingerprint is inferred; consumer registration, runtime survival and cost measurement remain unverified.
 */
export async function case_metro_cjs_build_loads_and_runs_under_require(
  workspace: MetroWorkspace.IWorkspace,
): Promise<void> {
  const nodeRequire = createRequire(import.meta.url);
  const optionsModule = nodeRequire(
    TestMetroRuntime.libPath("core/options", "js"),
  );
  const envKey: string = optionsModule.ENV_KEY;
  const previous = process.env[envKey];
  try {
    const index = nodeRequire(TestMetroRuntime.libPath("index", "js"));
    assert.equal(typeof index.withTtsc, "function");
    // A real temp-dir projectRoot keeps the snapshot preparation out of the
    // suite's own working directory.
    const config = await TestMetroRuntime.confineSession(() =>
      index.withTtsc({
        projectRoot: MetroWorkspace.enterBare(workspace, "cjs"),
        transformer: {},
      }),
    );
    assert.match(config.transformer.babelTransformerPath, /transformer\.js$/);

    const transformer = nodeRequire(
      TestMetroRuntime.libPath("transformer", "js"),
    );
    assert.equal(typeof transformer.transform, "function");
    assert.equal(typeof transformer.getCacheKey, "function");

    process.env[envKey] = optionsModule.serializeOptions({
      upstreamTransformer: TestMetroRuntime.fakeUpstreamPathOnDisk(),
    });
    const key = transformer.getCacheKey({ projectRoot: "/a" });
    assert.equal(typeof key, "string");
    assert.equal(key.length, 64);
  } finally {
    if (previous === undefined) {
      delete process.env[envKey];
    } else {
      process.env[envKey] = previous;
    }
  }
}
