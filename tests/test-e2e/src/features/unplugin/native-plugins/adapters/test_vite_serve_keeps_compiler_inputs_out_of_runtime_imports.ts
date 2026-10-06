import {
  TestProject,
  TestUnpluginProject,
  TestUnpluginRuntime,
} from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { FixtureFiles } from "../../../../internal/FixtureFiles";
import { assertFixtureDerivesMissingCandidate } from "../../../../internal/unplugin/internal/adapter-vite-serve/assertFixtureDerivesMissingCandidate";
import { observeReloadEvents } from "../../../../internal/unplugin/internal/adapter-vite-serve/observeReloadEvents";
import { waitFor } from "../../../../internal/unplugin/internal/adapter-vite-serve/waitFor";
import { positionOf } from "../../../../internal/unplugin/internal/source-map/positionOf";

/**
 * Verifies Vite serves and refreshes compiler-only inputs without resolving
 * imports.
 *
 * A transform dependency is allowed to be a server module, declaration, or
 * arbitrary asset. A real watching server must never run runtime resolvers for
 * those inputs, and both environment caches must react to their edits.
 *
 * 1. Serve a type-only consumer with a resolver that rejects compiler inputs.
 * 2. Edit, remove, and restore its dependency without touching the consumer.
 * 3. Assert client/SSR invalidation, recovery, and restart on the same plugin.
 *
 * @evidence contracts/testing.md#behavioral-verification Client and SSR start INITIAL with zero runtime resolution edges; edits yield UPDATED, external/asset changes invalidate, deletion rejects, recreation and restart yield RECOVERED/RESTARTED. The selected prepared island also requires the actual native banner in SSR delivered code and calls its authored fail function through the same real module runner; exact original line/column and message must survive that generated-line shift.
 * @evidence contracts/testing.md#independent-expectations Authored secret type literals fix output; a pre-resolver throws if compiler-only paths become runtime imports. positionOf reads the original new Error token rather than a source map or returned stack, and literal banner/message independently establish shift and executed throw.
 * @evidence contracts/testing.md#distinguishing-cases Client/SSR, node_modules declaration, non-module asset, delete/failure/recreate and server restart.
 * @evidence contracts/testing.md#execution-ownership Selected Vite invokes viteServeCorpus, which calls this body with its upfront island. One actual watching server and one restart serve compiler-only input transitions and the linked-package missing-candidate graph. The original actual transform proof additionally checks missing candidate/type-root predicates before requests; its native work is a real additional cost. Two fresh joined HMR clients distinguish type-root and superseding-candidate notifications. No per-case project or server is prepared.
 * @evidence contracts/e2e.md#necessary-boundary Actual Vite module graphs, HMR and native plugin inputs connect without fabricated runtime edges.
 * @evidence contracts/e2e.md#shared-execution Related deliveries reuse fixture and loaded adapter; additional passes/builds own the lifecycle, configuration or host differences above. Fixture builders reuse native artifacts through shared TTSC_CACHE_DIR.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private fixture project paths separate mutable inputs and project cache identity from other entries. Server closes in finally on success/failure; restart reuses only this fixture. Tracked roots end at process exit.
 * @evidence contracts/e2e.md#preserved-coverage Retains client/SSR literals, external/asset invalidation, failure/recovery, SSR attribution and restart. The prepared graph also preserves actual missing-candidate/type-root proof, successful cold/restarted candidate requests, the original1.6-second external-creation quiet twin and independently leased HMR full-reload plus importer invalidation for type-root and preferred-candidate appearance. Written linkage remains unexecuted until CI; one existing server/restart supplies these requests without another host.
 */
