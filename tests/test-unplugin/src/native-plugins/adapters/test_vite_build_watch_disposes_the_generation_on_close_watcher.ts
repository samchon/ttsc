import assert from "node:assert/strict";

import { startViteBuildSession } from "../../internal/adapter-vite-lifecycle/startViteBuildSession";

/**
 * Verifies the retained generation is still disposed at the watch session's
 * real teardown.
 *
 * Retaining it across passes means nothing releases its directory watchers at a
 * pass boundary any more, so the boundary that does mean teardown has to. Of
 * the hooks a `vite build --watch` trace produces, `closeWatcher` is the only
 * one that fires exactly once.
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
