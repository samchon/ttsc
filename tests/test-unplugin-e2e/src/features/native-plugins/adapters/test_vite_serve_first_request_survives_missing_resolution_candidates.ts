import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { assertFixtureDerivesMissingCandidate } from "../../../internal/adapter-vite-serve/assertFixtureDerivesMissingCandidate";
import { createLinkedWorkspaceFixture } from "../../../internal/adapter-vite-serve/createLinkedWorkspaceFixture";
import { mainModuleNode } from "../../../internal/adapter-vite-serve/mainModuleNode";
import { observeReloadEvents } from "../../../internal/adapter-vite-serve/observeReloadEvents";
import { requestMainModule } from "../../../internal/adapter-vite-serve/requestMainModule";
import { startViteServer } from "../../../internal/adapter-vite-serve/startViteServer";
import { waitFor } from "../../../internal/adapter-vite-serve/waitFor";

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
 *
 * @evidence contracts/testing.md#behavioral-verification Cold server request caches nonempty code; adding generated/index.d.ts under automatic type root invalidates importer, announces full-reload and permits refetch.
 * @evidence contracts/testing.md#independent-expectations Fixture graph proves missing candidate and new automatic type package changes visible declarations independently of source edits.
 * @evidence contracts/testing.md#distinguishing-cases Cold startup with missing candidates followed by automatic type-root membership creation.
 * @evidence contracts/testing.md#execution-ownership Native-plugin E2E entry test_vite_serve_first_request_survives_missing_resolution_candidates is discovered under native-plugins/adapters by src/index.ts and @ttsc/test-unplugin start; its body owns the cases above.
 * @evidence contracts/e2e.md#necessary-boundary Real Vite server/native watcher/HMR connection observes type-root membership absent from runtime imports.
 * @evidence contracts/e2e.md#shared-execution One server and fixture serve requests and mutations, with replacement only for restart assertions; shared native artifacts do not replace the cold request.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private fixture project paths separate mutable inputs and project cache identity from other entries. Server closes in finally on success/failure; restart reuses only this fixture. Tracked roots end at process exit.
 * @evidence contracts/e2e.md#preserved-coverage Retained assertions: cold server request caches nonempty code; adding generated/index.d.ts under automatic type root invalidates importer, announces full-reload and permits refetch. No portable assertion is transferred or waived; the stated boundary and oracle limitations remain.
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
