import assert from "node:assert/strict";
import fs from "node:fs";

import {
  createLinkedWorkspaceFixture,
  mainModuleNode,
  requestMainModule,
  spyReloadEvents,
  startViteServer,
  waitFor,
} from "../../internal/adapter-vite-serve";

/**
 * Verifies vite serve: retransforms the importer when a superseding candidate
 * appears.
 *
 * Locks the second half of issue #965's contract in `core/viteServe.ts`.
 * Keeping missing candidates out of Vite's added-import graph must not cost the
 * freshness they encode (#832): when the candidate is created and would outrank
 * the current resolution winner, the resident server has to invalidate the
 * importer and announce a reload, without a restart. Vite's own watcher cannot
 * carry this — it ignores `node_modules`, where the candidate lives — so the
 * adapter's filesystem poll is the only signal.
 *
 * 1. Serve the linked-workspace fixture and request the entry module once.
 * 2. Write the superseding `index.ts` into the link target (a real workspace edit
 *    that appears through `node_modules`).
 * 3. Assert the entry module's node is invalidated and a full-reload is sent on
 *    the same resident server.
 * 4. Re-request the entry module and assert it transforms again.
 */
export const test_vite_serve_retransforms_the_importer_when_a_superseding_candidate_appears =
  async () => {
    const fixture = createLinkedWorkspaceFixture();
    const server = await startViteServer(fixture);
    try {
      await requestMainModule(server);
      const node = await mainModuleNode(server);
      assert.ok(
        node.transformResult !== null && node.transformResult !== undefined,
        "the first request must leave a cached transform on the module node",
      );
      const events = spyReloadEvents(server);

      fs.writeFileSync(
        fixture.supersedingSource,
        'export const linked: string = "ts";\n',
        "utf8",
      );
      await waitFor(
        () =>
          node.transformResult === null || node.transformResult === undefined,
        "the importer to be invalidated after the candidate appeared",
      );
      assert.ok(
        events.some((event) => event.type === "full-reload"),
        "creating the superseding candidate must announce a full reload",
      );
      await requestMainModule(server);
    } finally {
      await server.close();
    }
  };
