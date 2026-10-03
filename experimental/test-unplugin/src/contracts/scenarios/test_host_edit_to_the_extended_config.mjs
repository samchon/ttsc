

/**
 * Verifies the actual host's edit to the extended config.
 *
 * The shared lifecycle batch invokes this entry in its existing watch session;
 * the observable is host output or its compiler verdict, not source layout.
 *
 * 1. Apply this scenario's edit to the batch-owned mutable project.
 * 2. Observe the host and assert the required result before the next transition.
 *
 * @evidence contracts/testing.md#behavioral-verification
 *   Overrides the base config plugin to CONFIGURED and restores it, expecting CONFIGURED then SIXTH.
 * @evidence contracts/testing.md#independent-expectations
 *   Literal contract values and explicit error patterns derive from the fixture input or supported invalid-input behavior. The host result is compared against those literals, never a snapshot computed by the adapter.
 * @evidence contracts/testing.md#distinguishing-cases
 *   The observed config is reached indirectly through extends; direct tsconfig edits are owned by edit_to_the_tsconfig.
 * @evidence contracts/testing.md#execution-ownership
 *   This exported named E2E entry is selected through SCENARIOS by runScenarios in the packed worker, using its original inputs and failure identity. Actual installed hosts execute the delivery; no unit runner launches it.
 * @evidence contracts/e2e.md#necessary-boundary
 *   The observed config is reached indirectly through extends; direct tsconfig edits are owned by edit_to_the_tsconfig. Direct proof calls cannot establish the actual host event, cache or delivery connection exercised here.
 * @evidence contracts/e2e.md#shared-execution
 *   Reuses the worker's installed consumer, immutable native producers and existing project/session for edit to the extended config; this entry installs nothing, builds no per-case contributor and starts no new host. A failed prerequisite state can block later dependent transitions.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity
 *   Runs in the ordered SCENARIOS state machine on one host/producer-owned fixture. Original writes and restorations remain intact; another host or producer owns a separate mutable directory. The worker closes the session in finally after success or failure.
 * @evidence contracts/e2e.md#preserved-coverage
 *   The original edit to the extended config method body is retained as this addressable function, including all conditions and assertions. Only registration changes; runScenarios still names the case and reports pre/post records, host output and available worker diagnostics on failure.
 */
export async function test_host_edit_to_the_extended_config({ project, session }) {
  // The base config is reached only through the tsconfig's extends
  // chain; a plugin entry it gains changes every consumer's value.
  project.configureBase("CONFIGURED");
  await session.settled("edit to the extended config", "CONFIGURED", [
    project.baseTsconfig,
  ]);
  project.configureBase(undefined);
  await session.settled("extended config restored", "SIXTH", [
    project.baseTsconfig,
  ]);
}
