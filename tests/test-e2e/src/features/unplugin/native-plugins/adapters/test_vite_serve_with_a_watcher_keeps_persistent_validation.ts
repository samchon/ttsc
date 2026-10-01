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
 * @evidence contracts/testing.md#execution-ownership Native-plugin E2E entry test_vite_serve_with_a_watcher_keeps_persistent_validation is discovered under native-plugins/adapters by src/index.ts and @ttsc/test-unplugin start; its body owns the cases above.
 * @evidence contracts/e2e.md#necessary-boundary Driven watching Vite hooks connect native cache to persistent validation; live notifications are covered by server cases.
 * @evidence contracts/e2e.md#shared-execution Related deliveries reuse fixture and loaded adapter; additional passes/builds own the lifecycle, configuration or host differences above. Fixture builders reuse native artifacts through shared TTSC_CACHE_DIR.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private fixture project paths separate mutable inputs and project cache identity from other entries. Session closes in finally, including assertion failure; its changed inputs and compile log remain private. Tracked roots end at process exit.
 * @evidence contracts/e2e.md#preserved-coverage Retained assertions: after plugin edit all remaining modules deliver with exactly two compiles, reusing replacement. No portable assertion is transferred or waived; the stated boundary and oracle limitations remain.
 */
export async function test_vite_serve_with_a_watcher_keeps_persistent_validation(): Promise<void> {
  const session = await startViteAdapterSession({ watching: true });
  try {
    assert.ok(await session.deliver(session.modules[0]!));
    assert.equal(session.projectCompiles(), 1);

    touchUnrelatedInput(session);
    for (const file of session.modules.slice(1)) {
      assert.ok(await session.deliver(file));
    }
    assert.equal(
      session.projectCompiles(),
      2,
      "a watching dev server must replace the generation the changed input invalidated, then reuse the replacement",
    );
  } finally {
    await session.close();
  }
}
