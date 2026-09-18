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
 * 3. Assert the following pass compiles again, so `buildEnd` disposal still works.
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
