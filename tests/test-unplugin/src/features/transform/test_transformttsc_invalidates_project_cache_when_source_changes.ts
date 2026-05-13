import { assertTransformCacheInvalidatesOnSourceChange } from "../../internal/transform-compiler-options";

/**
 * Verifies transformTtsc invalidates project cache when source changes.
 *
 * This unplugin transform scenario is isolated as one exported TypeScript
 * feature so failures identify the exact package contract under test without a
 * shared smoke wrapper or package-level switch statement.
 *
 * 1. Materialize the project fixture or module graph required by the case.
 * 2. Execute the real ttsc, ttsx, lint, or unplugin path under test.
 * 3. Assert the observable output, diagnostics, or plugin descriptor shape.
 */
export const test_transformttsc_invalidates_project_cache_when_source_changes =
  async () => {
    await assertTransformCacheInvalidatesOnSourceChange();
  };
