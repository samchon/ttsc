import assert from "node:assert/strict";

/**
 * Verifies the actual host's edit between builds.
 *
 * The shared lifecycle batch invokes this entry in its existing watch session;
 * the observable is host output or its compiler verdict, not source layout.
 *
 * 1. Apply this scenario's edit to the batch-owned mutable project.
 * 2. Observe the host and assert the required result before the next transition.
 *
 * @evidence contracts/testing.md#behavioral-verification
 *   Writes SECOND after the FIRST build, expects current output, and requires the second successful compile on exact-count hosts. sharedEdit additionally requires one compile across supporting worker pools.
 * @evidence contracts/testing.md#independent-expectations
 *   Literal contract values and explicit error patterns derive from the fixture input or supported invalid-input behavior. The host result is compared against those literals, never a snapshot computed by the adapter.
 * @evidence contracts/testing.md#distinguishing-cases
 *   Distinguishes stale output, redundant per-module compiles and redundant per-worker compiles after a completed build.
 * @evidence contracts/testing.md#execution-ownership
 *   This exported named E2E entry is selected through SCENARIOS by runScenarios in the packed worker, using its original inputs and failure identity. Actual installed hosts execute the delivery; no unit runner launches it.
 * @evidence contracts/e2e.md#necessary-boundary
 *   Distinguishes stale output, redundant per-module compiles and redundant per-worker compiles after a completed build. Direct proof calls cannot establish the actual host event, cache or delivery connection exercised here.
 * @evidence contracts/e2e.md#shared-execution
 *   Reuses the worker's installed consumer, immutable native producers and existing project/session for edit between builds; this entry installs nothing, builds no per-case contributor and starts no new host. A failed prerequisite state can block later dependent transitions.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity
 *   Runs in the ordered SCENARIOS state machine on one host/producer-owned fixture. Original writes and restorations remain intact; another host or producer owns a separate mutable directory. The worker closes the session in finally after success or failure.
 * @evidence contracts/e2e.md#preserved-coverage
 *   The original edit between builds method body is retained as this addressable function, including all conditions and assertions. Only registration changes; runScenarios still names the case and reports pre/post records, host output and available worker diagnostics on failure.
 */
export async function test_host_edit_between_builds({ project, session }) {
  const before = project.runs();
  project.change("SECOND");
  await session.settled("edit between builds", "SECOND", [project.input]);
  if (session.exactRuns)
    assert.equal(
      project.runs(),
      2,
      "one compile shared across the rebuilt modules",
    );
  // A host with several compilers, or a pool of workers, still compiles
  // the edit once for all of them where its session says so.
  await session.sharedEdit?.(before);
}
