import { assertTransformReportsNativeDiagnostics } from "../../internal/transform-diagnostics";

/**
 * Verifies transformTtsc reports native transform diagnostics.
 *
 * This unplugin transform scenario is isolated as one exported TypeScript
 * feature so failures identify the exact package contract under test without a
 * shared smoke wrapper or package-level switch statement.
 *
 * 1. Materialize the project fixture or module graph required by the case.
 * 2. Execute the real ttsc, ttsx, lint, or unplugin path under test.
 * 3. Assert the observable output, diagnostics, or plugin descriptor shape.
 */
export const test_transformttsc_reports_native_transform_diagnostics =
  async () => {
    await assertTransformReportsNativeDiagnostics();
  };
