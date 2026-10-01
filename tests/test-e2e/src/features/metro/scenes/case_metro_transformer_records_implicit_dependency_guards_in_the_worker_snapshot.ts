import { TestUnpluginProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { MetroWorkspace } from "../../../internal/metro/internal/MetroWorkspace";
import { prepareSnapshot, readMainSnapshot, runWorkerSnapshot, workerSnapshotFiles, workerSnapshotTrees } from "../../../internal/metro/internal/metro-snapshot";
import { TestMetroRuntime } from "../../../internal/metro/internal/metro-runtime";

/**
 * Verifies the worker snapshot guards every implicit-project dependency.
 *
 * The worker compares the complete derived set with the exact main-process run
 * baseline, retains inputs outside proven static coverage, and taints any
 * temporal mismatch. Exercises the real native compiler, so it runs where the
 * Go toolchain is present (CI).
 *
 * 1. Transform a file whose plugin reports one in-project and one out-of-project
 *    dependency.
 * 2. Read the worker snapshot.
 * 3. Assert the static input is proven without duplication, external inputs are
 *    retained in one batch, the first discovery rotates the epoch, and the
 *    unchanged second run stabilizes.
 * 4. Recorder-only topology and config transitions execute in the named source
 *    unit test_recorder_guards_implicit_dependency_transitions.
 *
 * @evidence contracts/testing.md#behavioral-verification Native reporter metadata records exactly external/project descriptor inputs, retains its Go source tree, taints first unknown discovery, then stabilizes the unchanged next compiler run.
 * @evidence contracts/testing.md#independent-expectations The authored dependency list and exact expected fixture paths independently specify which inputs are outside static coverage; taint/epoch relationships follow run-baseline safety.
 * @evidence contracts/testing.md#distinguishing-cases Static in-walk dependencies contrast newly discovered external inputs and a subsequent unchanged proven run.
 * @evidence contracts/testing.md#execution-ownership Called by test_e2e_metro, which is discovered under src/features and selected by the E2E Evidence claim; this exported scenario executes the compiled Metro package, while source units own its portable decisions.
 * @evidence contracts/e2e.md#necessary-boundary Actual native dependency facts and generation witnesses must reach Metro through the adapter callback; direct recorder calls cannot certify compiler extraction.
 * @evidence contracts/e2e.md#shared-execution Both compiler observations share one project, reporter source and suite native producer cache; the second generation checks that newly compacted discovery can reuse its static coverage. Recorder-only cases were transferred out of this native population. Its project is a slot of the experiment's single workspace, written or copied by MetroWorkspace instead of being created as a separate temporary directory.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Worker run IDs come from actual preparation and key baselines precede transforms. Entering the slot replaces it, which removes any earlier snapshot, epoch and recorded input, and the experiment removes the whole workspace and verifies its absence once, after the last scenario.
 * @evidence contracts/e2e.md#preserved-coverage Original exact input set, source-tree, first taint and stabilized epoch assertions remain. test_recorder_guards_implicit_dependency_transitions now owns every ancestor, ABA, alias-swap, selection and malformed-baseline assertion from the former tail.
 */
export async function case_metro_transformer_records_implicit_dependency_guards_in_the_worker_snapshot(
  workspace: MetroWorkspace.IWorkspace,
): Promise<void> {
  const shared = MetroWorkspace.enterExternal(workspace);
  const external = path.join(shared, "types.d.ts");
  fs.writeFileSync(external, "declare const marker: string;\n", "utf8");

  const root = MetroWorkspace.enterProject(workspace, { plugins: [] });
  const inner = path.join(root, "src", "inner.d.ts");
  fs.writeFileSync(inner, "declare const inner: string;\n", "utf8");
  const options = {
    upstreamTransformer: TestMetroRuntime.fakeUpstreamPathOnDisk(),
    plugins: [
      {
        transform: "./plugin.cjs",
        name: "reporter",
        operation: "emit-dependencies",
        dependencies: [
          "src/inner.d.ts",
          path.relative(root, external).split(path.sep).join("/"),
        ],
      },
    ],
  };
  const firstRunId = await prepareSnapshot(root);
  await TestMetroRuntime.withTransformerEnv(
    options,
    async (mod) => {
      mod.getCacheKey({ projectRoot: root });
      await mod.transform({
        src: TestUnpluginProject.mainSource(root),
        filename: "src/main.ts",
        options: { projectRoot: root },
      });
    },
    firstRunId,
  );
  // The exact set, not a lower bound: the main baseline proves the in-project
  // source and config, while every newly discovered external input is retained.
  assert.deepEqual(
    workerSnapshotFiles(root),
    [
      external,
      path.join(root, "package.json"),
      path.join(root, "plugin.cjs"),
    ].sort(),
    "exactly the inputs outside proven static coverage must remain as snapshot guards",
  );
  assert.ok(
    workerSnapshotTrees(root).includes(TestUnpluginProject.pluginSource(root)),
    "the plugin's Go source is recorded as a tree",
  );
  const firstWorker = JSON.parse(
    fs.readFileSync(runWorkerSnapshot(root), "utf8"),
  );
  assert.equal(
    firstWorker.tainted,
    true,
    "newly discovered inputs must rotate the epoch before their first reusable key",
  );
  await prepareSnapshot(root);
  const stabilizedEpoch = readMainSnapshot(root).id;
  const stableRunId = await prepareSnapshot(root);
  await TestMetroRuntime.withTransformerEnv(
    options,
    async (mod) => {
      mod.getCacheKey({ projectRoot: root });
      await mod.transform({
        src: TestUnpluginProject.mainSource(root),
        filename: "src/main.ts",
        options: { projectRoot: root },
      });
    },
    stableRunId,
  );
  assert.equal(
    JSON.parse(fs.readFileSync(runWorkerSnapshot(root), "utf8")).tainted,
    false,
    "a complete unchanged baseline must stabilize instead of disabling cache reuse",
  );
  await prepareSnapshot(root);
  assert.equal(
    readMainSnapshot(root).id,
    stabilizedEpoch,
    "an unchanged proven run must preserve its snapshot epoch",
  );
}
