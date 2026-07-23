import {
  createLinkedWorkspaceFixture,
  requestMainModule,
  startViteServer,
} from "../../internal/adapter-vite-serve";

/**
 * Verifies vite serve: survives missing candidates after a server restart.
 *
 * Locks the attach/dispose ordering in `core/viteServe.ts`. Vite's
 * `restartServer` configures the replacement server first and closes the old
 * one afterwards, so the old container's `buildEnd` runs after the new server's
 * `configureServer`. A dispose that forgot the attached server at that point
 * would detach the replacement, send missing candidates back into the
 * added-import graph, and revive the 500 on the first request after every
 * restart of a programmatic (inline-plugin) server — the configuration shape
 * middleware-mode frameworks use.
 *
 * 1. Serve the linked-workspace fixture and request the entry module once.
 * 2. Restart the resident server (same plugin instance, new plugin container).
 * 3. Request the entry module again and assert it still transforms instead of
 *    failing on the absent candidate.
 */
export const test_vite_serve_survives_missing_candidates_after_a_server_restart =
  async () => {
    const fixture = createLinkedWorkspaceFixture();
    const server = await startViteServer(fixture);
    try {
      await requestMainModule(server);
      await server.restart();
      await requestMainModule(server);
    } finally {
      await server.close();
    }
  };
