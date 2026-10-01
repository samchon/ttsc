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
 * 3. Run getCacheKey through the CJS module and assert a valid digest.
 *
 * @evidence contracts/testing.md#behavioral-verification The built CommonJS index returns the configured transformer path and that required transformer exposes transform/getCacheKey with a 64-character key.
 * @evidence contracts/testing.md#independent-expectations Metro loads babelTransformerPath through require; the runtime callable exports and literal digest shape follow that public loader contract.
 * @evidence contracts/testing.md#distinguishing-cases CJS module initialization contrasts source/ESM semantics; index import.meta rewriting, transformer import.meta rewriting and package-version resolution run together.
 * @evidence contracts/testing.md#execution-ownership Called by test_e2e_metro, which is discovered under src/features and selected by the E2E Evidence claim; this exported scenario executes the compiled Metro package, while source units own its portable decisions.
 * @evidence contracts/e2e.md#necessary-boundary Metro requires the emitted CJS artifact, so source unit calls cannot establish its import.meta rewrite and runtime dependency assembly.
 * @evidence contracts/e2e.md#shared-execution The index and transformer reuse the suite workspace build and Node require cache. No installation, native compiler or per-format rebuild starts. Its project root is a bare slot of the experiment's single workspace.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Worker environment is saved and restored in finally, the session is confined to a temporary directory, and the project root is a slot the experiment removes with its workspace after the last scenario.
 * @evidence contracts/e2e.md#preserved-coverage All original required-export, returned-path and key-shape assertions remain; broader option and filtering matrices moved to their named source owners.
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
