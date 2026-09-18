import assert from "node:assert/strict";

import { startViteBuildSession } from "../../internal/adapter-vite-lifecycle/startViteBuildSession";

/**
 * Verifies `vite build --watch` reuses the generation across rebuilds
 * (samchon/ttsc#1301).
 *
 * `buildEnd` disposes the generation only where it means the session ended.
 * Under a watching build Rollup calls it at the end of every build phase, so
 * disposing there discarded the generation once per rebuild, independently of
 * the `buildStart` clear, which is why fixing one of the two sites alone left
 * this host recompiling the whole project per edit.
 *
 * 1. Start a watching build session.
 * 2. Run three rebuild passes that deliver every module without changing an input.
 * 3. Assert the project compiled once.
 */
export async function test_vite_build_watch_reuses_the_generation_across_rebuilds(): Promise<void> {
  const session = await startViteBuildSession(true);
  try {
    for (let rebuild = 0; rebuild < 3; rebuild += 1) {
      await session.startPass();
      for (const file of session.modules) {
        assert.ok(await session.deliver(file));
      }
      await session.endPass();
    }
    assert.equal(
      session.projectCompiles(),
      1,
      "every rebuild that changed no compiler input must reuse the one generation",
    );
  } finally {
    await session.close();
  }
}
