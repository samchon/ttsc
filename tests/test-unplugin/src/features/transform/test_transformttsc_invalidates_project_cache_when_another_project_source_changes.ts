import { assertTransformCacheInvalidatesOnProjectSourceChange } from "../../internal/transform-compiler-options";

/**
 * Verifies transformTtsc invalidates the project cache when another project
 * source file changes.
 *
 * The cache key must cover all project source files, not just the file being
 * transformed. If `helper.ts` changes but only `main.ts` is the transform
 * target, a cache hit on the stale entry would emit output based on the old
 * helper content. This pins that modifying a sibling source file (`helper.ts`)
 * causes the next `transformTtsc` call to produce fresh output.
 *
 * 1. Create a fixture project with a plugin that reads `src/helper.ts`.
 * 2. Write `helper.ts` with content "first" and run `transformTtsc` — assert
 *    output contains `"PLUGIN:FIRST"`.
 * 3. Overwrite `helper.ts` with "second" and run `transformTtsc` again — assert
 *    output now contains `"PLUGIN:SECOND"`.
 */
export const test_transformttsc_invalidates_project_cache_when_another_project_source_changes =
  async () => {
    await assertTransformCacheInvalidatesOnProjectSourceChange();
  };
