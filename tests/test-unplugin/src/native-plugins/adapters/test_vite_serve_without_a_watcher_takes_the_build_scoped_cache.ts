import assert from "node:assert/strict";

import { startViteAdapterSession } from "../../internal/adapter-vite-lifecycle/startViteAdapterSession";
import { touchUnrelatedInput } from "../../internal/adapter-vite-lifecycle/touchUnrelatedInput";

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
