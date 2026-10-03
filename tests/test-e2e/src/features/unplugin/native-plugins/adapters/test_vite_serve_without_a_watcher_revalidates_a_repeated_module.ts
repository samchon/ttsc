import assert from "node:assert/strict";

import { startViteAdapterSession } from "../../../../internal/unplugin/internal/adapter-vite-lifecycle/startViteAdapterSession";
import { touchUnrelatedInput } from "../../../../internal/unplugin/internal/adapter-vite-lifecycle/touchUnrelatedInput";

/**
 * Verifies the build-scoped shortcut still stops at a module's second delivery.
 *
 * `beginTtscTransformBuild` settles only a module's first delivery in a session
 * from the supplied source. A repeated request revalidates, because the bundler
 * asking again is the one signal a session without a watcher still has.
 *
 * 1. Start a watcherless serve session and deliver a module.
 * 2. Change a project input that every module's validation covers.
 * 3. Deliver the same module again and assert it compiles again.
 *
 * @evidence contracts/testing.md#behavioral-verification Same module delivered after plugin input changes raises project compile count from one to two.
 * @evidence contracts/testing.md#independent-expectations Fixture count log exposes replacement; repeated delivery is the watcherless session's explicit freshness signal.
 * @evidence contracts/testing.md#distinguishing-cases Second delivery after change versus first lazy delivery in build-scoped twin.
 * @evidence contracts/testing.md#execution-ownership Native-plugin E2E entry test_vite_serve_without_a_watcher_revalidates_a_repeated_module is discovered under native-plugins/adapters by src/index.ts and @ttsc/test-e2e start; its body owns the cases above.
 * @evidence contracts/e2e.md#necessary-boundary Driven watcherless Vite hooks connect native cache to repeated module requests.
 * @evidence contracts/e2e.md#shared-execution Related deliveries reuse fixture and loaded adapter; additional passes/builds own the lifecycle, configuration or host differences above. Fixture builders reuse native artifacts through shared TTSC_CACHE_DIR.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private fixture project paths separate mutable inputs and project cache identity from other entries. Session closes in finally, including assertion failure; its changed inputs and compile log remain private. Tracked roots end at process exit.
 * @evidence contracts/e2e.md#preserved-coverage Retained assertions: same module delivered after plugin input changes raises project compile count from one to two. No portable assertion is transferred or waived; the stated boundary and oracle limitations remain.
 */
export async function test_vite_serve_without_a_watcher_revalidates_a_repeated_module(): Promise<void> {
  const session = await startViteAdapterSession({ watching: false });
  try {
    const first = session.modules[0]!;
    assert.ok(await session.deliver(first));
    assert.equal(session.projectCompiles(), 1);

    touchUnrelatedInput(session);
    assert.ok(await session.deliver(first));
    assert.equal(
      session.projectCompiles(),
      2,
      "a module delivered twice in one watcherless session must validate on its second delivery",
    );
  } finally {
    await session.close();
  }
}
