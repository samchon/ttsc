import assert from "node:assert/strict";

import {
  createLinkedWorkspaceFixture,
  mainModuleNode,
  requestMainModule,
  startViteServer,
} from "../../internal/adapter-vite-serve";

/**
 * Verifies vite serve: a server without a watcher receives no added imports.
 *
 * `server.watch: null` disables Vite's watcher outright, which is how a
 * one-shot consumer configures the dev server (`vitest --run` sets exactly
 * that). No change event can then reach the module graph, so every registration
 * is inert — and Vite's import analysis resolves each registered path like a
 * real import of the transformed module, once per module, which is the
 * per-delivery cost behind samchon/ttsc#1246. The adapter's own missing-input
 * poll is unaffected; the sibling candidate scenarios pin that half.
 *
 * 1. Serve the linked-workspace fixture with `watch: null` (the default here).
 * 2. Request the entry module once.
 * 3. Assert its import edges carry no watch-input registration.
 */
export const test_vite_serve_registers_no_added_imports_without_a_watcher =
  async () => {
    const fixture = createLinkedWorkspaceFixture();
    const server = await startViteServer(fixture);
    try {
      await requestMainModule(server);
      const node = await mainModuleNode(server);
      const imported = [...(node.importedModules ?? [])].map(
        (entry: any) => entry.file?.toLowerCase() ?? "",
      );
      assert.ok(
        imported.every((file: string) => !file.endsWith("tsconfig.json")),
        `a watcherless server must receive no watch-input registration; imports: ${imported.join(", ")}`,
      );
    } finally {
      await server.close();
    }
  };
