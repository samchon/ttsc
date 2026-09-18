import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const viteCreateServer =
  TestUnpluginProject.REQUIRE_FROM_UNPLUGIN("vite").createServer;

/**
 * Verifies a dev server with no watcher serves one consistent generation.
 *
 * A `server.watch: null` session has told Vite it will observe no file change,
 * so it has no way to learn of an edit, invalidate what the edit reached, or
 * hot-update a client. What persistent validation buys such a session is not
 * freshness but incoherence: modules delivered before an edit and after it
 * would come from two different compilations of one program. The build-scoped
 * lifecycle it takes instead (samchon/ttsc#1260) settles each module's first
 * delivery against the generation the session started from, the same contract
 * `vite build` already runs under.
 *
 * A watching dev server keeps the opposite verdict, because its single
 * `buildStart` really does span later edits it can observe and hot-update. That
 * invariant is pinned by the watching twin of this configuration in
 * `features/adapters/test_vite_serve_with_a_watcher_keeps_persistent_validation`.
 */
export async function test_vite_serve_without_a_watcher_serves_the_startup_generation(): Promise<void> {
  const unpluginVite = await TestUnpluginRuntime.loadUnpluginAdapter("vite");
  const root = TestUnpluginProject.createProject({
    plugins: [
      {
        transform: "./plugin.cjs",
        name: "fixture",
        operation: "echo-file",
        path: "src/lazy.ts",
      },
    ],
  });
  const lazy = path.join(root, "src", "lazy.ts");
  fs.writeFileSync(lazy, "export const lazy = 1;\n", "utf8");
  // Vite 7 resolves Windows temp roots to their long physical spelling and
  // cannot then load a URL from the 8.3 root spelling supplied by os.tmpdir().
  const viteRoot = fs.realpathSync.native(root);
  const server = await viteCreateServer({
    appType: "custom",
    configFile: false,
    logLevel: "silent",
    optimizeDeps: { include: [], noDiscovery: true },
    plugins: [unpluginVite()],
    root: viteRoot,
    server: { hmr: false, middlewareMode: true, watch: null },
  });
  try {
    const first = await server.transformRequest("/src/main.ts");
    assert.ok(first, "Vite serve must transform the entry module");
    fs.writeFileSync(
      TestUnpluginProject.mainFile(root),
      "export const broken = true;\n",
      "utf8",
    );
    const lazyResult = await server.transformRequest("/src/lazy.ts");
    assert.ok(
      lazyResult,
      "a watcherless session must answer an unserved module from the generation it started with",
    );
    assert.match(
      lazyResult.code,
      /export const lazy/,
      "the answer must be that generation's own output for the requested module",
    );
  } finally {
    await server.close();
  }
}
