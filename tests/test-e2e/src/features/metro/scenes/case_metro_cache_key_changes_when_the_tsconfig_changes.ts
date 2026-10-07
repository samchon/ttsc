import { TestUnpluginProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { MetroWorkspace } from "../../../internal/metro/internal/MetroWorkspace";
import { TestMetroRuntime } from "../../../internal/metro/internal/metro-runtime";
import {
  cacheKeyForRun,
  prepareSnapshot,
  workerSnapshotFiles,
} from "../../../internal/metro/internal/metro-snapshot";

/**
 * Verifies editing the tsconfig between runs changes the cache key.
 *
 * The project walk no longer hashes files that cannot enter the program, so
 * this pins the outcome that matters, that a compiler-option change still
 * re-keys the run (samchon/ttsc#1307).
 *
 * 1. Transform the default plugin project, retain recorded config and compute the
 *    key.
 * 2. Change a compiler option; compute the key in a fresh transformer module.
 * 3. Assert the keys differ.
 *
 * @evidence contracts/testing.md#behavioral-verification A real native transform records its tsconfig; editing that effective config changes the next Metro key.
 * @evidence contracts/testing.md#independent-expectations The authored config path and compiler-option mutation independently determine an input whose meaning can change compilation.
 * @evidence contracts/testing.md#distinguishing-cases Repeated unchanged-input key equality rejects a fresh fallback nonce before an explicitly checked ES2022-to-ES2021 mutation. This records compiler-config invalidation rather than source/external/Go-environment changes; no generic unit-owner coverage is inferred.
 * @evidence contracts/testing.md#execution-ownership test_e2e_metro invokes the selected scenario; TestMetroRuntime defaults to built transformer modules unless TTSC_TEST_LAYER=unit. Its authored echo upstream is not a real Metro server/OS worker, and source override execution is not built-boundary proof.
 * @evidence contracts/e2e.md#necessary-boundary Compiler-derived configuration dependencies must reach the worker snapshot, not merely a synthetic filesystem walk.
 * @evidence contracts/e2e.md#shared-execution One awaited default-plugin transform establishes recorded config and the same snapshot drives key-only comparisons. They do not request another transform/rebuild, measure child/Program/cache totals or make query-import modules OS workers. The mutable project slot reuses the shared immutable fixture producer.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Only the case tsconfig is edited after snapshot compaction; its original target premise and stable-key control are checked. Runtime options env is restored after each awaited call; slot reset and parent aggregate cleanup have separate ownership. Results/path removal do not establish arbitrary descendant or loaded-image equality.
 * @evidence contracts/e2e.md#preserved-coverage Original native config recording and ES2021 changed-key assertions remain, with explicit baseline target and stable-key controls. No post-change compilation/output is claimed; registration, built-layer binding, runtime survival and cost measurement remain unverified.
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
  assert.equal(
    await cacheKeyForRun(root),
    before,
    "unchanged recorded config must retain the key",
  );

  const parsed = JSON.parse(fs.readFileSync(tsconfig, "utf8")) as {
    compilerOptions?: Record<string, unknown>;
  };
  assert.equal(
    parsed.compilerOptions?.target,
    "ES2022",
    "the authored target must differ from the ES2021 mutation",
  );
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
