import assert from "node:assert/strict";

import { startViteAdapterSession } from "../../../../internal/unplugin/internal/adapter-vite-lifecycle/startViteAdapterSession";
import { touchUnrelatedInput } from "../../../../internal/unplugin/internal/adapter-vite-lifecycle/touchUnrelatedInput";

/**
 * Verifies a watching dev server keeps persistent validation.
 *
 * Its single `buildStart` spans every later edit, so the build-scoped shortcut
 * would serve a module compiled before an edit the server can observe and is
 * expected to hot-update. This is the negative twin of the watcherless case:
 * the same fixture, the same edit, the opposite verdict.
 *
 * 1. Start a watching serve session and deliver one module.
 * 2. Change a project input that every module's validation covers.
 * 3. Deliver every remaining module and assert exactly one replacement compile.
 *
 * @evidence contracts/testing.md#behavioral-verification After plugin edit all remaining modules deliver with exactly two compiles, reusing replacement.
 * @evidence contracts/testing.md#independent-expectations Native count log establishes one replacement and no per-module recompilation.
 * @evidence contracts/testing.md#distinguishing-cases Watching configuration on same edit as watcherless twin produces opposite freshness result.
 * @evidence contracts/testing.md#execution-ownership Native-plugin E2E entry test_vite_serve_with_a_watcher_keeps_persistent_validation is discovered under native-plugins/adapters by src/index.ts and @ttsc/test-e2e start; its body owns the cases above.
 * @evidence contracts/e2e.md#necessary-boundary Driven watching Vite hooks connect native cache to persistent validation; live notifications are covered by server cases.
 * @evidence contracts/e2e.md#shared-execution The shared experiment borrows the original four-module descriptor/project/run log after watcherless hook closure and exact original descriptor-byte restoration. A new watching hook session retains the original one-replacement contrast; standalone still prepares its own project.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Borrowed inputs are restored before session start; count1/2 are deltas from the actual preceding native log length without resetting the log. First watching delivery validates the restored descriptor before the identical original touch invalidates it. Finally awaits close on success/failure. Only successful return permits the parent to restore the descriptor and retain surplus modules before its two-worker profile; hook completion is not descendant closure.
 * @evidence contracts/e2e.md#preserved-coverage Retained assertions: after plugin edit all remaining modules deliver with exactly two compiles, reusing replacement. No portable assertion is transferred or waived; the stated boundary and oracle limitations remain.
 */
export async function test_vite_serve_with_a_watcher_keeps_persistent_validation(
  prepared?: { root: string; runLog: string },
): Promise<void> {
  const session = await startViteAdapterSession({ watching: true, project: prepared });
  const baseline = session.projectCompiles();
  try {
    assert.ok(await session.deliver(session.modules[0]!));
    assert.equal(session.projectCompiles() - baseline, 1);

    touchUnrelatedInput(session);
    for (const file of session.modules.slice(1)) {
      assert.ok(await session.deliver(file));
    }
    assert.equal(
      session.projectCompiles() - baseline,
      2,
      "a watching dev server must replace the generation the changed input invalidated, then reuse the replacement",
    );
  } finally {
    await session.close();
  }
}
