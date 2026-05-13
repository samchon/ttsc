import { assertSharedAdapterFilter } from "../../internal/adapter-entrypoints";

/**
 * Verifies shared adapter filter accepts source files and skips declarations.
 *
 * This unplugin adapter scenario is isolated as one exported TypeScript feature
 * so failures identify the exact package contract under test without a shared
 * smoke wrapper or package-level switch statement.
 *
 * 1. Materialize the project fixture or module graph required by the case.
 * 2. Execute the real ttsc, ttsx, lint, or unplugin path under test.
 * 3. Assert the observable output, diagnostics, or plugin descriptor shape.
 */
export const test_shared_adapter_filter_accepts_source_files_and_skips_declarations =
  async () => {
    await assertSharedAdapterFilter();
  };
