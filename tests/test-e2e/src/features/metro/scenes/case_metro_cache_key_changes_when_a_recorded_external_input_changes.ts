import { TestUnpluginProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { MetroWorkspace } from "../../../internal/metro/internal/MetroWorkspace";
import { prepareSnapshot, cacheKeyForRun, readMainSnapshot, listWorkerSnapshots, workerSnapshotFiles, workerSnapshotTrees } from "../../../internal/metro/internal/metro-snapshot";
import { TestMetroRuntime } from "../../../internal/metro/internal/metro-runtime";

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
 * @evidence contracts/testing.md#distinguishing-cases An external helper absent from the program walk contrasts in-project dependency invalidation; exact set assertions prevent over-recording.
 * @evidence contracts/testing.md#execution-ownership Called by test_e2e_metro, which is discovered under src/features and selected by the E2E Evidence claim; this exported scenario executes the compiled Metro package, while source units own its portable decisions.
 * @evidence contracts/e2e.md#necessary-boundary Actual plugin metadata and transformed output must traverse compiler-to-Unplugin-to-Metro delivery before an out-of-walk input can be guarded.
 * @evidence contracts/e2e.md#shared-execution One project, reader/reporter descriptors and the suite shared plugin producer serve both external states; changing helper bytes requires a new compile generation, while compaction performs no native build. Its project is a slot of the experiment's single workspace, written or copied by MetroWorkspace instead of being created as a separate temporary directory.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Only the case external file is edited; its fixture identity and project path isolate recorded inputs. Entering the slot replaces it, which removes any earlier snapshot, epoch and recorded input, and the experiment removes the whole workspace and verifies its absence once, after the last scenario.
 * @evidence contracts/e2e.md#preserved-coverage Original exact worker set, source-tree membership, compaction cleanup, main membership, changed key and both output markers remain.
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
