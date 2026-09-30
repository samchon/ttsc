import assert from "node:assert/strict";

import { startViteBuildSession } from "../../internal/adapter-vite-lifecycle/startViteBuildSession";

/**
 * Verifies a watcher closed mid-rebuild does not strand the container counter.
 *
 * `closeWatcher` has to replace the container owner set, not merely zero the
 * count beside it. A watcher closed while a build phase is open leaves that
 * container registered, so its later `buildEnd` decrements a counter that is
 * already zero, and a count below zero can never reach zero again, which kills
 * `buildEnd` disposal for the rest of the plugin's life. That only shows once a
 * non-watching session follows, the shape a host reusing one plugin across
 * configurations produces, and a pass left open at teardown is what Ctrl+C
 * during a rebuild leaves behind.
 *
 * 1. Deliver a module in a watching pass, then close the watcher before ending the
 *    pass.
 * 2. Resolve the same plugin as an ordinary build and run a pass.
 * 3. Let the release grace pass, and assert the following pass compiles again, so
 *    `buildEnd` disposal still works (samchon/ttsc#1396).
 *
 * @evidence contracts/testing.md#behavioral-verification Mid-pass close then late buildEnd permits ordinary-build release and raises compile counts one, two, three.
 * @evidence contracts/testing.md#independent-expectations Counts after the fixed grace expose stranded negative ownership; identical output alone would miss it.
 * @evidence contracts/testing.md#distinguishing-cases Open watch pass interrupted, late end, configuration switch and subsequent non-watch release.
 * @evidence contracts/testing.md#execution-ownership Native-plugin E2E entry test_vite_close_watcher_mid_pass_keeps_the_counter_sound is discovered under native-plugins/adapters by src/index.ts and @ttsc/test-unplugin start; its body owns the cases above.
 * @evidence contracts/e2e.md#necessary-boundary Built Vite hooks/native ownership execute with explicit interruption order; Ctrl+C itself is not sent.
 * @evidence contracts/e2e.md#shared-execution Related deliveries reuse fixture and loaded adapter; additional passes/builds own the lifecycle, configuration or host differences above. Fixture builders reuse native artifacts through shared TTSC_CACHE_DIR.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private fixture project paths separate mutable inputs and project cache identity from other entries. Session closes in finally, including assertion failure; its changed inputs and compile log remain private. Tracked roots end at process exit.
 * @evidence contracts/e2e.md#preserved-coverage Retained assertions: mid-pass close then late buildEnd permits ordinary-build release and raises compile counts one, two, three. No portable assertion is transferred or waived; the stated boundary and oracle limitations remain.
 */
export async function test_vite_close_watcher_mid_pass_keeps_the_counter_sound(): Promise<void> {
  const session = await startViteBuildSession(true);
  try {
    await session.startPass();
    assert.ok(await session.deliver(session.modules[0]!));
    assert.equal(session.projectCompiles(), 1);

    // Teardown arrives with the pass still open, then that pass's own buildEnd
    // lands afterwards against a counter the teardown already zeroed.
    await session.close();
    await session.endPass();

    // An ordinary build on the same instance: here buildEnd is the disposal
    // site, and it can only fire if the counter still reaches zero.
    session.resolveAs(false);
    await session.startPass();
    assert.ok(await session.deliver(session.modules[0]!));
    assert.equal(session.projectCompiles(), 2);
    await session.endPass();

    // The ended build keeps its generation for the next environment's build
    // until the release grace passes, and only a counter back at zero lets the
    // release begin.
    await new Promise((resolve) => setTimeout(resolve, 2_500));
    await session.startPass();
    assert.ok(await session.deliver(session.modules[0]!));
    assert.equal(
      session.projectCompiles(),
      3,
      "a mid-pass teardown must leave the container counter able to reach zero again",
    );
  } finally {
    await session.close();
  }
}
