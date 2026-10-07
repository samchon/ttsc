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
 * verdict through the actual generation selector unit and the shared native
 * pool changed-input epoch.
 *
 * 1. Let a later configResolved hook disable watching, then request the entry
 *    from the middleware-mode dev server.
 * 2. Break the entry module on disk.
 * 3. Request a module not yet served and assert it comes from the starting
 *    generation.
 *
 * @evidence contracts/testing.md#behavioral-verification Real watcherless server serves lazy output from startup even after main is broken on disk.
 * @evidence contracts/testing.md#independent-expectations Authored lazy declaration remains valid; broken main would make a new compile fail.
 * @evidence contracts/testing.md#distinguishing-cases A post configResolved hook changes initially enabled watching to null, as one-shot Vitest does. First main request then first lazy request after another input changes distinguish the settled pass lifecycle from the stale watching decision. Direct lifecycle units cover reverse mutation, polling and build watching.
 * @evidence contracts/testing.md#execution-ownership The selected test_e2e_vite_batch calls viteServeCorpus, which calls this scenario on its prepared island after the watching server closes. This body owns the late hook, mutation and output assertions; it is not separately discovered.
 * @evidence contracts/e2e.md#necessary-boundary Real Vite middleware server executes watch:null lifecycle and native program reuse.
 * @evidence contracts/e2e.md#shared-execution One server and fixture serve requests and mutations, with replacement only for restart assertions; shared native artifacts do not replace the cold request.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private fixture project paths separate mutable inputs and project cache identity from other entries. Server closes in finally on success/failure; restart reuses only this fixture. Tracked roots end at process exit.
 * @evidence contracts/e2e.md#preserved-coverage Retained assertions: real watcherless server serves lazy output from startup even after main is broken on disk. No portable assertion is transferred or waived; the stated boundary and oracle limitations remain.
 */
export async function test_vite_serve_without_a_watcher_serves_the_startup_generation(
  preparedRoot?: string,
  onServerClosed?: () => void,
): Promise<void> {
  const unpluginVite = await TestUnpluginRuntime.loadUnpluginAdapter("vite");
  const plugins = [
    {
      transform: "./plugin.cjs",
      name: "fixture",
      operation: "echo-file",
      path: "src/lazy.ts",
    },
  ];
  const root = preparedRoot ?? TestUnpluginProject.createProject({ plugins });
  if (preparedRoot !== undefined) {
    const config = path.join(root, "tsconfig.json");
    const document = JSON.parse(fs.readFileSync(config, "utf8"));
    document.compilerOptions.plugins = plugins;
    fs.writeFileSync(config, JSON.stringify(document, null, 2));
  }
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
    plugins: [
      unpluginVite(),
      {
        name: "disable-watch-after-ttsc-resolution",
        enforce: "post",
        configResolved(config: { server: { watch: unknown } }) {
          assert.notEqual(config.server.watch, null);
          config.server.watch = null;
        },
      },
    ],
    root: viteRoot,
    server: { hmr: false, middlewareMode: true },
  });
  try {
    const first = await server.transformRequest("/src/main.ts");
    assert.ok(first, "Vite serve must transform the entry module");
    fs.writeFileSync(
      TestUnpluginProject.mainFile(root),
      preparedRoot === undefined
        ? "export const broken = true;\n"
        : 'export const broken: number = "authored type error";\n',
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
    onServerClosed?.();
  }
}
