import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import path from "node:path";

import { emitDependenciesPlugins } from "../../internal/transform-dependencies/emitDependenciesPlugins";

const rollup = TestUnpluginProject.REQUIRE_FROM_UNPLUGIN("rollup").rollup;

/**
 * Verifies a plugin-reported dependency reaches a real Rollup bundle's
 * `watchFiles`.
 *
 * `watchFiles` is the channel Rollup's watch mode reads to decide what triggers
 * a rebuild. A dependency that reaches the transform but not this list is never
 * watched, so editing a type-only input would leave the bundle stale.
 *
 * 1. Configure a plugin that reports `src/types.d.ts` as a dependency.
 * 2. Bundle and generate with the Rollup adapter.
 * 3. Assert the output is transformed and `watchFiles` contains the dependency.
 */
export async function test_rollup_build_registers_plugin_dependencies_as_watch_files(): Promise<void> {
  const unpluginRollup =
    await TestUnpluginRuntime.loadUnpluginAdapter("rollup");
  const root = TestUnpluginProject.createProject({
    plugins: emitDependenciesPlugins(["src/types.d.ts"]),
  });
  const bundle = await rollup({
    input: TestUnpluginProject.mainFile(root),
    plugins: [unpluginRollup()],
  });
  try {
    const generated = await bundle.generate({ format: "esm" });
    TestUnpluginProject.assertTransformedToPlugin(
      TestUnpluginProject.collectRollupOutputCode(generated.output),
    );
    const expected = path.join(root, "src", "types.d.ts");
    assert.ok(
      bundle.watchFiles.some((file: string) => path.resolve(file) === expected),
      `watchFiles missing ${expected}: ${JSON.stringify(bundle.watchFiles)}`,
    );
  } finally {
    await bundle.close();
  }
}
