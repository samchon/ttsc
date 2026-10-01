import { TestUnpluginProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { MetroWorkspace } from "../../../internal/metro/internal/MetroWorkspace";
import { prepareSnapshot, cacheKeyForRun, readMainSnapshot, workerSnapshotTrees } from "../../../internal/metro/internal/metro-snapshot";
import { TestMetroRuntime } from "../../../internal/metro/internal/metro-runtime";

/**
 * Verifies a Metro run's key carries the state of every plugin source a
 * previous run recorded, so a plugin's Go source edited in place re-keys the
 * next run (samchon/ttsc#1487).
 *
 * A plugin's binary is keyed on its source, so its output is a function of it,
 * but Metro's key hashed each recorded path's own state, and a directory's is
 * only its presence: after a plugin edit, a restart reused every module the old
 * binary produced. A recorded plugin source is now marked as one, and the key
 * carries its state. Exercises the real native compiler, so it runs where the
 * Go toolchain is present.
 *
 * 1. Run a transform whose plugin's Go source is the project's own copy, and
 *    assert the worker snapshot recorded that source as a tree.
 * 2. Prepare the next run, and assert the main snapshot carries the tree; write
 *    below the source's `node_modules`, and assert the key holds.
 * 3. Edit the plugin's Go source, and assert the key differs.
 *
 * @evidence contracts/testing.md#behavioral-verification After a real native transform records its copied Go source tree, ignored node_modules writes keep the key and appending to main.go changes it.
 * @evidence contracts/testing.md#independent-expectations The plugin-source build contract excludes node_modules and includes authored Go source, independently requiring equality then inequality.
 * @evidence contracts/testing.md#distinguishing-cases An ignored subtree is the negative control beside an authored Go edit in the same recorded tree.
 * @evidence contracts/testing.md#execution-ownership Called by test_e2e_metro, which is discovered under src/features and selected by the E2E Evidence claim; this exported scenario executes the compiled Metro package, while source units own its portable decisions.
 * @evidence contracts/e2e.md#necessary-boundary The compiler must publish the actual plugin producer source identity into Metro watch metadata; a prefilled snapshot cannot prove that delivery.
 * @evidence contracts/e2e.md#shared-execution One project and initial native transform establish the tree once. Both key comparisons reuse that observation and add no native rebuild; the immutable default fixture is copied only because this case must edit its own source. Its project is a slot of the experiment's single workspace, written or copied by MetroWorkspace instead of being created as a separate temporary directory.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Edits target the case-owned Go copy, preserving the shared immutable producer. Entering the slot replaces it, which removes any earlier snapshot, epoch and recorded input, and the experiment removes the whole workspace and verifies its absence once, after the last scenario.
 * @evidence contracts/e2e.md#preserved-coverage Recorded tree membership, ignored-write equality and authored-edit inequality remain; no source edit or supported negative control was dropped.
 */
export async function case_metro_cache_key_changes_when_a_recorded_plugin_source_changes(
  workspace: MetroWorkspace.IWorkspace,
): Promise<void> {
  const root = MetroWorkspace.enterProject(workspace);
  // The project's own copy of the plugin's source, edited below; the shared
  // fixture stays as every other test built it.
  const source = path.join(root, "go-plugin");
  fs.cpSync(TestUnpluginProject.pluginSource(root), source, {
    recursive: true,
  });
  fs.writeFileSync(
    path.join(root, "plugin.cjs"),
    'module.exports = (context) => ({ name: context.plugin.name, source: "./go-plugin" });\n',
  );
  const options = {
    upstreamTransformer: TestMetroRuntime.fakeUpstreamPathOnDisk(),
  };

  await prepareSnapshot(root);
  await TestMetroRuntime.runTransform({
    options,
    params: {
      src: TestUnpluginProject.mainSource(root),
      filename: "src/main.ts",
      options: { projectRoot: root },
    },
  });
  assert.ok(workerSnapshotTrees(root).includes(source), "recorded as a tree");

  await prepareSnapshot(root);
  assert.ok(readMainSnapshot(root).trees.includes(source));
  const before = await cacheKeyForRun(root, options);
  fs.mkdirSync(path.join(source, "node_modules"), { recursive: true });
  fs.writeFileSync(
    path.join(source, "node_modules", "ignored.go"),
    "package x\n",
  );
  assert.equal(
    await cacheKeyForRun(root, options),
    before,
    "a pruned write keeps the key",
  );
  fs.appendFileSync(path.join(source, "main.go"), "\n// edited\n");
  assert.notEqual(
    await cacheKeyForRun(root, options),
    before,
    "an edited plugin source re-keys the run",
  );
}
