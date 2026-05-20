import { assertTransformReportsNativeDiagnostics } from "../../internal/transform-diagnostics";

/**
 * Verifies transformTtsc reports native transform diagnostics.
 *
 * When the native ttsc compiler emits a transform diagnostic (e.g. the fixture
 * plugin expects `goUpper(...)` but the source exports a plain string), the
 * adapter must surface that error as a thrown exception so the bundler can
 * report it to the user. Swallowing or ignoring native diagnostics would give a
 * silent green build with incorrect output. This pins that the rejection
 * message contains the expected diagnostic text.
 *
 * 1. Create a fixture project with source that does not satisfy the plugin's
 *    transform contract (`"plain"` instead of `goUpper(...)`).
 * 2. Call `transformTtsc` on that source.
 * 3. Assert the call rejects with a message matching the expected diagnostic.
 */
export const test_transformttsc_reports_native_transform_diagnostics =
  async () => {
    await assertTransformReportsNativeDiagnostics();
  };
