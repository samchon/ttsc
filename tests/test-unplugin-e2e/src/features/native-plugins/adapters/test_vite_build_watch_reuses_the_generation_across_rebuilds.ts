import assert from "node:assert/strict";

import { startViteBuildSession } from "../../../internal/adapter-vite-lifecycle/startViteBuildSession";

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
 *
 * @evidence contracts/testing.md#behavioral-verification Three watching passes deliver all four modules and finish with one native compile.
 * @evidence contracts/testing.md#independent-expectations Fixture run log records compilations independently of returned cache output.
 * @evidence contracts/testing.md#distinguishing-cases Repeated unchanged passes across buildStart/buildEnd; close-disposal has a companion.
 * @evidence contracts/testing.md#execution-ownership Native-plugin E2E entry test_vite_build_watch_reuses_the_generation_across_rebuilds is discovered under native-plugins/adapters by src/index.ts and @ttsc/test-unplugin start; its body owns the cases above.
 * @evidence contracts/e2e.md#necessary-boundary Built Vite lifecycle hooks and native cache run under simulated Rollup watch order.
 * @evidence contracts/e2e.md#shared-execution Related deliveries reuse fixture and loaded adapter; additional passes/builds own the lifecycle, configuration or host differences above. Fixture builders reuse native artifacts through shared TTSC_CACHE_DIR.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private fixture project paths separate mutable inputs and project cache identity from other entries. Session closes in finally, including assertion failure; its changed inputs and compile log remain private. Tracked roots end at process exit.
 * @evidence contracts/e2e.md#preserved-coverage Retained assertions: three watching passes deliver all four modules and finish with one native compile. No portable assertion is transferred or waived; the stated boundary and oracle limitations remain.
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
