import assert from "node:assert/strict";

import { collectServeWatchRegistrations } from "../../../../internal/unplugin/internal/adapter-vite-serve/collectServeWatchRegistrations";
import { createLinkedWorkspaceFixture } from "../../../../internal/unplugin/internal/adapter-vite-serve/createLinkedWorkspaceFixture";

/**
 * Verifies the Vite adapter registers no watch inputs when serve runs without a
 * watcher.
 *
 * With `server.watch: null`, as `vitest --run` configures it, nothing can
 * deliver a change event. Vite's import analysis would resolve every registered
 * path like a runtime import, so any registration is pure cost.
 *
 * 1. Create the linked workspace fixture.
 * 2. Drive the adapter's hooks with `command: "serve"` and `server.watch: null`,
 *    collecting every watch registration.
 * 3. Assert nothing was registered.
 *
 * @evidence contracts/testing.md#behavioral-verification Driven serve hooks configured watch:null collect an empty watch registration array.
 * @evidence contracts/testing.md#independent-expectations A watcherless host has no event channel, so registering compiler inputs has no valid observer.
 * @evidence contracts/testing.md#distinguishing-cases Watcher disabled on linked workspace; watching invalidation is separately exercised.
 * @evidence contracts/testing.md#execution-ownership Native-plugin E2E entry test_vite_serve_registers_no_watch_inputs_without_a_watcher is discovered under native-plugins/adapters by src/index.ts and @ttsc/test-unplugin start; its body owns the cases above.
 * @evidence contracts/e2e.md#necessary-boundary Built Vite adapter and real native linked fixture execute with captured addWatchFile, not a live server.
 * @evidence contracts/e2e.md#shared-execution Related deliveries reuse fixture and loaded adapter; additional passes/builds own the lifecycle, configuration or host differences above. Fixture builders reuse native artifacts through shared TTSC_CACHE_DIR.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The linked fixture has private project identity. collectServeWatchRegistrations ends its lifecycle in finally even on failed transform; tracked roots end at process exit. No live server or cancellation path is exercised.
 * @evidence contracts/e2e.md#preserved-coverage Retained assertions: driven serve hooks configured watch:null collect an empty watch registration array. No portable assertion is transferred or waived; the stated boundary and oracle limitations remain.
 */
export async function test_vite_serve_registers_no_watch_inputs_without_a_watcher(): Promise<void> {
  const fixture = createLinkedWorkspaceFixture();
  const watched = await collectServeWatchRegistrations(fixture, {
    watching: false,
  });
  assert.deepEqual(
    watched,
    [],
    `a watcherless server must receive no watch-input registration; watched: ${watched.join(", ")}`,
  );
}
