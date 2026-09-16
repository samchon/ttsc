import { TestProject, TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { observeReloadEvents, waitFor } from "./adapter-vite-serve";

/**
 * Verifies Vite serves and refreshes compiler-only inputs without resolving imports.
 *
 * A transform dependency is allowed to be a server module, declaration, or
 * arbitrary asset. A real watching server must never run runtime resolvers for
 * those inputs, and both environment caches must react to their edits.
 *
 * 1. Serve a type-only consumer with a resolver that rejects compiler inputs.
 * 2. Edit, remove, and restore its dependency without touching the consumer.
 * 3. Assert client/SSR invalidation, recovery, and restart on the same plugin.
 */
export async function assertViteCompilerInputIsolation(): Promise<void> {
  const { createServer } = TestUnpluginProject.REQUIRE_FROM_UNPLUGIN("vite");
  const adapter = await TestUnpluginRuntime.loadUnpluginAdapter("vite");
  const root = fs.realpathSync.native(TestUnpluginProject.createProject({
    source: 'import type { Secret } from "./secret.server";\nexport const value: string = goUpper("plugin");\n',
    plugins: [
      { transform: "./plugin.cjs", name: "reader", operation: "read-configured-helper", path: "src/secret.server.ts" },
      { transform: "./plugin.cjs", name: "dependencies", operation: "emit-dependencies", dependencies: ["src/secret.server.ts", "rules.txt", "node_modules/types-only/index.d.ts"] },
    ],
  }));
  const dependency = path.join(root, "src", "secret.server.ts");
  const declaration = path.join(root, "node_modules", "types-only", "index.d.ts");
  TestProject.writeFiles(root, {
    "src/secret.server.ts": 'export type Secret = "initial";\n',
    "rules.txt": "first",
    "node_modules/types-only/index.d.ts": "export interface External { first: string }\n",
  });
  let compilerResolutions = 0;
  const server = await createServer({
    appType: "custom", configFile: false, logLevel: "silent", root,
    optimizeDeps: { noDiscovery: true },
    plugins: [adapter(), {
      name: "compiler-input-boundary",
      enforce: "pre",
      resolveId(id: string) {
        if (/secret\.server|rules\.txt|types-only/.test(id)) {
          compilerResolutions += 1;
          throw new Error(`Compiler input entered the runtime resolver: ${id}`);
        }
      },
    }],
    server: { host: "127.0.0.1", port: 0, watch: { persistent: false } },
  });
  const request = (ssr = false) => server.transformRequest("/src/main.ts", { ssr });
  const nodes = async () => Promise.all(["client", "ssr"].map((name) =>
    server.environments[name].moduleGraph.getModuleByUrl("/src/main.ts")));
  try {
    await server.listen();
    const events = await observeReloadEvents(server);
    for (const ssr of [false, true]) assert.match((await request(ssr)).code, /INITIAL/);
    assert.equal(compilerResolutions, 0);
    const loaded = await nodes();
    for (const node of loaded) {
      assert.ok(node.transformResult);
      assert.equal(node.importedModules.size, 0, "compiler dependencies must not be runtime graph edges");
    }
    fs.writeFileSync(dependency, 'export type Secret = "updated";\n');
    await waitFor(() => loaded.every((node) => !node.transformResult), "client and SSR dependency invalidation");
    for (const ssr of [false, true]) assert.match((await request(ssr)).code, /UPDATED/);

    // node_modules is ignored by Vite's own watcher. The compiler's private
    // subscription must still invalidate its consumer.
    fs.appendFileSync(declaration, "export interface Added {}\n");
    await waitFor(() => loaded.every((node) => !node.transformResult), "external declaration invalidation");
    await request();
    fs.writeFileSync(path.join(root, "rules.txt"), "second");
    await waitFor(() => !loaded[0].transformResult, "non-module asset invalidation");
    await request();

    fs.unlinkSync(dependency);
    await waitFor(() => !loaded[0].transformResult, "dependency deletion");
    await assert.rejects(request(), /secret\.server/);
    events.length = 0;
    fs.writeFileSync(dependency, 'export type Secret = "recovered";\n');
    await waitFor(() => events.length !== 0, "failed transform recovery notification before refetch");
    assert.match((await request()).code, /RECOVERED/);
    await server.restart();
    assert.match((await request()).code, /RECOVERED/);
    const restarted = (await nodes())[0];
    fs.writeFileSync(dependency, 'export type Secret = "restarted";\n');
    await waitFor(() => !restarted.transformResult, "dependency edit after server restart");
    assert.match((await request()).code, /RESTARTED/);
    assert.equal(compilerResolutions, 0);
  } finally {
    await server.close();
  }
}
