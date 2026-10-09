import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import type { IViteServeCandidateFixture } from "../../../../internal/unplugin/internal/adapter-vite-serve/IViteServeCandidateFixture";
import { assertFixtureDerivesMissingCandidate } from "../../../../internal/unplugin/internal/adapter-vite-serve/assertFixtureDerivesMissingCandidate";
import { createLinkedWorkspaceFixture } from "../../../../internal/unplugin/internal/adapter-vite-serve/createLinkedWorkspaceFixture";
import { mainModuleNode } from "../../../../internal/unplugin/internal/adapter-vite-serve/mainModuleNode";
import { observeReloadEvents } from "../../../../internal/unplugin/internal/adapter-vite-serve/observeReloadEvents";
import { requestMainModule } from "../../../../internal/unplugin/internal/adapter-vite-serve/requestMainModule";
import { startViteServer } from "../../../../internal/unplugin/internal/adapter-vite-serve/startViteServer";
import { waitFor } from "../../../../../../utils/src/internal/waitFor";

/**
 * Verifies one real dev-server lifetime tracks missing candidates, replacement
 * containers and automatic type-root membership.
 *
 * The first request registers absent candidates with the adapter's own compiler
 * watcher, not with Vite's module graph. A new automatic type package changes
 * which declarations every file sees, so it must invalidate the importer and
 * reach the client even though no source file changed.
 *
 * 1. Start a dev server over a fixture whose graph derives a missing candidate.
 * 2. Request the entry module and observe its cached transform.
 * 3. Create an unrelated file outside the app and preserve the cached transform
 *    across several fallback poll intervals, then restart with candidates
 *    absent.
 * 4. Create a type-root member and then the preferred TypeScript candidate;
 *    independently require importer invalidation, full reload and refetch.
 *
 * @evidence contracts/testing.md#behavioral-verification Cold server request caches nonempty code; unrelated creation preserves it after 1600ms. Restart still answers with the preferred candidate absent. Adding generated/index.d.ts and then preferred index.ts separately invalidates the current importer, announces full-reload and permits refetch.
 * @evidence contracts/testing.md#independent-expectations Fixture graph proves missing candidate and new automatic type package changes visible declarations independently of source edits.
 * @evidence contracts/testing.md#distinguishing-cases Cold startup, an unrelated negative creation, unchanged missing candidates during replacement, automatic type-root membership and a superseding candidate are separate ordered phases. Each positive phase starts with an explicit entry request and a new HMR client so an earlier reload cannot satisfy it.
 * @evidence contracts/testing.md#execution-ownership The ordinary index selects nine batch entries and does not import this retained standalone declaration. If explicitly invoked under an owned test entry, test_vite_serve_first_request_survives_missing_resolution_candidates owns the actual server and client phases above; Evidence selection alone is not runtime coverage.
 * @evidence contracts/e2e.md#necessary-boundary Real Vite server/native watcher/HMR connection observes missing candidates and type-root membership absent from runtime imports; restart replaces the actual plugin container while the old container retires.
 * @evidence contracts/e2e.md#shared-execution Four compatible Vite serve histories share their byte-identical linked-package baseline, one missing-candidate proof, one server start and one required restart. The negative creation precedes all compiler-input mutations; both positive mutations preserve the same compiler options and consumer identity.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Original client and server closes are attempted independently in finally; body and closure failures retain their own causes. Independent phase errors are collected; replacement failure explicitly blocks its dependent positive phases. Each positive phase refetches before mutation and observes a new HMR client. The type-root member remains valid during candidate creation; no expected candidate or reload is inferred from the earlier phase. Tracked roots end at runner exit.
 * @evidence contracts/e2e.md#preserved-coverage Cold, type-root, unrelated-creation, unchanged-candidate restart and preferred-candidate assertions execute here. The three original companion entries remain selectable until this combined lifetime passes actual validation; no boundary is certified by this implementation alone.
 */
