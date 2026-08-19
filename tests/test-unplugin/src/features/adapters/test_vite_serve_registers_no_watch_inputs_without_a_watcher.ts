import assert from "node:assert/strict";

import {
  collectServeWatchRegistrations,
  createLinkedWorkspaceFixture,
} from "../../internal/adapter-vite-serve";

/**
 * Verifies vite serve: a server without a watcher receives no registration.
 *
 * `server.watch: null` disables Vite's watcher outright, which is how a
 * one-shot consumer configures the dev server (`vitest --run` sets exactly
 * that). No change event can then reach the module graph, so every registration
 * is inert, and it is not free: Vite's import analysis resolves each registered
 * path like a real import of the transformed module, once per module, which is
 * the per-delivery cost behind samchon/ttsc#1246. The adapter's own
 * missing-input poll is unaffected; the sibling candidate scenarios pin that
 * half.
 *
 * 1. Resolve the adapter against a serve config whose server has no watcher.
 * 2. Transform the fixture's entry module through the adapter's own hook.
 * 3. Assert nothing was registered.
 */
export const test_vite_serve_registers_no_watch_inputs_without_a_watcher =
  async () => {
    const fixture = createLinkedWorkspaceFixture();
    const watched = await collectServeWatchRegistrations(fixture, {
      watching: false,
    });
    assert.deepEqual(
      watched,
      [],
      `a watcherless server must receive no watch-input registration; watched: ${watched.join(", ")}`,
    );
  };
