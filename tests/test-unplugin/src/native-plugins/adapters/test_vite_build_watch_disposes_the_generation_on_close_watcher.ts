import assert from "node:assert/strict";

import { startViteBuildSession } from "../../internal/adapter-vite-lifecycle/startViteBuildSession";

/**
 * Verifies the retained generation is disposed at the watch session's real
 * teardown.
 *
 * Retaining the generation across passes means nothing releases its directory
 * watchers at a pass boundary any more, so the boundary that does mean teardown
 * has to. Of the hooks a `vite build --watch` trace produces, `closeWatcher` is
 * the only one that fires exactly once.
 *
 * 1. Start a watching build session and deliver a module in one pass.
 * 2. Close the watcher.
 * 3. Start a new pass and assert its delivery compiles again.
 *
 * @evidence contracts/testing.md#behavioral-verification Watching pass compiles once; closeWatcher followed by new delivery raises compile count to two.
 * @evidence contracts/testing.md#independent-expectations Native byte counter makes disposal observable despite identical source output.
 * @evidence contracts/testing.md#distinguishing-cases Build end retains state, watcher close invalidates state, next pass recreates it.
 * @evidence contracts/testing.md#execution-ownership Native-plugin E2E entry test_vite_build_watch_disposes_the_generation_on_close_watcher is discovered under native-plugins/adapters by src/index.ts and @ttsc/test-unplugin start; its body owns the cases above.
 * @evidence contracts/e2e.md#necessary-boundary Driven built Vite hooks connect closeWatcher to native cache ownership; no real build watcher runs here.
 * @evidence contracts/e2e.md#shared-execution Related deliveries reuse fixture and loaded adapter; additional passes/builds own the lifecycle, configuration or host differences above. Fixture builders reuse native artifacts through shared TTSC_CACHE_DIR.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private fixture project paths separate mutable inputs and project cache identity from other entries. Session closes in finally, including assertion failure; its changed inputs and compile log remain private. Tracked roots end at process exit.
 * @evidence contracts/e2e.md#preserved-coverage Retained assertions: watching pass compiles once; closeWatcher followed by new delivery raises compile count to two. No portable assertion is transferred or waived; the stated boundary and oracle limitations remain.
 */
export async function test_vite_build_watch_disposes_the_generation_on_close_watcher(): Promise<void> {
  const session = await startViteBuildSession(true);
  try {
    await session.startPass();
    assert.ok(await session.deliver(session.modules[0]!));
    assert.equal(session.projectCompiles(), 1);
    await session.endPass();

    await session.close();
    await session.startPass();
    assert.ok(await session.deliver(session.modules[0]!));
    assert.equal(
      session.projectCompiles(),
      2,
      "closeWatcher must dispose the generation, so the next session compiles again",
    );
  } finally {
    await session.close();
  }
}
