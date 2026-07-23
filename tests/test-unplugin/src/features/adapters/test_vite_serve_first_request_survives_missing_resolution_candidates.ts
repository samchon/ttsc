import {
  assertFixtureDerivesMissingCandidate,
  createLinkedWorkspaceFixture,
  requestMainModule,
  startViteServer,
} from "../../internal/adapter-vite-serve";

/**
 * Verifies vite serve: first request survives missing resolution candidates.
 *
 * Locks the serve-side split in `core/index.ts`'s transform `addWatchFile`
 * callback. Vite's `TransformPluginContext.addWatchFile` records every
 * registration in `_addedImports`, and `vite:import-analysis` resolves those
 * entries like real imports of the transformed module; a missing superseding
 * resolution candidate then fails that resolve and turns the first request of a
 * correctly transformed module into a 500 (issue #965, reproduced from
 * `wrtnlabs/autobe-mcp#663`). Missing inputs must bypass the added-import graph
 * in serve.
 *
 * 1. Build a pnpm-shaped linked workspace package whose resolution winner is
 *    `index.js`, so `node_modules/linked-pkg/index.ts` is a missing
 *    higher-priority candidate; prove the adapter derives it as a watch input.
 * 2. Start a real Vite dev server with the ttsc adapter.
 * 3. Request the entry module once and assert it transforms instead of failing on
 *    the absent candidate.
 */
export const test_vite_serve_first_request_survives_missing_resolution_candidates =
  async () => {
    const fixture = createLinkedWorkspaceFixture();
    await assertFixtureDerivesMissingCandidate(fixture);
    const server = await startViteServer(fixture);
    try {
      await requestMainModule(server);
    } finally {
      await server.close();
    }
  };
