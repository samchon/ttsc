import assert from "node:assert/strict";

import { startViteBuildSession } from "../../../../internal/unplugin/internal/adapter-vite-lifecycle/startViteBuildSession";

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
 *
 * @evidence contracts/testing.md#behavioral-verification Consecutive non-watching environment passes share one compile; a pass after 2.5 seconds compiles a second time.
 * @evidence contracts/testing.md#independent-expectations Run-log byte count distinguishes retention from release; unchanged fixture requires no replacement before grace.
 * @evidence contracts/testing.md#distinguishing-cases Immediate successive environments versus no consumer within release grace.
 * @evidence contracts/testing.md#execution-ownership Native-plugin E2E entry test_vite_build_releases_the_generation_after_its_last_environment is discovered under native-plugins/adapters by src/index.ts and @ttsc/test-e2e start; its body owns the cases above.
 * @evidence contracts/e2e.md#necessary-boundary Built adapter hooks and native generation execute in a driven build session, without live Vite environment scheduling.
 * @evidence contracts/e2e.md#shared-execution Related deliveries reuse fixture and loaded adapter; additional passes/builds own the lifecycle, configuration or host differences above. Fixture builders reuse native artifacts through shared TTSC_CACHE_DIR.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private fixture project paths separate mutable inputs and project cache identity from other entries. Session closes in finally, including assertion failure; its changed inputs and compile log remain private. Tracked roots end at process exit.
 * @evidence contracts/e2e.md#preserved-coverage Retained assertions: consecutive non-watching environment passes share one compile; a pass after 2.5 seconds compiles a second time. No portable assertion is transferred or waived; the stated boundary and oracle limitations remain.
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
