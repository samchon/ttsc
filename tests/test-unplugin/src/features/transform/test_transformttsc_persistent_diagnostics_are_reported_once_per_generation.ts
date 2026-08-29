import { assertPersistentDiagnosticsAreReportedOncePerGeneration } from "../../internal/transform-terminal-verdict";

/**
 * Verifies a host with no delivery pass reports diagnostics once per
 * generation.
 *
 * The guard is two fields rather than one because a persistent host's epoch is
 * `undefined`, which is also the initial value: collapsing them into a single
 * epoch comparison would silently suppress the very first report for Metro, the
 * Turbopack loader and a watching dev server, and nothing else would notice.
 *
 * 1. Compile one generation with no `beginTtscTransformBuild` anywhere.
 * 2. Re-publish it carrying a `warning` diagnostic and deliver every module.
 * 3. Assert the warning reached stderr exactly once.
 */
export const test_transformttsc_persistent_diagnostics_are_reported_once_per_generation =
  async () => {
    await assertPersistentDiagnosticsAreReportedOncePerGeneration();
  };
