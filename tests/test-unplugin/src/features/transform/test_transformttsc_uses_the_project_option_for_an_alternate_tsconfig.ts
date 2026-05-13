import { assertTransformUsesProjectOption } from "../../internal/transform-project-option";

/**
 * Verifies transformTtsc uses the project option for an alternate tsconfig.
 *
 * This unplugin transform scenario is isolated as one exported TypeScript
 * feature so failures identify the exact package contract under test without a
 * shared smoke wrapper or package-level switch statement.
 *
 * 1. Materialize the project fixture or module graph required by the case.
 * 2. Execute the real ttsc, ttsx, lint, or unplugin path under test.
 * 3. Assert the observable output, diagnostics, or plugin descriptor shape.
 */
export const test_transformttsc_uses_the_project_option_for_an_alternate_tsconfig =
  async () => {
    await assertTransformUsesProjectOption();
  };
