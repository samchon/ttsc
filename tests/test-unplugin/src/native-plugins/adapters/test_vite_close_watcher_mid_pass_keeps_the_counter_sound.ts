import assert from "node:assert/strict";

import { startViteBuildSession } from "../../internal/adapter-vite-lifecycle/startViteBuildSession";

/**
 * Verifies a watcher closed mid-rebuild does not strand the container counter.
 *
 * `closeWatcher` has to replace the container owner set, not merely zero the
 * count beside it. A watcher closed while a build phase is open leaves that
 * container still registered, so its later `buildEnd` takes the delete branch
 * and decrements a counter that is already zero. Stranded below zero the count
 * can never reach zero again, and the `buildEnd` disposal is dead for the rest
 * of that plugin instance's life.
 *
 * The consequence only becomes observable once a _non-watching_ session
 * follows, because `buildEnd` deliberately never disposes for a watching build.
 * So the instance is resolved again as an ordinary build, which is also the
 * shape a host that reuses one plugin across configurations produces. A pass
 * opened and never closed before teardown is what Ctrl+C during a rebuild
 * leaves behind.
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
