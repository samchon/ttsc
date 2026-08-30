import { assertAFailedCompileWatchesAndReportsPlainly } from "../../internal/transform-program-output";

/**
 * Verifies a failed compile registers watch inputs and reports without escapes.
 *
 * See {@link assertAFailedCompileWatchesAndReportsPlainly} for both halves and
 * why a watching session used to have no channel through which a fix could
 * arrive (samchon/ttsc#1312). Exercises the real native compiler, so it runs in
 * CI.
 */
export const test_transformttsc_a_failed_compile_watches_and_reports_plainly =
  async () => {
    await assertAFailedCompileWatchesAndReportsPlainly();
  };