export async function test_vite_serve_first_request_survives_missing_resolution_candidates(
  preparedFixture?: IViteServeCandidateFixture,
): Promise<void> {
  const fixture = preparedFixture ?? createLinkedWorkspaceFixture();
  await assertFixtureDerivesMissingCandidate(fixture);
  const server = await startViteServer(fixture);
  const failures: Error[] = [];
  const clients: Awaited<ReturnType<typeof observeReloadEvents>>[] = [];
  const observe = async (label: string, body: () => Promise<void>) => {
    try {
      await body();
      return true;
    } catch (error) {
      failures.push(new Error(label, { cause: error }));
      return false;
    }
  };
  try {
    await requestMainModule(server);
    const node = await mainModuleNode(server);
    assert.ok(
      node.transformResult !== null && node.transformResult !== undefined,
      "the first request must leave a cached transform on the module node",
    );
    await observe(
      "unrelated creation preserves the cold transform",
      async () => {
        fs.writeFileSync(
          path.join(path.dirname(fixture.app), "unrelated.ts"),
          "export const unrelated: number = 1;\n",
          "utf8",
        );
        await new Promise((resolve) => setTimeout(resolve, 1_600));
        assert.ok(
          node.transformResult !== null && node.transformResult !== undefined,
          "an unrelated file creation must not invalidate the entry module",
        );
      },
    );
    const restarted = await observe(
      "unchanged missing candidates after restart",
      async () => {
        await server.restart();
        await requestMainModule(server);
      },
    );

    if (restarted) {
      await observe("automatic type-root membership", async () => {
        await requestMainModule(server);
        const node = await mainModuleNode(server);
        assert.ok(
          node.transformResult !== null && node.transformResult !== undefined,
          "the first request must leave a cached transform on the module node",
        );
        const events = await observeReloadEvents(server);
        clients.push(events);
        const generatedTypes = path.join(fixture.typeRoot, "generated");
        fs.mkdirSync(generatedTypes);
        fs.writeFileSync(
          path.join(generatedTypes, "index.d.ts"),
          "declare const generatedTypeRootMember: unique symbol;\n",
          "utf8",
        );
        await waitFor(
          () =>
            node.transformResult === null || node.transformResult === undefined,
          "the importer to be invalidated after automatic type-root membership changed",
          { check: () => events.check() },
        );
        await waitFor(
          () => events.length !== 0,
          "the HMR client to receive a reload",
          { check: () => events.check() },
        );
        assert.ok(
          events.some((event) => event.type === "full-reload"),
          "changing automatic type-root membership must announce a full reload",
        );
        await requestMainModule(server);
      });
      await observe("superseding TypeScript candidate", async () => {
        await requestMainModule(server);
        const node = await mainModuleNode(server);
        assert.ok(
          node.transformResult !== null && node.transformResult !== undefined,
          "the first request must leave a cached transform on the module node",
        );
        const events = await observeReloadEvents(server);
        clients.push(events);
        fs.writeFileSync(
          fixture.supersedingSource,
          'export const linked: string = "ts";\n',
          "utf8",
        );
        await waitFor(
          () =>
            node.transformResult === null || node.transformResult === undefined,
          "the importer to be invalidated after the candidate appeared",
          { check: () => events.check() },
        );
        await waitFor(
          () => events.length !== 0,
          "the HMR client to receive a reload",
          { check: () => events.check() },
        );
        assert.ok(
          events.some((event) => event.type === "full-reload"),
          "creating the superseding candidate must announce a full reload",
        );
        await requestMainModule(server);
      });
    } else {
      failures.push(
        new Error("automatic type-root membership blocked by failed restart"),
      );
      failures.push(
        new Error("superseding TypeScript candidate blocked by failed restart"),
      );
    }
  } catch (error) {
    failures.push(new Error("Vite body", { cause: error }));
  } finally {
    const closes = await Promise.allSettled([
      ...clients.map((client) => Promise.resolve().then(() => client.close())),
      Promise.resolve().then(() => server.close()),
    ]);
    for (const close of closes) if (close.status === "rejected")
      failures.push(new Error("original Vite client/server closure", { cause: close.reason }));
  }
  if (failures.length !== 0)
    throw new AggregateError(
      failures,
      "Vite linked-workspace lifecycle failures",
    );
}
