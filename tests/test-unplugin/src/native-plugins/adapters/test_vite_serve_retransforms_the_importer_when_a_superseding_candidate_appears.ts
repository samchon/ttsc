import assert from "node:assert/strict";
import fs from "node:fs";

import { createLinkedWorkspaceFixture } from "../../internal/adapter-vite-serve/createLinkedWorkspaceFixture";
import { mainModuleNode } from "../../internal/adapter-vite-serve/mainModuleNode";
import { observeReloadEvents } from "../../internal/adapter-vite-serve/observeReloadEvents";
import { requestMainModule } from "../../internal/adapter-vite-serve/requestMainModule";
import { startViteServer } from "../../internal/adapter-vite-serve/startViteServer";
import { waitFor } from "../../internal/adapter-vite-serve/waitFor";

/**
 * Verifies a dev server retransforms an importer when a missing resolution
 * candidate that would win appears.
 *
 * The compiler recorded an absent candidate that outranks the file it selected.
 * Creating that candidate changes which module the import resolves to, so the
 * adapter's compiler watcher must invalidate the importer and announce a
 * reload.
 *
 * 1. Start a dev server and request the entry module.
 * 2. Create the superseding TypeScript candidate.
 * 3. Assert the importer is invalidated and a full reload reaches the client.
 * 4. Request the entry module again.
 */
export async function test_vite_serve_retransforms_the_importer_when_a_superseding_candidate_appears(): Promise<void> {
  const fixture = createLinkedWorkspaceFixture();
  const server = await startViteServer(fixture);
  try {
    await requestMainModule(server);
    const node = await mainModuleNode(server);
    assert.ok(
      node.transformResult !== null && node.transformResult !== undefined,
      "the first request must leave a cached transform on the module node",
    );
    const events = await observeReloadEvents(server);

    fs.writeFileSync(
      fixture.supersedingSource,
      'export const linked: string = "ts";\n',
      "utf8",
    );
    await waitFor(
      () => node.transformResult === null || node.transformResult === undefined,
      "the importer to be invalidated after the candidate appeared",
    );
    await waitFor(
      () => events.length !== 0,
      "the HMR client to receive a reload",
    );
    assert.ok(
      events.some((event) => event.type === "full-reload"),
      "creating the superseding candidate must announce a full reload",
    );
    await requestMainModule(server);
  } finally {
    await server.close();
  }
}
