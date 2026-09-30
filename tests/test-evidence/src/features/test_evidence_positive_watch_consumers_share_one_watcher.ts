import { PositiveWatchBatch } from "../internal/PositiveWatchBatch";

/**
 * Verifies positive Evidence watch transitions and phase-local Program residency.
 *
 * Independently named mutation phases preserve their actual cycles and diagnostics.
 * Configuration changes legitimately reload Programs. Markdown-only changes
 * must preserve their phase Program; one same-directory cold check stays fresh.
 *
 * 1. Prepare original covered watch inputs and an actual private parser library.
 * 2. Drive Markdown, Swagger, ancestor, code-link and staged configuration events.
 * 3. Revoke private parser loaders last, close the watcher and release its fixture.
 *
 * @evidence contracts/testing.md#behavioral-verification Nine original watch scenarios retain initial/recovered0 and invalid2 verdicts, stale/current findings, unrelated1500ms quiet, PID/load telemetry, cold exact multiplicity and distinct cache-loader failures.
 * @evidence contracts/testing.md#independent-expectations Authored original headings, paths, claim identity, methods and schema models determine literal expectations; parser output never authors the expected paths. One real fresh Program supplies the limited same-product differential oracle.
 * @evidence contracts/testing.md#distinguishing-cases Complete inputs become missing/restored local and ancestor populations, disabled first Staged becomes enabled, and equal parser bytes contrast with changed bytes after actual loader revocation. Markdown retains PID/count while config changes may reload.
 * @evidence contracts/testing.md#execution-ownership This matching features export is discovered by test-evidence DynamicExecutor and calls the named positiveWatchCases callbacks; those internal callbacks are reviewed through this owner, rather than independently discovered feature entries.
 * @evidence contracts/e2e.md#necessary-boundary Original plain and typed named config loading, native contributor transport, actual watch input topology and packaged Node loaders must connect to a real resident compiler and required cold Program. Remote HTTP and static graph consumers belong to the separate fixed-Program consumer batch.
 * @evidence contracts/e2e.md#shared-execution One canonical producer, workspace and watcher serve these cases; original source/config/include populations require genuine Program retirement between phases. Equivalent Alpha mutations share one unchanged phase Program, both parser controls share one unrelated cycle with independent original source filters, and one original fresh cold host remains.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Each phase restores its original primary/sibling layout, authored source corpus and include membership. The code-link primary typed config enters its Program; Staged retains src-only membership and edits the actual primary runtime config. Only recorded owned authored files are replaced between phases, with actual settled baseline0 and mutation resets; private loader revocation is last and process closure and fixture removal each run despite failures.
 * @evidence contracts/e2e.md#preserved-coverage positiveWatchCases documents all nine original watch assertion mappings, including first numeric Claim1 identity, both physically external channels, distinct export/file failures and exact cold multiplicity. Originals remain until the complete actual batch passes.
 */
export async function test_evidence_positive_watch_consumers_share_one_watcher(): Promise<void> {
  await PositiveWatchBatch.run();
}
