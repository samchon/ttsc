import assert from "node:assert/strict";
import fs from "node:fs";

import { createLinkedWorkspaceFixture } from "../../../../internal/unplugin/internal/adapter-vite-serve/createLinkedWorkspaceFixture";
import { mainModuleNode } from "../../../../internal/unplugin/internal/adapter-vite-serve/mainModuleNode";
import { observeReloadEvents } from "../../../../internal/unplugin/internal/adapter-vite-serve/observeReloadEvents";
import { requestMainModule } from "../../../../internal/unplugin/internal/adapter-vite-serve/requestMainModule";
import { startViteServer } from "../../../../internal/unplugin/internal/adapter-vite-serve/startViteServer";
import { waitFor } from "../../../../../../utils/src/internal/waitFor";

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
 *
 * @evidence contracts/testing.md#behavioral-verification Preferred candidate creation clears cached importer, sends full-reload and permits another entry request.
 * @evidence contracts/testing.md#independent-expectations Resolver priority of fixture supersedingSource fixes invalidation requirement; literal HMR event type checks notification.
 * @evidence contracts/testing.md#distinguishing-cases Missing preferred path becoming real, cached importer invalidation and subsequent request.
 * @evidence contracts/testing.md#execution-ownership The ordinary index selects nine batch entries and does not import this retained standalone declaration. If explicitly invoked under an owned test entry, test_vite_serve_retransforms_the_importer_when_a_superseding_candidate_appears owns the actual server and client phases above; Evidence selection alone is not runtime coverage.
 * @evidence contracts/e2e.md#necessary-boundary Actual Vite server/compiler watcher/HMR client connection detects missing-candidate subscription loss.
 * @evidence contracts/e2e.md#shared-execution One server and fixture serve requests and mutations, with replacement only for restart assertions; shared native artifacts do not replace the cold request.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private fixture project paths separate mutable inputs and project cache identity from other entries. Original client and server closes are attempted independently in finally; body and closure failures retain their own causes. Restart reuses only this fixture. Tracked roots end at process exit.
 * @evidence contracts/e2e.md#preserved-coverage Retained assertions: preferred candidate creation clears cached importer, sends full-reload and permits another entry request. No portable assertion is transferred or waived; the stated boundary and oracle limitations remain.
 */
export async function test_vite_serve_retransforms_the_importer_when_a_superseding_candidate_appears(): Promise<void> {
  const fixture = createLinkedWorkspaceFixture();
  const server = await startViteServer(fixture);
  const failures: unknown[] = [];
  let events: Awaited<ReturnType<typeof observeReloadEvents>> | undefined;
  try {
    await requestMainModule(server);
    const node = await mainModuleNode(server);
    assert.ok(
      node.transformResult !== null && node.transformResult !== undefined,
      "the first request must leave a cached transform on the module node",
    );
    events = await observeReloadEvents(server);

    fs.writeFileSync(
      fixture.supersedingSource,
      'export const linked: string = "ts";\n',
      "utf8",
    );
    await waitFor(
      () => node.transformResult === null || node.transformResult === undefined,
      "the importer to be invalidated after the candidate appeared",
      { check: () => events!.check() },
    );
    await waitFor(
      () => events!.length !== 0,
      "the HMR client to receive a reload",
      { check: () => events!.check() },
    );
    assert.ok(
      events!.some((event) => event.type === "full-reload"),
      "creating the superseding candidate must announce a full reload",
    );
    await requestMainModule(server);
  } catch (error) {
    failures.push(error);
  } finally {
    const closes = await Promise.allSettled([
      Promise.resolve().then(() => events?.close()),
      Promise.resolve().then(() => server.close()),
    ]);
    for (const close of closes) if (close.status === "rejected") failures.push(close.reason);
  }
  if (failures.length) throw new AggregateError(failures, "Vite delivery and original client/server closes");
}