export async function test_vite_serve_keeps_compiler_inputs_out_of_runtime_imports(
  preparedRoot?: string,
  onServerClosed?: () => void,
): Promise<void> {
  const { createServer } = TestUnpluginProject.REQUIRE_FROM_UNPLUGIN("vite");
  const adapter = await TestUnpluginRuntime.loadUnpluginAdapter("vite");
  const root = fs.realpathSync.native(
    preparedRoot ??
      TestUnpluginProject.createProject({
        source:
          'import type { Secret } from "./secret.server";\nexport const value: string = goUpper("plugin");\n',
        plugins: [
          {
            transform: "./plugin.cjs",
            name: "reader",
            operation: "read-configured-helper",
            path: "src/secret.server.ts",
          },
          {
            transform: "./plugin.cjs",
            name: "dependencies",
            operation: "emit-dependencies",
            dependencies: [
              "src/secret.server.ts",
              "rules.txt",
              "node_modules/types-only/index.d.ts",
            ],
          },
        ],
      }),
  );
  const dependency = path.join(root, "src", "secret.server.ts");
  const declaration = path.join(
    root,
    "node_modules",
    "types-only",
    "index.d.ts",
  );
  if (preparedRoot === undefined)
    TestProject.writeFiles(
      root,
      FixtureFiles.read(
        "unplugin/vite_serve_keeps_compiler_inputs_out_of_runtime_imports/inputs-1",
      ),
    );
  let compilerResolutions = 0;
  const server = await createServer({
    appType: "custom",
    configFile: false,
    logLevel: "silent",
    root,
    // Vite's default legalComments:none removes even a compiler-produced
    // preamble. This attribution case deliberately preserves its authored
    // @preserve banner through the real downstream TypeScript transform.
    esbuild: { legalComments: "inline" },
    optimizeDeps: { noDiscovery: true },
    plugins: [
      adapter(),
      {
        name: "compiler-input-boundary",
        enforce: "pre",
        resolveId(id: string) {
          if (/secret\.server|rules\.txt|types-only/.test(id)) {
            compilerResolutions += 1;
            throw new Error(
              `Compiler input entered the runtime resolver: ${id}`,
            );
          }
        },
      },
    ],
    server: { host: "127.0.0.1", port: 0 },
  });
  const request = (ssr = false) =>
    server.transformRequest("/src/main.ts", { ssr });
  const nodes = async () =>
    Promise.all(
      ["client", "ssr"].map((name) =>
        server.environments[name].moduleGraph.getModuleByUrl("/src/main.ts"),
      ),
    );
  const failures: unknown[] = [];
  let clientJoined = true;
  let events: Awaited<ReturnType<typeof observeReloadEvents>> | undefined;
  try {
    await server.listen();
    const observedEvents = await observeReloadEvents(server);
    events = observedEvents;
    if (preparedRoot !== undefined) {
      try {
        await assertFixtureDerivesMissingCandidate({
          app: root,
          linkedPackage: path.join(root, "packages/linked-pkg"),
          mainFile: path.join(root, "src/candidates.ts"),
          typeRoot: path.join(root, "node_modules/@types"),
          missingCandidate: path.join(root, "node_modules/linked-pkg/index.ts"),
          supersedingSource: path.join(root, "packages/linked-pkg/index.ts"),
        });
        const candidate = await server.transformRequest("/src/candidates.ts");
        assert.ok(candidate);
        const node =
          await server.environments.client.moduleGraph.getModuleByUrl(
            "/src/candidates.ts",
          );
        assert.ok(node.transformResult);
        fs.writeFileSync(
          path.join(path.dirname(root), "vite-serve-unrelated.ts"),
          "export const unrelated = 1;\n",
        );
        await new Promise((resolve) => setTimeout(resolve, 1600));
        assert.ok(
          node.transformResult,
          "unrecorded external creation must preserve the actual cold candidate importer",
        );
      } catch (error) {
        failures.push(
          new Error("cold missing candidates and unrelated negative", {
            cause: error,
          }),
        );
      }
    }
    for (const ssr of [false, true])
      assert.match((await request(ssr)).code, /INITIAL/);
    if (preparedRoot !== undefined) {
      const authored = fs.readFileSync(path.join(root, "src/main.ts"), "utf8");
      const transformed = await request(true);
      assert.match(transformed.code, /SSR attribution banner/);
      const entry = await server.ssrLoadModule("/src/main.ts");
      assert.equal(typeof entry.fail, "function");
      let thrown: Error | undefined;
      try {
        entry.fail();
      } catch (error) {
        thrown = error as Error;
      }
      assert.ok(thrown instanceof Error);
      assert.equal(thrown.message, "authored");
      const position = positionOf(authored, "new Error");
      assert.match(
        thrown.stack ?? "",
        new RegExp(`main\\.ts:${position.line + 1}:${position.column + 1}\\b`),
      );
    }
    assert.equal(compilerResolutions, 0);
    const loaded = await nodes();
    for (const node of loaded) {
      assert.ok(node.transformResult);
      assert.equal(
        node.importedModules.size,
        0,
        "compiler dependencies must not be runtime graph edges",
      );
    }
    fs.writeFileSync(dependency, 'export type Secret = "updated";\n');
    await waitFor(
      () => loaded.every((node) => !node.transformResult),
      "client and SSR dependency invalidation",
    );
    for (const ssr of [false, true])
      assert.match((await request(ssr)).code, /UPDATED/);

    // node_modules is ignored by Vite's own watcher. The compiler's private
    // subscription must still invalidate its consumer.
    fs.appendFileSync(declaration, "export interface Added {}\n");
    await waitFor(
      () => loaded.every((node) => !node.transformResult),
      "external declaration invalidation",
    );
    await request();
    fs.writeFileSync(path.join(root, "rules.txt"), "second");
    await waitFor(
      () => !loaded[0].transformResult,
      "non-module asset invalidation",
    );
    await request();

    fs.unlinkSync(dependency);
    await waitFor(() => !loaded[0].transformResult, "dependency deletion");
    await assert.rejects(request(), /secret\.server/);
    events.length = 0;
    fs.writeFileSync(dependency, 'export type Secret = "recovered";\n');
    await waitFor(
      () => observedEvents.length !== 0,
      "failed transform recovery notification before refetch",
    );
    assert.match((await request()).code, /RECOVERED/);
    await server.restart();
    assert.match((await request()).code, /RECOVERED/);
    if (preparedRoot !== undefined) {
      const restartedCandidate =
        await server.transformRequest("/src/candidates.ts");
      assert.ok(
        restartedCandidate,
        "unchanged absent candidate must remain loadable after the actual server restart",
      );
      for (const [label, mutate] of [
        [
          "automatic type-root membership",
          () => {
            const generated = path.join(root, "node_modules/@types/generated");
            fs.mkdirSync(generated);
            fs.writeFileSync(
              path.join(generated, "index.d.ts"),
              "declare const generatedTypeRootMember: unique symbol;\n",
            );
          },
        ],
        [
          "superseding TypeScript candidate",
          () =>
            fs.writeFileSync(
              path.join(root, "packages/linked-pkg/index.ts"),
              'export const linked: string = "ts";\n',
            ),
        ],
      ] as const) {
        let candidateEvents:
          | Awaited<ReturnType<typeof observeReloadEvents>>
          | undefined;
        try {
          assert.ok(await server.transformRequest("/src/candidates.ts"));
          const node =
            await server.environments.client.moduleGraph.getModuleByUrl(
              "/src/candidates.ts",
            );
          assert.ok(node.transformResult);
          candidateEvents = await observeReloadEvents(server);
          mutate();
          await waitFor(
            () => !node.transformResult,
            label + " must invalidate its cached importer",
          );
          await waitFor(
            () =>
              candidateEvents!.some((event) => event.type === "full-reload"),
            label + " must send an actual HMR full reload",
          );
          assert.ok(await server.transformRequest("/src/candidates.ts"));
        } catch (error) {
          if (
            error instanceof AggregateError &&
            error.message === "HMR startup and closure"
          )
            clientJoined = false;
          failures.push(new Error(label, { cause: error }));
        } finally {
          try {
            await candidateEvents?.close();
          } catch (error) {
            clientJoined = false;
            failures.push(error);
          }
        }
      }
    }
    const restarted = (await nodes())[0];
    fs.writeFileSync(dependency, 'export type Secret = "restarted";\n');
    await waitFor(
      () => !restarted.transformResult,
      "dependency edit after server restart",
    );
    assert.match((await request()).code, /RESTARTED/);
    assert.equal(compilerResolutions, 0);
  } catch (error) {
    if (
      error instanceof AggregateError &&
      error.message === "HMR startup and closure"
    )
      clientJoined = false;
    failures.push(error);
  } finally {
    try {
      await events?.close();
    } catch (error) {
      clientJoined = false;
      failures.push(error);
    }
    try {
      await server.close();
      if (clientJoined) onServerClosed?.();
    } catch (error) {
      failures.push(error);
    }
  }
  if (failures.length)
    throw new AggregateError(
      failures,
      "watching Vite serve and owned client/server closure",
    );
}
