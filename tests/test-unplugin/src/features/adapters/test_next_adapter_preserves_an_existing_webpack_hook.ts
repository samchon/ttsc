import { assertNextAdapterPreservesWebpackHook } from "../../internal/adapter-entrypoints";

/**
 * Verifies next adapter preserves an existing webpack hook.
 *
 * This unplugin adapter scenario is isolated as one exported TypeScript feature
 * so failures identify the exact package contract under test without a shared
 * smoke wrapper or package-level switch statement.
 *
 * 1. Materialize the project fixture or module graph required by the case.
 * 2. Execute the real ttsc, ttsx, lint, or unplugin path under test.
 * 3. Assert the observable output, diagnostics, or plugin descriptor shape.
 */
export const test_next_adapter_preserves_an_existing_webpack_hook =
  async () => {
    await assertNextAdapterPreservesWebpackHook();
  };
