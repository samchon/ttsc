import assert from "node:assert/strict";
import { BROKEN_INPUT } from "../common.mjs";

/**
 * Verifies the actual host's initial failure and repair.
 *
 * The shared lifecycle batch invokes this entry in its existing watch session;
 * the observable is host output or its compiler verdict, not source layout.
 *
 * 1. Apply this scenario's edit to the batch-owned mutable project.
 * 2. Observe the host and assert the required result before the next transition.
 *
 * @evidence contracts/testing.md#behavioral-verification
 *   Starts on the broken fixture, expects its syntax/plugin error, writes FIRST and expects all four consumers to recover. Exact-count hosts must run one successful compile.
 * @evidence contracts/testing.md#independent-expectations
 *   Literal contract values and explicit error patterns derive from the fixture input or supported invalid-input behavior. The host result is compared against those literals, never a snapshot computed by the adapter.
 * @evidence contracts/testing.md#distinguishing-cases
 *   A failed initial delivery and its first repaired generation are both required; break_and_recover covers failure after a successful generation.
 * @evidence contracts/testing.md#execution-ownership
 *   This exported named E2E entry is selected through SCENARIOS by runScenarios in the packed worker, using its original inputs and failure identity. Actual installed hosts execute the delivery; no unit runner launches it.
 * @evidence contracts/e2e.md#necessary-boundary
 *   A failed initial delivery and its first repaired generation are both required; break_and_recover covers failure after a successful generation. Direct proof calls cannot establish the actual host event, cache or delivery connection exercised here.
 * @evidence contracts/e2e.md#shared-execution
 *   Reuses the worker's installed consumer, immutable native producers and existing project/session for initial failure and repair; this entry installs nothing, builds no per-case contributor and starts no new host. A failed prerequisite state can block later dependent transitions.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity
 *   Runs in the ordered SCENARIOS state machine on one host/producer-owned fixture. Original writes and restorations remain intact; another host or producer owns a separate mutable directory. The worker closes the session in finally after success or failure.
 * @evidence contracts/e2e.md#preserved-coverage
 *   The original initial failure and repair method body is retained as this addressable function, including all conditions and assertions. Only registration changes; runScenarios still names the case and reports pre/post records, host output and available worker diagnostics on failure.
 */
export async function test_host_initial_failure_and_repair({ project, session }) {
  // The session opened on a broken input.
  await session.failed("initial failure", BROKEN_INPUT);
  project.change("FIRST");
  await session.settled("first build", "FIRST", [project.input]);
  if (session.exactRuns)
    assert.equal(project.runs(), 1, "one compile for the four modules");
}
