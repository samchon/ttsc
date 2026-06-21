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
 */
export const test_cjs_build_loads_and_runs_under_require = async () => {
  await assertCjsBuildLoadsAndRuns();
};
