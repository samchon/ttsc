import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import path from "node:path";

import { emitDependenciesPlugins } from "../../internal/transform-dependencies/emitDependenciesPlugins";

const rollup = TestUnpluginProject.REQUIRE_FROM_UNPLUGIN("rollup").rollup;

/**
 * Verifies the adapter wiring end to end through a real rollup build: the
 * plugin-reported dependency lands in the bundle's `watchFiles`, which is the
 * exact channel watch-mode invalidation consumes.
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
