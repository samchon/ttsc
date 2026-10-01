import { PositiveWatchBatch } from "../internal/PositiveWatchBatch";

/**
 * Verifies positive Evidence watch transitions and phase-local Program residency.
 *
 * Independently named mutation phases preserve their actual cycles and diagnostics.
 * Configuration changes legitimately reload Programs. Markdown-only changes
 * must preserve their phase Program; one same-directory cold check stays fresh.
 *
 * 1. Start with missing Swagger, then activate empty Markdown and covered inputs.
 * 2. Drive documented/review recovery, Markdown, Swagger, ancestor, code-link and staged events.
 * 3. Revoke private parser loaders last, close the watcher and release its fixture.
 *
 * @evidence contracts/testing.md#behavioral-verification Thirteen original watch scenarios retain initial/recovered0 and invalid2 verdicts, first Swagger parent/file creation, empty Markdown create/delete findings, documented configuration once-per-cycle recovery, accepted/stale review diagnostics, stale/current findings, unrelated1500ms quiet, PID/load telemetry, cold exact multiplicity and distinct cache-loader failures. This states assertion ownership rather than an execution result.
 * @evidence contracts/testing.md#independent-expectations Authored original headings, paths, claim identity, methods and schema models determine literal expectations; parser output never authors the expected paths. One real fresh Program supplies the limited same-product differential oracle.
 * @evidence contracts/testing.md#distinguishing-cases Initially absent Swagger becomes generated and an empty Markdown glob gains/loses its sole document; complete inputs then become missing/restored local and ancestor populations, disabled first Staged becomes enabled, and equal parser bytes contrast with changed bytes after actual loader revocation. Covered Markdown retains PID/count while config changes may reload.
 * @evidence contracts/testing.md#execution-ownership This matching features export is discovered by test-evidence DynamicExecutor and calls the named positiveWatchCases callbacks; those internal callbacks are reviewed through this owner, rather than independently discovered feature entries.
 * @evidence contracts/e2e.md#necessary-boundary Original plain and typed named config loading, native contributor transport, actual watch input topology and packaged Node loaders must connect to a real resident compiler and required cold Program. The separate fixed-Program consumer batch owns the real HTTP Swagger baseline and exact-query request assertions.
 * @evidence contracts/e2e.md#shared-execution One canonical producer, workspace and watcher serve these cases; original source/config/include populations require genuine Program retirement between phases. Equivalent Alpha mutations share one unchanged phase Program, both parser controls share one unrelated cycle with independent original source filters, and one original fresh cold host remains.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Missing Swagger runs before any api parent is created; empty Markdown keeps its original .keep and uncited source after genuine reinitialization. Each phase restores recorded original bytes or absence, primary/sibling layout, source corpus and include membership. Code-link includes its typed primary config; Staged retains src-only membership. Baselines and resets retain their authored0/2 verdicts; private loader revocation is last and process closure and fixture removal each run despite failures.
 * @evidence contracts/e2e.md#preserved-coverage positiveWatchCases owns all thirteen original watch assertion mappings, including missing/generated Swagger, empty/created/deleted Markdown, documented configuration cycle reset, content-derived review expiry, first numeric Claim1 identity, both physically external channels, distinct export/file failures and exact cold multiplicity. The duplicate standalone entries are removed; each callback retains its independently collected assertions and mutation name, and this claim does not certify a completed run.
 */
export async function test_evidence_positive_watch_consumers_share_one_watcher(): Promise<void> {
  await PositiveWatchBatch.run();
}
