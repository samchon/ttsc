

/**
 * Verifies the actual host's edit to the tsconfig.
 *
 * The shared lifecycle batch invokes this entry in its existing watch session;
 * the observable is host output or its compiler verdict, not source layout.
 *
 * 1. Apply this scenario's edit to the batch-owned mutable project.
 * 2. Observe the host and assert the required result before the next transition.
 *
 * @evidence contracts/testing.md#behavioral-verification
 *   Changes the input to FOURTEENTH, overrides the plugin via tsconfig to CONFIGURED and restores FOURTEENTH.
 * @evidence contracts/testing.md#independent-expectations
 *   Literal contract values and explicit error patterns derive from the fixture input or supported invalid-input behavior. The host result is compared against those literals, never a snapshot computed by the adapter.
 * @evidence contracts/testing.md#distinguishing-cases
 *   The config-only override and restoration must reach every consumer through the config chain, not a touched source module.
 * @evidence contracts/testing.md#execution-ownership
 *   This exported named E2E entry is selected through SCENARIOS by runScenarios in the packed worker, using its original inputs and failure identity. Actual installed hosts execute the delivery; no unit runner launches it.
 * @evidence contracts/e2e.md#necessary-boundary
 *   The config-only override and restoration must reach every consumer through the config chain, not a touched source module. Direct proof calls cannot establish the actual host event, cache or delivery connection exercised here.
 * @evidence contracts/e2e.md#shared-execution
 *   Reuses the worker's installed consumer, immutable native producers and existing project/session for edit to the tsconfig; this entry installs nothing, builds no per-case contributor and starts no new host. A failed prerequisite state can block later dependent transitions.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity
 *   Runs in the ordered SCENARIOS state machine on one host/producer-owned fixture. Original writes and restorations remain intact; another host or producer owns a separate mutable directory. The worker closes the session in finally after success or failure.
 * @evidence contracts/e2e.md#preserved-coverage
 *   The original edit to the tsconfig method body is retained as this addressable function, including all conditions and assertions. Only registration changes; runScenarios still names the case and reports pre/post records, host output and available worker diagnostics on failure.
 */
export async function test_host_edit_to_the_tsconfig({ project, session }) {
  // The tsconfig is a compiler input of every module: a plugin entry it
  // gains changes the output, and the edit is heard through the config
  // chain the generation registered.
  project.change("FOURTEENTH");
  await session.settled("edit before the tsconfig", "FOURTEENTH", [
    project.input,
  ]);
  project.configure("CONFIGURED");
  await session.settled("edit to the tsconfig", "CONFIGURED", [
    project.tsconfig,
  ]);
  project.configure(undefined);
  await session.settled("tsconfig restored", "FOURTEENTH", [
    project.tsconfig,
  ]);
}
