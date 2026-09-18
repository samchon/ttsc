import assert from "node:assert/strict";

import { collectServeWatchRegistrations } from "../../internal/adapter-vite-serve/collectServeWatchRegistrations";
import { createLinkedWorkspaceFixture } from "../../internal/adapter-vite-serve/createLinkedWorkspaceFixture";

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
