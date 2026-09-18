import assert from "node:assert/strict";

import { startViteAdapterSession } from "../../internal/adapter-vite-lifecycle/startViteAdapterSession";
import { touchUnrelatedInput } from "../../internal/adapter-vite-lifecycle/touchUnrelatedInput";

/**
 * Verifies the build-scoped shortcut still stops at a module's second delivery.
 *
 * `beginTtscTransformBuild` settles only a module's _first_ delivery in the
 * session from the supplied source; a repeated request revalidates, because the
 * bundler asking again is the one signal a session without a watcher still
 * has.
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
