import { TestUnpluginProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { MetroWorkspace } from "../../../internal/metro/internal/MetroWorkspace";
import { TestMetroRuntime } from "../../../internal/metro/internal/metro-runtime";
import {
  cacheKeyForRun,
  listWorkerSnapshots,
  prepareSnapshot,
  readMainSnapshot,
  workerSnapshotFiles,
  workerSnapshotTrees,
} from "../../../internal/metro/internal/metro-snapshot";

/**
 * Verifies the two-run acceptance reproduction of samchon/ttsc#721, out-of-walk
 * direction: a transform input outside the project root (the shape of
 * `node_modules` declarations and monorepo sibling sources) is recorded by run
 * 1, compacted into the main snapshot, and re-hashed by the next run's key, so
 * editing only that external file re-keys the run.
 *
 * No project walk can see this class of input; only the reference-graph channel
 * (samchon/ttsc#718) can prove it relevant. Exercises the real native compiler,
 * so it runs where the Go toolchain is present (CI).
 *
 * 1. Run 1 transforms a project whose plugin reads and reports a file outside the
 *    project root; assert the worker snapshot recorded it.
 * 2. Prepare the next run (compaction): the main snapshot carries the path;
 *    compute the key.
 * 3. Edit only the external file: a fresh run's key differs and its transform
 *    carries the regenerated output.
 *
 * @evidence contracts/testing.md#behavioral-verification Native reader/reporter output records the exact external/config input set and Go source tree, compaction retains the external path, its edit changes the key and output becomes PLUGIN:SECOND.
 * @evidence contracts/testing.md#independent-expectations The authored external helper, exact project/config paths and FIRST/SECOND markers independently identify dependency observation and regeneration.
 * @evidence contracts/testing.md#distinguishing-cases An external helper absent from the project walk contrasts in-project invalidation; exact recorded sets reject over-recording, and repeated unchanged-input key equality prevents fallback nonce alone from satisfying edit inequality.
 * @evidence contracts/testing.md#execution-ownership test_e2e_metro invokes this selected scenario. TestMetroRuntime uses the built transformer when TTSC_TEST_LAYER is not unit, and an authored echo upstream exposes delivered text; this is not an actual Metro server or OS worker harness. The source-layer override is not boundary execution proof.
 * @evidence contracts/e2e.md#necessary-boundary Actual plugin metadata and transformed output must traverse compiler-to-Unplugin-to-Metro delivery before an out-of-walk input can be guarded.
 * @evidence contracts/e2e.md#shared-execution One project and reader/reporter descriptors serve both external states through the selected shared plugin producer. Two awaited transform calls and compaction/key operations do not certify native process, Program generation or cache-hit totals. Fresh transformer query imports are suite-process modules, not additional OS workers; no separate fixture producer is prepared per marker.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity External and project slots are replaced before use; only the authored external helper then changes. TestMetroRuntime awaits transform results and restores transformer option env in finally; the parent collector attempts remaining cases and separately aggregates workspace removal. These returns/path removals are not independent arbitrary-descendant or loaded-image witnesses.
 * @evidence contracts/e2e.md#preserved-coverage Exact worker file set, native source-tree membership, compaction worker-empty/main membership, changed key and FIRST/SECOND output markers remain. Echo upstream is an authored observation port, not actual Metro host coverage; built-layer selection, registration, cost measurement and survivor execution remain unverified.
 */
export async function case_metro_cache_key_changes_when_a_recorded_external_input_changes(
  workspace: MetroWorkspace.IWorkspace,
): Promise<void> {
  const shared = MetroWorkspace.enterExternal(workspace);
  const external = path.join(shared, "helper.ts");
  fs.writeFileSync(external, "first\n", "utf8");

  const root = MetroWorkspace.enterProject(workspace, { plugins: [] });
  const relative = path.relative(root, external);
  const options = {
    upstreamTransformer: TestMetroRuntime.fakeUpstreamPathOnDisk(),
    plugins: [
      {
        transform: "./plugin.cjs",
        name: "reader",
        operation: "read-configured-helper",
        path: relative,
      },
      {
        transform: "./plugin.cjs",
        name: "reporter",
        operation: "emit-dependencies",
        dependencies: [relative.split(path.sep).join("/")],
      },
    ],
  };

  await prepareSnapshot(root);
  const runOne = await TestMetroRuntime.runTransform({
    options,
    params: {
      src: TestUnpluginProject.mainSource(root),
      filename: "src/main.ts",
      options: { projectRoot: root },
    },
  });
  assert.match(runOne.ast.src as string, /PLUGIN:FIRST/);
  // The transform recorded the external input into this worker's snapshot,
  // beside the project's own configuration inputs, which are out of walk too
  // now that the walk hashes only files that could enter the program
  // (samchon/ttsc#1307).
  assert.deepEqual(
    workerSnapshotFiles(root),
    [
      external,
      path.join(root, "package.json"),
      path.join(root, "plugin.cjs"),
      path.join(root, "src", "tsconfig.json"),
      path.join(root, "tsconfig.json"),
    ].sort(),
    "exactly the out-of-walk inputs, and never a project source",
  );
  assert.ok(
    workerSnapshotTrees(root).includes(TestUnpluginProject.pluginSource(root)),
    "the plugin's Go source is recorded as a tree",
  );

  // Next run: withTtsc compacts the worker snapshot into the main file.
  await prepareSnapshot(root);
  assert.deepEqual(listWorkerSnapshots(root), []);
  assert.ok(readMainSnapshot(root).files.includes(external));
  const before = await cacheKeyForRun(root, options);
  assert.equal(
    await cacheKeyForRun(root, options),
    before,
    "unchanged external input must retain the key",
  );

  fs.writeFileSync(external, "second\n", "utf8");
  const after = await cacheKeyForRun(root, options);
  assert.notEqual(before, after);
  const runThree = await TestMetroRuntime.runTransform({
    options,
    params: {
      src: TestUnpluginProject.mainSource(root),
      filename: "src/main.ts",
      options: { projectRoot: root },
    },
  });
  assert.match(runThree.ast.src as string, /PLUGIN:SECOND/);
}
