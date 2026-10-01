import { TestUnpluginProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { MetroWorkspace } from "../../../internal/metro/internal/MetroWorkspace";
import { prepareSnapshot, workerSnapshotFiles, workerSnapshotTrees } from "../../../internal/metro/internal/metro-snapshot";
import { TestMetroRuntime } from "../../../internal/metro/internal/metro-runtime";

/**
 * Verifies Metro records linked graph inputs in the worker snapshot.
 *
 * Metro's project fingerprint shares the Unplugin walk predicate. A path below
 * the project root is not actually fingerprinted when a symbolic link or
 * Windows junction leads to it, so the graph snapshot must retain that path.
 *
 * 1. Link an in-project directory to an external declaration.
 * 2. Transform with a plugin-reported dependency through the linked spelling.
 * 3. Assert the worker snapshot records that spelling as an external input.
 *
 * @evidence contracts/testing.md#behavioral-verification An actual native reporter dependency through a directory link retains the lexical linked path plus exact config/descriptor inputs and Go source tree.
 * @evidence contracts/testing.md#independent-expectations The authored link spelling and literal expected fixture paths independently specify compiler-visible identity outside the static walk.
 * @evidence contracts/testing.md#distinguishing-cases Linked in-project spelling contrasts ordinary in-walk sources and an external unlinked helper.
 * @evidence contracts/testing.md#execution-ownership Called by test_e2e_metro, which is discovered under src/features and selected by the E2E Evidence claim; this exported scenario executes the compiled Metro package, while source units own its portable decisions.
 * @evidence contracts/e2e.md#necessary-boundary Compiler-derived dependency spelling must survive the real transform callback and be recorded under its lexical link identity.
 * @evidence contracts/e2e.md#shared-execution One linked fixture and native reporter compile use the suite shared immutable producer/cache; exact input assertions share that single worker observation. Its project is a slot of the experiment's single workspace, written or copied by MetroWorkspace instead of being created as a separate temporary directory.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity A case-local link targets a separate tracked declaration directory, and the worker options restore after the call. Entering the slot replaces it, which removes any earlier snapshot, epoch and recorded input, and the experiment removes the whole workspace and verifies its absence once, after the last scenario.
 * @evidence contracts/e2e.md#preserved-coverage All original exact worker-file and Go source-tree membership assertions remain.
 */
export async function case_metro_transformer_records_linked_inputs_in_the_worker_snapshot(
  workspace: MetroWorkspace.IWorkspace,
): Promise<void> {
  const shared = MetroWorkspace.enterExternal(workspace);
  const target = path.join(shared, "types.d.ts");
  fs.writeFileSync(target, "declare const marker: string;\n", "utf8");

  const root = MetroWorkspace.enterProject(workspace, { plugins: [] });
  const linkedDirectory = path.join(root, "linked");
  fs.symlinkSync(
    shared,
    linkedDirectory,
    process.platform === "win32" ? "junction" : "dir",
  );
  const linked = path.join(linkedDirectory, "types.d.ts");
  await prepareSnapshot(root);
  await TestMetroRuntime.runTransform({
    options: {
      upstreamTransformer: TestMetroRuntime.fakeUpstreamPathOnDisk(),
      plugins: [
        {
          transform: "./plugin.cjs",
          name: "reporter",
          operation: "emit-dependencies",
          dependencies: ["linked/types.d.ts"],
        },
      ],
    },
    params: {
      src: TestUnpluginProject.mainSource(root),
      filename: "src/main.ts",
      options: { projectRoot: root },
    },
  });
  // The exact set. The project's own configuration inputs are recorded beside
  // the linked one, because the walk hashes only files that could enter the
  // program and these cannot (samchon/ttsc#1307); a lower bound would let a
  // recorder that swallowed a whole subtree pass.
  assert.deepEqual(
    workerSnapshotFiles(root),
    [
      linked,
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
}
