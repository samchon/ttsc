import assert from "node:assert/strict";

import { startViteAdapterSession } from "../../internal/adapter-vite-lifecycle/startViteAdapterSession";
import { touchUnrelatedInput } from "../../internal/adapter-vite-lifecycle/touchUnrelatedInput";

/**
 * Verifies a watching dev server keeps persistent validation.
 *
 * Its single `buildStart` spans every later edit, so the build-scoped shortcut
 * would serve a module compiled before an edit the server can observe and is
 * expected to hot-update. This is the negative twin of the watcherless case:
 * the same fixture, the same edit, the opposite verdict.
 *
 * 1. Start a watching serve session and deliver one module.
 * 2. Change a project input that every module's validation covers.
 * 3. Deliver every remaining module and assert exactly one replacement compile.
 */
export async function test_vite_serve_with_a_watcher_keeps_persistent_validation(): Promise<void> {
  const session = await startViteAdapterSession({ watching: true });
  try {
    assert.ok(await session.deliver(session.modules[0]!));
    assert.equal(session.projectCompiles(), 1);

    touchUnrelatedInput(session);
    for (const file of session.modules.slice(1)) {
      assert.ok(await session.deliver(file));
    }
    assert.equal(
      session.projectCompiles(),
      2,
      "a watching dev server must replace the generation the changed input invalidated, then reuse the replacement",
    );
  } finally {
    await session.close();
  }
}
