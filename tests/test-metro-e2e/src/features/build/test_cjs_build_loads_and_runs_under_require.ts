import { assertCjsBuildLoadsAndRuns } from "../../internal/metro-cjs";

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
 * @evidence contracts/testing.md#execution-ownership This named features export test_cjs_build_loads_and_runs_under_require executes the compiled Metro package in the E2E runner; source units own its portable decisions and the leaf helper retains this case assertions.
 * @evidence contracts/e2e.md#necessary-boundary Metro requires the emitted CJS artifact, so source unit calls cannot establish its import.meta rewrite and runtime dependency assembly.
 * @evidence contracts/e2e.md#shared-execution The index and transformer reuse the suite workspace build and Node require cache. No installation, native compiler or per-format rebuild starts.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The helper confines its transform-session directory and restores worker options in finally; the read-only emitted artifact is shared, and tracked temporary resources end with the test process.
 * @evidence contracts/e2e.md#preserved-coverage All original required-export, returned-path and key-shape assertions remain; broader option and filtering matrices moved to their named source owners.
 */
export const test_cjs_build_loads_and_runs_under_require = async () => {
  await assertCjsBuildLoadsAndRuns();
};
