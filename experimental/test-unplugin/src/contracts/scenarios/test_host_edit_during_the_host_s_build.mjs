import path from "node:path";
import { write } from "../common.mjs";

/**
 * Verifies the actual host's edit during the host's build.
 *
 * The shared lifecycle batch invokes this entry in its existing watch session;
 * the observable is host output or its compiler verdict, not source layout.
 *
 * 1. Apply this scenario's edit to the batch-owned mutable project.
 * 2. Observe the host and assert the required result before the next transition.
 *
 * @evidence contracts/testing.md#behavioral-verification
 *   Touches mod1, waits for the actual host build-start seam, writes ELEVENTH and expects current output.
 * @evidence contracts/testing.md#independent-expectations
 *   Literal contract values and explicit error patterns derive from the fixture input or supported invalid-input behavior. The host result is compared against those literals, never a snapshot computed by the adapter.
 * @evidence contracts/testing.md#distinguishing-cases
 *   Runs only hosts exposing buildStarted; changing input during host compilation differs from changing it in the native producer.
 * @evidence contracts/testing.md#execution-ownership
 *   This exported named E2E entry is selected through SCENARIOS by runScenarios in the packed worker, using its original inputs and failure identity. Actual installed hosts execute the delivery; no unit runner launches it.
 * @evidence contracts/e2e.md#necessary-boundary
 *   Runs only hosts exposing buildStarted; changing input during host compilation differs from changing it in the native producer. Direct proof calls cannot establish the actual host event, cache or delivery connection exercised here.
 * @evidence contracts/e2e.md#shared-execution
 *   Reuses the worker's installed consumer, immutable native producers and existing project/session for edit during the host's build; this entry installs nothing, builds no per-case contributor and starts no new host. A failed prerequisite state can block later dependent transitions.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity
 *   Runs in the ordered SCENARIOS state machine on one host/producer-owned fixture. Original writes and restorations remain intact; another host or producer owns a separate mutable directory. The worker closes the session in finally after success or failure.
 * @evidence contracts/e2e.md#preserved-coverage
 *   The original edit during the host's build method body is retained as this addressable function, including all conditions and assertions. Only registration changes; runScenarios still names the case and reports pre/post records, host output and available worker diagnostics on failure.
 */
export async function test_host_edit_during_the_host_s_build({ project, session }) {
  // Touch a module the host itself watches, so the host builds; the input
  // is edited once the host reports that build started, while it runs.
  const started = session.buildStarted();
  write(
    project.root,
    "src/mod1.ts",
    "export const value = watchValue();\n// touched\n",
  );
  await started;
  project.change("ELEVENTH");
  await session.settled("edit during the host's build", "ELEVENTH", [
    path.join(project.root, "src", "mod1.ts"),
    project.input,
  ]);
}
