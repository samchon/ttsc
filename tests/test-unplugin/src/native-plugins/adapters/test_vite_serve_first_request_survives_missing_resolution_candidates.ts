import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { assertFixtureDerivesMissingCandidate } from "../../internal/adapter-vite-serve/assertFixtureDerivesMissingCandidate";
import { createLinkedWorkspaceFixture } from "../../internal/adapter-vite-serve/createLinkedWorkspaceFixture";
import { mainModuleNode } from "../../internal/adapter-vite-serve/mainModuleNode";
import { observeReloadEvents } from "../../internal/adapter-vite-serve/observeReloadEvents";
import { requestMainModule } from "../../internal/adapter-vite-serve/requestMainModule";
import { startViteServer } from "../../internal/adapter-vite-serve/startViteServer";
import { waitFor } from "../../internal/adapter-vite-serve/waitFor";

/**
 * Verifies the first dev-server request succeeds with missing resolution
 * candidates and later tracks automatic type-root membership.
 *
 * The first request registers absent candidates with the adapter's own compiler
 * watcher, not with Vite's module graph. A new automatic type package changes
 * which declarations every file sees, so it must invalidate the importer and
 * reach the client even though no source file changed.
 *
 * 1. Start a dev server over a fixture whose graph derives a missing candidate.
 * 2. Request the entry module and observe its cached transform.
 * 3. Create a new package under the automatic type root.
 * 4. Assert the importer is invalidated, a full reload is announced, and the
 *    module can be requested again.
 */
export async function test_vite_serve_first_request_survives_missing_resolution_candidates(): Promise<void> {
  const fixture = createLinkedWorkspaceFixture();
  await assertFixtureDerivesMissingCandidate(fixture);
  const server = await startViteServer(fixture);
  try {
    await requestMainModule(server);
    const node = await mainModuleNode(server);
    assert.ok(
      node.transformResult !== null && node.transformResult !== undefined,
      "the first request must leave a cached transform on the module node",
    );
    const events = await observeReloadEvents(server);

    const generatedTypes = path.join(fixture.typeRoot, "generated");
    fs.mkdirSync(generatedTypes);
    fs.writeFileSync(
      path.join(generatedTypes, "index.d.ts"),
      "declare const generatedTypeRootMember: unique symbol;\n",
      "utf8",
    );
    await waitFor(
      () => node.transformResult === null || node.transformResult === undefined,
      "the importer to be invalidated after automatic type-root membership changed",
    );
    await waitFor(
      () => events.length !== 0,
      "the HMR client to receive a reload",
    );
    assert.ok(
      events.some((event) => event.type === "full-reload"),
      "changing automatic type-root membership must announce a full reload",
    );
    await requestMainModule(server);
  } finally {
    await server.close();
  }
}
