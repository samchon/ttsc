import assert from "node:assert/strict";
import path from "node:path";

import {
  createLinkedWorkspaceFixture,
  mainModuleNode,
  requestMainModule,
  startViteServer,
} from "../../internal/adapter-vite-serve";

/**
 * Verifies vite serve: keeps existing watch inputs in the added-import graph.
 *
 * The serve-side split in `core/index.ts` classifies by existence, not by
 * provenance: only inputs that are absent from disk bypass
 * `this.addWatchFile()`. An input that exists — the tsconfig chain above all —
 * must keep the ordinary registration, which Vite's import-analysis then
 * records as an import edge of the module, preserving HMR invalidation for
 * type-only and config inputs exactly as before the missing-candidate fix.
 *
 * 1. Serve the linked-workspace fixture and request the entry module once.
 * 2. Read the entry module's import edges from the client module graph.
 * 3. Assert the project tsconfig is among them.
 */
export const test_vite_serve_keeps_existing_watch_inputs_in_the_added_import_graph =
  async () => {
    const fixture = createLinkedWorkspaceFixture();
    const server = await startViteServer(fixture);
    try {
      await requestMainModule(server);
      const node = await mainModuleNode(server);
      const tsconfig = path
        .join(fixture.app, "tsconfig.json")
        .replace(/\\/g, "/")
        .toLowerCase();
      const imported = [...(node.importedModules ?? [])].map(
        (entry: any) => entry.file?.toLowerCase() ?? "",
      );
      assert.ok(
        imported.includes(tsconfig),
        `the existing tsconfig watch input must stay an added import; imports: ${imported.join(", ")}`,
      );
    } finally {
      await server.close();
    }
  };
