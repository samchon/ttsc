import { assertTransformPassesBundlerAliases } from "../../internal/transform-vite-aliases";

/**
 * Verifies transformTtsc passes bundler aliases through compilerOptions.paths.
 *
 * This unplugin transform scenario is isolated as one exported TypeScript
 * feature so failures identify the exact package contract under test without a
 * shared smoke wrapper or package-level switch statement.
 *
 * 1. Materialize the project fixture or module graph required by the case.
 * 2. Execute the real ttsc, ttsx, lint, or unplugin path under test.
 * 3. Assert the observable output, diagnostics, or plugin descriptor shape.
 */
export const test_transformttsc_passes_bundler_aliases_through_compileroptions_paths =
  async () => {
    await assertTransformPassesBundlerAliases();
  };
