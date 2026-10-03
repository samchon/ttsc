import path from "node:path";
import { write } from "../common.mjs";

/**
 * Verifies the actual host's new root file.
 *
 * The shared lifecycle batch invokes this entry in its existing watch session;
 * the observable is host output or its compiler verdict, not source layout.
 *
 * 1. Apply this scenario's edit to the batch-owned mutable project.
 * 2. Observe the host and assert the required result before the next transition.
 *
 * @evidence contracts/testing.md#behavioral-verification
 *   Adds an included declaration without changing module inputs, requires a new compile and unchanged THIRTEENTH output.
 * @evidence contracts/testing.md#independent-expectations
 *   Literal contract values and explicit error patterns derive from the fixture input or supported invalid-input behavior. The host result is compared against those literals, never a snapshot computed by the adapter.
 * @evidence contracts/testing.md#distinguishing-cases
 *   Runs membership-capable hosts; new root membership must be observed even when no loaded module changes.
 * @evidence contracts/testing.md#execution-ownership
 *   This exported named E2E entry is selected through SCENARIOS by runScenarios in the packed worker, using its original inputs and failure identity. Actual installed hosts execute the delivery; no unit runner launches it.
 * @evidence contracts/e2e.md#necessary-boundary
 *   Runs membership-capable hosts; new root membership must be observed even when no loaded module changes. Direct proof calls cannot establish the actual host event, cache or delivery connection exercised here.
 * @evidence contracts/e2e.md#shared-execution
 *   Reuses the worker's installed consumer, immutable native producers and existing project/session for new root file; this entry installs nothing, builds no per-case contributor and starts no new host. A failed prerequisite state can block later dependent transitions.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity
 *   Runs in the ordered SCENARIOS state machine on one host/producer-owned fixture. Original writes and restorations remain intact; another host or producer owns a separate mutable directory. The worker closes the session in finally after success or failure.
 * @evidence contracts/e2e.md#preserved-coverage
 *   The original new root file method body is retained as this addressable function, including all conditions and assertions. Only registration changes; runScenarios still names the case and reports pre/post records, host output and available worker diagnostics on failure.
 */
export async function test_host_new_root_file({ project, session }) {
  // A root file appearing changes no compiler input the modules read, so
  // only the project's root-file membership hears it; the generation is
  // compiled again and every module keeps its value.
  const before = project.runs();
  write(
    project.root,
    "src/contract-extra.d.ts",
    "declare const extra: 1;\n",
  );
  await session.recompiled("new root file", before, [
    path.join(project.root, "src", "contract-extra.d.ts"),
  ]);
  await session.settled("value after a new root file", "THIRTEENTH", []);
}
