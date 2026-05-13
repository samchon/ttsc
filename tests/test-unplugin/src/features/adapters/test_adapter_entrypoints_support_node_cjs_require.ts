import { assertAdapterEntrypointsSupportCjsRequire } from "../../internal/adapter-entrypoints";

/**
 * Verifies adapter entrypoints support Node CJS require.
 *
 * This unplugin adapter scenario is isolated as one exported TypeScript feature
 * so failures identify the exact package contract under test without a shared
 * smoke wrapper or package-level switch statement.
 *
 * 1. Materialize the project fixture or module graph required by the case.
 * 2. Execute the real ttsc, ttsx, lint, or unplugin path under test.
 * 3. Assert the observable output, diagnostics, or plugin descriptor shape.
 */
export const test_adapter_entrypoints_support_node_cjs_require = () => {
  assertAdapterEntrypointsSupportCjsRequire();
};
