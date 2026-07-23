import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const { build: viteBuild, createServer: viteCreateServer } =
  TestUnpluginProject.REQUIRE_FROM_UNPLUGIN("vite");

/**
 * Asserts that running a real Vite build with the unplugin vite adapter
 * produces plugin-transformed output.
 *
 * Runs Vite with `write: false` and `logLevel: "silent"` so no files are
 * written and console output is suppressed; collects all chunk code via the
 * shared helper.
 */
async function assertViteAdapterTransformsSource() {
  const unpluginVite = await TestUnpluginRuntime.loadUnpluginAdapter("vite");
  const root = TestUnpluginProject.createProject();
  const output = await viteBuild({
    root,
    build: {
      minify: false,
      rollupOptions: {
        input: path.join(root, "src", "main.ts"),
      },
      write: false,
    },
    logLevel: "silent",
    plugins: [unpluginVite()],
  });

  const chunks = Array.isArray(output)
    ? output.flatMap((entry) => entry.output)
    : output.output;
  TestUnpluginProject.assertTransformedToPlugin(
    TestUnpluginProject.collectRollupOutputCode(chunks),
  );
}

/**
 * Asserts Vite serve does not treat its one startup `buildStart` as an HMR
 * generation boundary.
 *
 * Vite invokes that hook once when the development plugin container starts, not
 * once per file edit. A cache marked build-scoped there could return an
 * unserved module from the initial whole-project compilation after another
 * project input changed.
 */
async function assertViteServeValidatesFirstUseAfterStartup(): Promise<void> {
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
  const server = await viteCreateServer({
    appType: "custom",
    configFile: false,
    logLevel: "silent",
    optimizeDeps: { include: [], noDiscovery: true },
    plugins: [unpluginVite()],
    root,
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
    await assert.rejects(
      () => server.transformRequest("/src/lazy.ts"),
      /expected export const value/,
      "the first lazy request after an edit must validate the initial generation",
    );
  } finally {
    await server.close();
  }
}

export {
  assertViteAdapterTransformsSource,
  assertViteServeValidatesFirstUseAfterStartup,
};
