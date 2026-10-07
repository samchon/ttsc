import { rename } from "../common.mjs";

/**
 * Verifies the actual host's dependency directory renamed away and back.
 *
 * The shared lifecycle batch invokes this entry in its existing watch session;
 * the observable is host output or its compiler verdict, not source layout.
 *
 * 1. Apply this scenario's edit to the batch-owned mutable project.
 * 2. Observe the host and assert the required result before the next transition.
 *
 * @evidence contracts/testing.md#behavioral-verification
 *   Renames the dependency directory away, expects TS2307, restores it and expects SIXTH.
 * @evidence contracts/testing.md#independent-expectations
 *   Literal contract values and explicit error patterns derive from the fixture input or supported invalid-input behavior. The host result is compared against those literals, never a snapshot computed by the adapter.
 * @evidence contracts/testing.md#distinguishing-cases
 *   Linked producers only; moving the parent directory emits no ordinary write to the observed dependency file.
 * @evidence contracts/testing.md#execution-ownership
 *   This exported named E2E entry is selected through SCENARIOS by runScenarios in the packed worker, using its original inputs and failure identity. Actual installed hosts execute the delivery; no unit runner launches it.
 * @evidence contracts/e2e.md#necessary-boundary
 *   Linked producers only; moving the parent directory emits no ordinary write to the observed dependency file. Direct proof calls cannot establish the actual host event, cache or delivery connection exercised here.
 * @evidence contracts/e2e.md#shared-execution
 *   Reuses the worker's installed consumer, immutable native producers and existing project/session for dependency directory renamed away and back; this entry installs nothing, builds no per-case contributor and starts no new host. A failed prerequisite state can block later dependent transitions.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity
 *   Runs in the ordered SCENARIOS state machine on one host/producer-owned fixture. Original writes and restorations remain intact; another host or producer owns a separate mutable directory. The worker closes the session in finally after success or failure.
 * @evidence contracts/e2e.md#preserved-coverage
 *   The original dependency directory renamed away and back method body is retained as this addressable function, including all conditions and assertions. Only registration changes; runScenarios still names the case and reports pre/post records, host output and available worker diagnostics on failure.
 */
export async function test_host_dependency_directory_renamed_away_and_back({ project, session }) {
  // The directory holding a dependency moves, which no watcher of the
  // file itself hears: the file's own path emits nothing when its parent
  // is renamed, only the parent's parent does.
  const away = `${project.depsDirectory}.moved`;
  await rename(project.depsDirectory, away, "dependency directory away");
  await session.failed(
    "dependency directory renamed away",
    /Cannot find module|TS2307/,
    [project.localDeclaration],
  );
  await rename(away, project.depsDirectory, "dependency directory back");
  await session.settled("dependency directory renamed back", "SIXTH", [
    project.localDeclaration,
  ]);
}
