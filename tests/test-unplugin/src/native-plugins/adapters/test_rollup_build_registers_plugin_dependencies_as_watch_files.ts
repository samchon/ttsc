import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import path from "node:path";

import { readProjectRecordFile } from "../../../../../packages/unplugin/lib/core/bridge/readProjectRecordFile.js";
import { emitDependenciesPlugins } from "../../internal/transform-dependencies/emitDependenciesPlugins";

const rollup = TestUnpluginProject.REQUIRE_FROM_UNPLUGIN("rollup").rollup;

/**
 * Verifies a real Rollup bundle's `watchFiles` carries the project's record,
 * and that the record names a plugin-reported dependency.
 *
 * `watchFiles` is the channel Rollup's watch mode reads to decide what triggers
 * a rebuild. The adapter hands it the record alone beside the module: the
 * record moves when any input of the generation changes, the type-only
 * dependency a plugin reported among them, so editing that input rebuilds
 * without Rollup watching it, and a dependency that reached the transform but
 * not the record would never be observed.
 *
 * 1. Configure a plugin that reports `src/types.d.ts` as a dependency.
 * 2. Bundle and generate with the Rollup adapter.
 * 3. Assert the output is transformed, `watchFiles` contains the record and no
 *    compiler input, and the record names the dependency.
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
    const dependency = path.join(root, "src", "types.d.ts");
    const records = bundle.watchFiles.filter((file: string) =>
      /[\\/]records[\\/][0-9a-f]{32}\.json$/.test(file),
    );
    assert.equal(
      records.length,
      1,
      `watchFiles carry one record: ${JSON.stringify(bundle.watchFiles)}`,
    );
    assert.equal(
      bundle.watchFiles.some(
        (file: string) => path.resolve(file) === dependency,
      ),
      false,
      "no compiler input reaches watchFiles",
    );
    const record = readProjectRecordFile(records[0]!);
    assert.ok(record !== undefined, "the record is written");
    assert.ok(
      Object.prototype.hasOwnProperty.call(record.inputs, dependency),
      `the record names ${dependency}`,
    );
  } finally {
    await bundle.close();
  }
}
