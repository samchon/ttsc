import assert from "node:assert/strict";

import { startViteBuildSession } from "../../internal/adapter-vite-lifecycle/startViteBuildSession";

/**
 * Verifies a non-watching `vite build` keeps its generation for the app's next
 * environment build and releases it once no build follows (samchon/ttsc#1396).
 *
 * Vite builds an app's environments, client and SSR at least, back to back
 * through one plugin, and the adapter disposed the generation at each
 * `buildEnd`, so every environment compiled the whole project again. A
 * non-watching build's generation holds no watcher, so it now outlives the
 * build for a short grace. The next environment's pass proves it before serving
 * a module, and a generation nobody takes up within the grace is released, so a
 * process running repeated builds does not keep it.
 *
 * 1. Build one environment and then another right after it, and assert the project
 *    compiled once.
 * 2. Let the grace pass, build again, and assert the project compiles again.
 */
export async function test_vite_build_releases_the_generation_after_its_last_environment(): Promise<void> {
  const session = await startViteBuildSession(false);
  try {
    await session.startPass();
    assert.ok(await session.deliver(session.modules[0]!));
    await session.endPass();
    await session.startPass();
    assert.ok(await session.deliver(session.modules[1]!));
    assert.equal(
      session.projectCompiles(),
      1,
      "the next environment's build reuses the proven generation",
    );
    await session.endPass();

    await new Promise((resolve) => setTimeout(resolve, 2_500));
    await session.startPass();
    assert.ok(await session.deliver(session.modules[0]!));
    assert.equal(
      session.projectCompiles(),
      2,
      "a generation no build takes up within the grace is released",
    );
  } finally {
    await session.close();
  }
}
