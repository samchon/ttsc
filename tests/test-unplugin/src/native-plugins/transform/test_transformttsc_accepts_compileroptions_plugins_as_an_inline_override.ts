import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies `compilerOptions.plugins` passed through `resolveOptions` applies
 * when the tsconfig declares no plugins.
 *
 * A host can configure plugins inline instead of in the tsconfig. The overlay
 * must reach the compile, or those plugins would silently never run.
 *
 * 1. Create a project whose tsconfig declares no plugins.
 * 2. Transform with the fixture plugin in `compilerOptions.plugins`.
 * 3. Assert the output is transformed.
 */
export async function test_transformttsc_accepts_compileroptions_plugins_as_an_inline_override(): Promise<void> {
  const { resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const root = TestUnpluginProject.createProject({ plugins: [] });
  const result = await transformTtsc(
    TestUnpluginProject.mainFile(root),
    TestUnpluginProject.mainSource(root),
    resolveOptions({
      compilerOptions: {
        plugins: [{ transform: "./plugin.cjs", name: "fixture" }],
      },
    }),
  );

  assert.ok(result);
  assert.match(result.code, /"PLUGIN"/);
}
