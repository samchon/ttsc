import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const viteCreateServer =
  TestUnpluginProject.REQUIRE_FROM_UNPLUGIN("vite").createServer;

/**
 * Verifies a real Vite dev server with no watcher serves one consistent
 * generation.
 *
 * A `server.watch: null` session has told Vite it will observe no file change,
 * so it can neither learn of an edit nor hot-update a client. Persistent
 * validation would buy such a session incoherence rather than freshness:
 * modules delivered before and after an edit would come from two compilations
 * of one program. The build-scoped lifecycle it takes instead
 * (samchon/ttsc#1260) settles each module's first delivery against the
 * generation the session started from. The watching twin keeps the opposite
 * verdict in `test_vite_serve_with_a_watcher_keeps_persistent_validation`.
 *
 * 1. Start a middleware-mode dev server with `watch: null` and request the entry
 *    module.
 * 2. Break the entry module on disk.
 * 3. Request a module not yet served and assert it comes from the starting
 *    generation.
 *
 * @evidence contracts/testing.md#behavioral-verification Real watcherless server serves lazy output from startup even after main is broken on disk.
 * @evidence contracts/testing.md#independent-expectations Authored lazy declaration remains valid; broken main would make a new compile fail.
 * @evidence contracts/testing.md#distinguishing-cases First main request then first lazy request after another input changes.
 * @evidence contracts/testing.md#execution-ownership Native-plugin E2E entry test_vite_serve_without_a_watcher_serves_the_startup_generation is discovered under native-plugins/adapters by src/index.ts and @ttsc/test-e2e start; its body owns the cases above.
 * @evidence contracts/e2e.md#necessary-boundary Real Vite middleware server executes watch:null lifecycle and native program reuse.
 * @evidence contracts/e2e.md#shared-execution One server and fixture serve requests and mutations, with replacement only for restart assertions; shared native artifacts do not replace the cold request.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private fixture project paths separate mutable inputs and project cache identity from other entries. Server closes in finally on success/failure; restart reuses only this fixture. Tracked roots end at process exit.
 * @evidence contracts/e2e.md#preserved-coverage Retained assertions: real watcherless server serves lazy output from startup even after main is broken on disk. No portable assertion is transferred or waived; the stated boundary and oracle limitations remain.
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
