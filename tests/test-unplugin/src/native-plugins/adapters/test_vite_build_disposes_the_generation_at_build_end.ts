import assert from "node:assert/strict";

import { startViteBuildSession } from "../../internal/adapter-vite-lifecycle/startViteBuildSession";

/**
 * Verifies an ordinary `vite build` still disposes its generation at
 * `buildEnd`.
 *
 * The disposal boundary turns on whether the host is watching, not on which
 * command it is running. Vite takes Rollup's watcher only when `build.watch` is
 * set; an ordinary build closes its bundle instead and never emits
 * `closeWatcher`, so gating the `buildEnd` reset on `command === "serve"` alone
 * would leave a one-shot build with no disposal site at all, and a process that
 * runs repeated programmatic builds accumulating one live generation and its
 * directory watchers per build.
 */
export async function test_vite_build_disposes_the_generation_at_build_end(): Promise<void> {
  const session = await startViteBuildSession(false);
  try {
    await session.startPass();
    assert.ok(await session.deliver(session.modules[0]!));
    assert.equal(session.projectCompiles(), 1);
    await session.endPass();

    // No `closeWatcher` here: an ordinary build never emits one. If `buildEnd`
    // did not dispose, this delivery would reuse the generation instead.
    await session.startPass();
    assert.ok(await session.deliver(session.modules[0]!));
    assert.equal(
      session.projectCompiles(),
      2,
      "a non-watching build must dispose at buildEnd, so the next session compiles again",
    );
  } finally {
    await session.close();
  }
}
