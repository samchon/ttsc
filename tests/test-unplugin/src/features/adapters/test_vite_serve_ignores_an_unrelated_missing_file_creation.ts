import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  createLinkedWorkspaceFixture,
  mainModuleNode,
  requestMainModule,
  startViteServer,
} from "../../internal/adapter-vite-serve";

/**
 * Verifies vite serve: ignores an unrelated missing file creation.
 *
 * The negative twin of the superseding-candidate invalidation: the adapter's
 * filesystem poll must fire only for paths the compiler recorded as resolution
 * candidates of a reachable importer. A file created anywhere else in the
 * project must not invalidate the entry module, or every incidental write would
 * storm the dev server with reloads.
 *
 * 1. Serve the linked-workspace fixture and request the entry module once.
 * 2. Create a new source file the entry module never imports.
 * 3. Wait past several poll intervals and assert the module node keeps its cached
 *    transform.
 */
export const test_vite_serve_ignores_an_unrelated_missing_file_creation =
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

      fs.writeFileSync(
        path.join(fixture.app, "src", "unrelated.ts"),
        "export const unrelated: number = 1;\n",
        "utf8",
      );
      // Several multiples of the 500ms poll interval: long enough for a
      // wrongly registered poller to have fired.
      await new Promise((resolve) => setTimeout(resolve, 1_600));
      assert.ok(
        node.transformResult !== null && node.transformResult !== undefined,
        "an unrelated file creation must not invalidate the entry module",
      );
    } finally {
      await server.close();
    }
  };
