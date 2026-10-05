import { TestUnpluginProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { MetroWorkspace } from "../../../internal/metro/internal/MetroWorkspace";
import { TestMetroRuntime } from "../../../internal/metro/internal/metro-runtime";
import {
  prepareSnapshot,
  workerSnapshotFiles,
  workerSnapshotTrees,
} from "../../../internal/metro/internal/metro-snapshot";

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
 * @evidence contracts/testing.md#distinguishing-cases Linked in-project spelling contrasts in-walk sources and the external unlinked sibling case. Native realpath equality verifies its authored external target and lexical inequality verifies the alias premise before transform; original exact recorded paths reject replacing the link spelling by canonical target.
 * @evidence contracts/testing.md#execution-ownership test_e2e_metro invokes this selected actual directory-link/native reporter input through default built transformer modules unless TTSC_TEST_LAYER=unit. Authored echo upstream is not a Metro server/OS worker; source override is not built-boundary proof and direct link/recorder units do not replace native delivery.
 * @evidence contracts/e2e.md#necessary-boundary Compiler-derived dependency spelling must survive the real transform callback and be recorded under its lexical link identity.
 * @evidence contracts/e2e.md#shared-execution One actual junction on Windows or directory symlink elsewhere and one reporter transform share selected producer artifacts. Parent calls do not certify compiler generation/native child/cache totals; exact recorded set and source-tree assertions share the one observation without per-input producer preparation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Fresh project/external slots isolate the linked target; native link creation/realpath premise failures propagate, not skip. Runtime options env restores after the awaited transform, parent aggregate cleanup removes slots/link after case settlement. Paths and Promise return do not certify loaded-image equality or arbitrary descendants.
 * @evidence contracts/e2e.md#preserved-coverage Original lexical linked path plus exact package/descriptor/two config files and Go tree membership remain, with native target/alias premise checks. No retarget/restart outcome or broader unit runtime is inferred; registration/built-layer binding/survival/measurement remain unverified.
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
  const physicalTarget = fs.realpathSync.native(target);
  assert.equal(
    fs.realpathSync.native(linked),
    physicalTarget,
    "the authored directory link must reach the external declaration",
  );
  assert.notEqual(
    path.resolve(linked),
    physicalTarget,
    "the dependency must retain a distinct lexical link spelling",
  );
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
