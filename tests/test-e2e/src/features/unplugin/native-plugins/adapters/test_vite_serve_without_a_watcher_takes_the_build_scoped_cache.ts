import assert from "node:assert/strict";

import { startViteAdapterSession } from "../../../../internal/unplugin/internal/adapter-vite-lifecycle/startViteAdapterSession";
import { touchUnrelatedInput } from "../../../../internal/unplugin/internal/adapter-vite-lifecycle/touchUnrelatedInput";

/**
 * Verifies a watcherless dev server settles each module's first delivery from
 * the supplied source alone (samchon/ttsc#1260).
 *
 * The session declared it will observe no edit, so it can neither learn of one
 * nor invalidate what one touched. Recompiling mid-session would only hand the
 * remaining modules a second compilation of the same program, so the session
 * keeps serving the generation it started from, exactly as a build does.
 *
 * 1. Start a watcherless serve session and deliver one module.
 * 2. Change a project input that every module's validation covers.
 * 3. Deliver every remaining module and assert the project compiled once.
 *
 * @evidence contracts/testing.md#behavioral-verification After first compile and plugin edit, all remaining modules deliver with total one compile.
 * @evidence contracts/testing.md#independent-expectations Run-log count and successful remaining outputs distinguish startup coherence from project revalidation.
 * @evidence contracts/testing.md#distinguishing-cases First deliveries of unseen modules after change; repeated-module twin requires replacement.
 * @evidence contracts/testing.md#execution-ownership Native-plugin E2E entry test_vite_serve_without_a_watcher_takes_the_build_scoped_cache is discovered under native-plugins/adapters by src/index.ts and @ttsc/test-e2e start; its body owns the cases above.
 * @evidence contracts/e2e.md#necessary-boundary Built Vite watcherless hooks and native cache execute in one driven session.
 * @evidence contracts/e2e.md#shared-execution Related deliveries reuse fixture and loaded adapter; additional passes/builds own the lifecycle, configuration or host differences above. Fixture builders reuse native artifacts through shared TTSC_CACHE_DIR.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private fixture project paths separate mutable inputs and project cache identity from other entries. Session closes in finally, including assertion failure; its changed inputs and compile log remain private. Tracked roots end at process exit.
 * @evidence contracts/e2e.md#preserved-coverage Retained assertions: after first compile and plugin edit, all remaining modules deliver with total one compile. No portable assertion is transferred or waived; the stated boundary and oracle limitations remain.
 */
export async function test_vite_serve_without_a_watcher_takes_the_build_scoped_cache(): Promise<void> {
  const session = await startViteAdapterSession({ watching: false });
  try {
    assert.ok(await session.deliver(session.modules[0]!));
    assert.equal(session.projectCompiles(), 1);

    touchUnrelatedInput(session);
    for (const file of session.modules.slice(1)) {
      assert.ok(await session.deliver(file));
    }
    assert.equal(
      session.projectCompiles(),
      1,
      "a watcherless serve session must deliver every remaining module from the one generation it already compiled",
    );
  } finally {
    await session.close();
  }
}
