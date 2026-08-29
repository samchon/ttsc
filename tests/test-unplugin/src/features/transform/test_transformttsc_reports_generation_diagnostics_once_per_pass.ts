import { assertGenerationDiagnosticsAreReportedOncePerPass } from "../../internal/transform-terminal-verdict";

/**
 * Verifies a generation's non-error diagnostics are surfaced once per pass.
 *
 * The samchon/ttsc#1304 defect: the diagnostics describe one compile of one
 * program, so writing them per delivery printed the same warning once per
 * module and scaled the noise with exactly the reuse the cache provides. A
 * later pass must still surface a standing warning, because a build's warnings
 * are part of what that build reports.
 *
 * 1. Compile one generation, then re-publish it with a `warning` diagnostic.
 * 2. Deliver every module inside one pass while counting stderr writes.
 * 3. Assert one write for the pass, and one more for a second pass.
 */
export const test_transformttsc_reports_generation_diagnostics_once_per_pass =
  async () => {
    await assertGenerationDiagnosticsAreReportedOncePerPass();
  };
