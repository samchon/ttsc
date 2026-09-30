

/**
 * Verifies the actual host's saved by an editor.
 *
 * The shared lifecycle batch invokes this entry in its existing watch session;
 * the observable is host output or its compiler verdict, not source layout.
 *
 * 1. Apply this scenario's edit to the batch-owned mutable project.
 * 2. Observe the host and assert the required result before the next transition.
 *
 * @evidence contracts/testing.md#behavioral-verification
 *   Atomically saves TWELFTH by writing a sibling and renaming it over the input, then expects current output.
 * @evidence contracts/testing.md#independent-expectations
 *   Literal contract values and explicit error patterns derive from the fixture input or supported invalid-input behavior. The host result is compared against those literals, never a snapshot computed by the adapter.
 * @evidence contracts/testing.md#distinguishing-cases
 *   Pins replacement/rename notifications rather than ordinary writes to an existing inode.
 * @evidence contracts/testing.md#execution-ownership
 *   This exported named E2E entry is selected through SCENARIOS by runScenarios in the packed worker, using its original inputs and failure identity. Actual installed hosts execute the delivery; no unit runner launches it.
 * @evidence contracts/e2e.md#necessary-boundary
 *   Pins replacement/rename notifications rather than ordinary writes to an existing inode. Direct proof calls cannot establish the actual host event, cache or delivery connection exercised here.
 * @evidence contracts/e2e.md#shared-execution
 *   Reuses the worker's installed consumer, immutable native producers and existing project/session for saved by an editor; this entry installs nothing, builds no per-case contributor and starts no new host. A failed prerequisite state can block later dependent transitions.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity
 *   Runs in the ordered SCENARIOS state machine on one host/producer-owned fixture. Original writes and restorations remain intact; another host or producer owns a separate mutable directory. The worker closes the session in finally after success or failure.
 * @evidence contracts/e2e.md#preserved-coverage
 *   The original saved by an editor method body is retained as this addressable function, including all conditions and assertions. Only registration changes; runScenarios still names the case and reports pre/post records, host output and available worker diagnostics on failure.
 */
export async function test_host_saved_by_an_editor({ project, session }) {
  await project.save("TWELFTH");
  await session.settled("saved by an editor", "TWELFTH", [project.input]);
}
