import { TestUnpluginProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { MetroWorkspace } from "../../../internal/metro/internal/MetroWorkspace";
import { prepareSnapshot, cacheKeyForRun, workerSnapshotFiles } from "../../../internal/metro/internal/metro-snapshot";
import { TestMetroRuntime } from "../../../internal/metro/internal/metro-runtime";

/**
 * Verifies editing the tsconfig between runs changes the cache key.
 *
 * The project walk no
 * longer hashes files that cannot enter the program, so this pins the outcome
 * that matters, that a compiler-option change still re-keys the run
 * (samchon/ttsc#1307).
 *
 * 1. Create a plugin-less project, prepare the snapshot, compute the key.
 * 2. Change a compiler option; compute the key in a fresh transformer module.
 * 3. Assert the keys differ.
 *
 * @evidence contracts/testing.md#behavioral-verification A real native transform records its tsconfig; editing that effective config changes the next Metro key.
 * @evidence contracts/testing.md#independent-expectations The authored config path and compiler-option mutation independently determine an input whose meaning can change compilation.
 * @evidence contracts/testing.md#distinguishing-cases Configuration invalidation contrasts source, external-helper and Go-environment changes; source policy matrices retain separate owners.
 * @evidence contracts/testing.md#execution-ownership Called by test_e2e_metro, which is discovered under src/features and selected by the E2E Evidence claim; this exported scenario executes the compiled Metro package, while source units own its portable decisions.
 * @evidence contracts/e2e.md#necessary-boundary Compiler-derived configuration dependencies must reach the worker snapshot, not merely a synthetic filesystem walk.
 * @evidence contracts/e2e.md#shared-execution One project/native transform establishes the observation and the same prepared snapshot drives the later key comparison. Config edits require a new fingerprint, not another installation or compiler invocation in this case. Its project is a slot of the experiment's single workspace, written or copied by MetroWorkspace instead of being created as a separate temporary directory.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Only this project tsconfig is edited; worker options are restored and compaction transfers recorded inputs into its case main snapshot. Entering the slot replaces it, which removes any earlier snapshot, epoch and recorded input, and the experiment removes the whole workspace and verifies its absence once, after the last scenario.
 * @evidence contracts/e2e.md#preserved-coverage Original tsconfig recording and changed-key assertions remain at the producer connection.
 */
export async function case_metro_cache_key_changes_when_the_tsconfig_changes(
  workspace: MetroWorkspace.IWorkspace,
): Promise<void> {
  const root = MetroWorkspace.enterProject(workspace);
  await prepareSnapshot(root);
  await TestMetroRuntime.runTransform({
    options: { upstreamTransformer: TestMetroRuntime.fakeUpstreamPathOnDisk() },
    params: {
      src: TestUnpluginProject.mainSource(root),
      filename: "src/main.ts",
      options: { projectRoot: root },
    },
  });
  const tsconfig = path.join(root, "tsconfig.json");
  assert.ok(
    workerSnapshotFiles(root).includes(tsconfig),
    "the tsconfig must be recorded, since the walk no longer hashes it",
  );

  await prepareSnapshot(root);
  const before = await cacheKeyForRun(root);

  const parsed = JSON.parse(fs.readFileSync(tsconfig, "utf8")) as {
    compilerOptions?: Record<string, unknown>;
  };
  parsed.compilerOptions = {
    ...(parsed.compilerOptions ?? {}),
    target: "ES2021",
  };
  fs.writeFileSync(tsconfig, JSON.stringify(parsed, null, 2), "utf8");

  const after = await cacheKeyForRun(root);
  assert.notEqual(
    before,
    after,
    "a tsconfig edit must re-key every transform in the run",
  );
}
