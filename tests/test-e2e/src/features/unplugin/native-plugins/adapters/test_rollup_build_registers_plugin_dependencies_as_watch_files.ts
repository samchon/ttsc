import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import path from "node:path";

import { hostToolDirectory } from "../../../../../../../packages/unplugin/lib/core/bridge/hostToolDirectory.js";
import { projectRecordFile } from "../../../../../../../packages/unplugin/lib/core/bridge/projectRecordFile.js";
import { readProjectRecordFile } from "../../../../../../../packages/unplugin/lib/core/bridge/readProjectRecordFile.js";
import { emitDependenciesPlugins } from "../../../../internal/unplugin/internal/transform-dependencies/emitDependenciesPlugins";

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
 *
 * @evidence contracts/testing.md#behavioral-verification Bundle output has PLUGIN; watchFiles contains one record, omits types.d.ts itself, and written record names it.
 * @evidence contracts/testing.md#independent-expectations Whole-project record contract requires record channel rather than raw input; production path/read helper means encoding bugs may be shared.
 * @evidence contracts/testing.md#distinguishing-cases Native plugin-reported type dependency versus ordinary module watch files.
 * @evidence contracts/testing.md#execution-ownership Native-plugin E2E entry test_rollup_build_registers_plugin_dependencies_as_watch_files is discovered under native-plugins/adapters by src/index.ts and @ttsc/test-e2e start; its body owns the cases above.
 * @evidence contracts/e2e.md#necessary-boundary Actual Rollup watchFiles assembly joins native plugin dependency metadata to adapter handover.
 * @evidence contracts/e2e.md#shared-execution Related deliveries reuse fixture and loaded adapter; additional passes/builds own the lifecycle, configuration or host differences above. Fixture builders reuse native artifacts through shared TTSC_CACHE_DIR.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private fixture project paths separate mutable inputs and project cache identity from other entries. Bundles close in finally; mutable sources and retained caches belong to this fixture. Tracked roots end at process exit.
 * @evidence contracts/e2e.md#preserved-coverage Retained assertions: bundle output has PLUGIN; watchFiles contains one record, omits types.d.ts itself, and written record names it. No portable assertion is transferred or waived; the stated boundary and oracle limitations remain.
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
    const expected = projectRecordFile(
      hostToolDirectory(process.cwd()),
      path.join(root, "tsconfig.json"),
    );
    const records = bundle.watchFiles.filter(
      (file: string) => path.resolve(file) === expected,
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
